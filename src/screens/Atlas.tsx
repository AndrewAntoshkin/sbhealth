import {
  useCallback,
  useEffect,
  useLayoutEffect,
  lazy,
  Suspense,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ArrowCounterClockwise, ArrowRight, CalendarCheck, CaretLeft } from '@phosphor-icons/react'
import { Booking } from '../Booking'
import { TopActions } from '../TopActions'
import { Dock, type DockTab } from './Dock'
import { doctorById, doctorFor, roleTo } from '../data/doctors'
import { MODE_LABEL, cancelAppointment, useCore, type Appointment } from '../store'
import { fmtDay, fmtTime, inDays } from '../time'
import {
  MESH_COLOR,
  RISK_INK,
  RISK_LABEL,
  RISK_SOFT,
  levelOf,
  systemById,
  type BodySystem,
  type RiskLevel,
  type SystemId,
} from '../data/systems'
import { INDEX, Legend, Meter, ORDER, ORGAN_TITLE, RiskTag, ScoreChip, TONE, TOP_TEXT, photo, thumb } from '../shared'
import { metricIcon } from '../metricIcons'
import HOTSPOTS from '../data/hotspots.json'

// 3D-сцена (three + r3f) — отдельный чанк: интерфейс рисуется, пока он качается
const BodyCanvas = lazy(() => import('../scene/BodyCanvas').then((m) => ({ default: m.BodyCanvas })))
const POSTER = `${import.meta.env.BASE_URL}poster.webp`


export function Atlas({ initial, onTab, go }: { initial: SystemId | null; onTab: (tab: DockTab) => void; go: (to: string) => void }) {
  const [booking, setBooking] = useState<{ systemId: SystemId; replace?: Appointment } | null>(null)
  const [selected, setSelected] = useState<SystemId | null>(initial)
  const [resetSignal, setResetSignal] = useState(0)
  const [peek, setPeek] = useState(0)
  const [inset, setInset] = useState(0)
  const [hint, setHint] = useState(true)
  const [modelReady, setModelReady] = useState(false)
  useEffect(() => {
    if (modelReady) window.dispatchEvent(new Event('atlas-ready'))
  }, [modelReady])
  const chipRef = useRef<HTMLButtonElement>(null)
  const wide = useWide()
  const system = selected ? systemById(selected) : null
  const level = system ? levelOf(system.risk) : null

  const onMetrics = useCallback((covered: number, height: number) => {
    setPeek(covered)
    setInset(height)
  }, [])

  useEffect(() => {
    if (selected) setHint(false)
  }, [selected])

  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 14000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!selected) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`chip-${selected}`)?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [selected])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null)
        return
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      const index = selected ? ORDER.findIndex((item) => item.id === selected) : -1
      const step = event.key === 'ArrowRight' ? 1 : -1
      const next = ORDER[(index + step + ORDER.length) % ORDER.length]
      setSelected(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div className="app atlas">
      <header className="top">
        {selected && (
          <button className="back" type="button" aria-label="Ко всему телу" onClick={() => setSelected(null)}>
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>
        )}
        <div className="top-title">
          <h1>Атлас тела</h1>
          <p className="kicker">13 систем</p>
        </div>
        <TopActions go={go} />
      </header>

      <div className="workspace">
        <div className="stage" onPointerDownCapture={() => setHint(false)}>
          {/* готовый кадр тела: виден сразу, пока качается и собирается настоящая модель */}
          <div className="stage-chip">
            <ScoreChip value={INDEX} tone={TONE} buttonRef={chipRef} onOpen={() => go('#/index')} />
          </div>
          <img className="poster" data-ready={modelReady || undefined} src={POSTER} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
          <Suspense fallback={<div className="loader" role="status"><div className="loader-orbit" /><p>Собираем тело</p></div>}>
            <BodyCanvas
              selected={selected}
              resetSignal={resetSignal}
              peek={wide ? 0 : peek}
              inset={wide ? 0 : inset}
              onSelect={(id) => setSelected(id)}
              onReady={() => setModelReady(true)}
            />
          </Suspense>

          {!wide && (
            <div className="phone-ui">
              {system && level ? (
                <>
                  <div className="pill-row" style={{ bottom: Math.max(0, peek - 2) }}>
                    {system.metrics.slice(0, 2).map((metric) => (
                      <div className="float-pill" key={`${system.id}-${metric.label}`}>
                        <i style={{ background: MESH_COLOR[level] }} />
                        <b>{metric.value}</b>
                        <span>{metric.label}</span>
                      </div>
                    ))}
                  </div>
                  <Sheet
                    key="detail"
                    label={ORGAN_TITLE[system.id]}
                    resetKey={system.id}
                    onMetrics={onMetrics}
                    deck={({ grown, toggle }) => <OrganDeck selected={system.id} onSelect={setSelected} grown={grown} toggle={toggle} />}
                  >
                    <OrganDetail
                      key={system.id}
                      system={system}
                      level={level}
                      backLabel="Ко всему телу"
                      onBack={() => setSelected(null)}
                      onBook={(replace) => setBooking({ systemId: system.id, replace })}
                      withSummary
                      head
                    />
                  </Sheet>
                </>
              ) : (
                <>
                  <button
                    className="round at-right"
                    type="button"
                    aria-label="Вернуть общий ракурс"
                    onClick={() => setResetSignal((value) => value + 1)}
                  >
                    <ArrowCounterClockwise size={20} weight="bold" aria-hidden="true" />
                  </button>
                  {hint && (
                    <div className="hint" role="status" style={{ bottom: peek + 14 }}>
                      <i />
                      Нажмите на орган
                    </div>
                  )}
                  <Sheet
                    key="overview"
                    label="Системы и риск"
                    onMetrics={onMetrics}
                    grab={
                      <>
                        <strong>Три зоны внимания</strong>
                        <p>{TOP_TEXT}</p>
                        <Legend />
                      </>
                    }
                  >
                    <h3 className="block-title">Все системы</h3>
                    <OverviewList onSelect={setSelected} />
                  </Sheet>
                </>
              )}
            </div>
          )}

          {wide && !selected && (
            <button
              className="reset"
              type="button"
              aria-label="Вернуть общий ракурс"
              onClick={() => setResetSignal((value) => value + 1)}
            >
              <ArrowCounterClockwise size={20} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>

        {wide && (
          <section className="panel" aria-label="Системы и риск">
            <div className="panel-legend">
              <Legend />
            </div>

            {system && (
              <div className="rail" role="group" aria-label="Системы">
                {ORDER.map((item) => {
                  const itemLevel = levelOf(item.risk)
                  const on = item.id === selected
                  return (
                    <button
                      key={item.id}
                      id={`chip-${item.id}`}
                      type="button"
                      className={on ? 'chip is-on' : 'chip'}
                      aria-pressed={on}
                      style={{
                        ['--chip-color' as string]: MESH_COLOR[itemLevel],
                        background: on ? RISK_SOFT[itemLevel] : undefined,
                      }}
                      onClick={() => setSelected(on ? null : item.id)}
                    >
                      <i style={{ background: MESH_COLOR[itemLevel] }} />
                      {item.short}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="scroll">
              {system && level ? (
                <>
                  <h2>{system.name}</h2>
                  <p className="covers">{system.covers}</p>
                  <OrganDetail
                    key={system.id}
                    system={system}
                    level={level}
                    backLabel="Все системы"
                    onBack={() => setSelected(null)}
                    onBook={(replace) => setBooking({ systemId: system.id, replace })}
                    withSummary
                  />
                </>
              ) : (
                <>
                  <article className="card spotlight">
                    <h2>Три зоны внимания</h2>
                    <p>{TOP_TEXT}</p>
                  </article>
                  <h3 className="block-title">Все системы</h3>
                  <OverviewList onSelect={setSelected} />
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <div>
        <Dock active="atlas" onGo={(tab) => onTab(tab)} />
      </div>

      {booking && (
        <Booking
          systemId={booking.systemId}
          replace={booking.replace}
          onClose={() => setBooking(null)}
          onChat={(to) => {
            setBooking(null)
            go(to)
          }}
        />
      )}
    </div>
  )
}

function OverviewList({ onSelect }: { onSelect: (id: SystemId) => void }) {
  return (
    <ul className="overview-list">
      {ORDER.map((item) => {
        const itemLevel = levelOf(item.risk)
        return (
          <li key={item.id}>
            <button type="button" onClick={() => onSelect(item.id)}>
              <span className="swatch" style={{ background: RISK_SOFT[itemLevel] }}>
                <img src={thumb(item.id)} alt="" width="48" height="48" loading="lazy" decoding="async" draggable={false} />
              </span>
              <span className="copy">
                <span className="name">{item.name}</span>
                <span className="sub">{item.covers}</span>
              </span>
              <RiskTag level={itemLevel} score={item.risk} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function OrganDetail({
  system,
  level,
  backLabel,
  onBack,
  onBook,
  withSummary = false,
  head = false,
}: {
  system: BodySystem
  level: RiskLevel
  backLabel: string
  onBack: () => void
  onBook: (replace?: Appointment) => void
  withSummary?: boolean
  head?: boolean
}) {
  const { appts } = useCore()
  const [cancelling, setCancelling] = useState(false)
  const appt = appts.find((a) => a.systemId === system.id && a.status === 'booked' && a.start > Date.now() - 30 * 60_000)
  const [active, setActive] = useState(0)
  useEffect(() => {
    // шторка свёрнута (visibility: hidden) — картинку подгружаем и декодируем заранее
    const img = new Image()
    img.src = photo(system.id)
    img.decode?.().catch(() => undefined)
  }, [system.id])
  const spots = HOTSPOTS[system.id as keyof typeof HOTSPOTS] as number[][] | undefined
  const current = system.metrics[active] ?? system.metrics[0]
  return (
    <div className="dx" style={{ ['--c' as string]: MESH_COLOR[level], ['--soft' as string]: RISK_SOFT[level], ['--ink-risk' as string]: RISK_INK[level] }}>
      {head && (
        <header className="dx-head">
          <h2>{ORGAN_TITLE[system.id]}</h2>
          <p>{system.covers}</p>
        </header>
      )}

      <figure className="dx-visual">
        <img src={photo(system.id)} alt={`${ORGAN_TITLE[system.id]}: изображение органа`} width="720" height="720" decoding="async" draggable={false} />
        <RiskTag level={level} score={system.risk} />
        {spots?.map(([x, y], index) => (
          <button
            key={index}
            type="button"
            className={index === active ? 'dx-dot is-on' : 'dx-dot'}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            aria-pressed={index === active}
            aria-label={system.metrics[index]?.label ?? `Точка ${index + 1}`}
            onClick={() => setActive(index)}
          />
        ))}
        {current && (
          <figcaption className="dx-bubble" key={active}>
            <span>{current.label}</span>
            <b>{current.value}</b>
          </figcaption>
        )}
      </figure>

      <section className="dx-score" aria-label="Уровень риска">
        <div className="dx-num">
          <b>{system.risk}</b>
          <span>
            из 100
            {withSummary && <RiskTag level={level} />}
          </span>
        </div>
        <Meter value={system.risk} level={level} />
        {withSummary && <p className="dx-summary">{system.summary}</p>}
      </section>

      <section className="dx-sec">
        <h3>Показатели</h3>
        <ul className="dx-metrics">
          {system.metrics.map((metric, index) => {
            const MetricIcon = metricIcon(metric.label)
            return (
              <li key={metric.label}>
                <button type="button" className={index === active ? 'dx-metric is-on' : 'dx-metric'} aria-pressed={index === active} onClick={() => setActive(index)}>
                  <span className="dx-ico">
                    <MetricIcon size={22} weight="duotone" aria-hidden="true" />
                  </span>
                  <span className="dx-lab">
                    {metric.label}
                    <small>{metric.hint}</small>
                  </span>
                  <b className="dx-val">{metric.value}</b>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="dx-sec">
        <h3>Что это значит</h3>
        <p>{system.meaning}</p>
      </section>

      <section className="dx-sec">
        <h3>Что делать</h3>
        <p>{system.advice}</p>
      </section>

      {appt ? (
        <section className="dx-appt" aria-label="Ваша запись">
          <p className="dx-appt-k">
            <CalendarCheck size={16} weight="fill" aria-hidden="true" />
            Вы записаны · {inDays(appt.start)}
          </p>
          <p className="dx-appt-when">
            <b>{fmtDay(appt.start)}</b>
            <span>{fmtTime(appt.start)}</span>
          </p>
          <p className="dx-appt-sub">
            {doctorById(appt.doctorId).name} · {MODE_LABEL[appt.mode].toLowerCase()}
          </p>
          {cancelling ? (
            <div className="dx-appt-actions" role="group" aria-label="Отменить запись?">
              <button className="nx-btn is-dark" type="button" onClick={() => cancelAppointment(appt.id)}>
                Да, отменить
              </button>
              <button className="nx-btn" type="button" onClick={() => setCancelling(false)}>
                Оставить
              </button>
            </div>
          ) : (
            <div className="dx-appt-actions">
              <button className="nx-btn" type="button" onClick={() => onBook(appt)}>
                Перенести
              </button>
              <button className="nx-btn" type="button" onClick={() => setCancelling(true)}>
                Отменить
              </button>
            </div>
          )}
        </section>
      ) : (
        <button className="primary" type="button" onClick={() => onBook()}>
          Записаться к {roleTo(doctorFor(system.id))}
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </button>
      )}
      <button className="text-btn" type="button" onClick={onBack}>
        {backLabel}
      </button>
    </div>
  )
}

function OrganDeck({
  selected,
  onSelect,
  grown,
  toggle,
}: {
  selected: SystemId
  onSelect: (id: SystemId) => void
  grown: boolean
  toggle: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  const first = useRef(true)

  const center = useCallback((id: SystemId, smooth: boolean) => {
    const scroller = ref.current
    const card = scroller?.querySelector<HTMLElement>(`[data-card="${id}"]`)
    if (!scroller || !card) return
    const left = card.offsetLeft + card.offsetWidth / 2 - scroller.clientWidth / 2
    if (Math.abs(scroller.scrollLeft - left) < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ left, behavior: smooth && !reduce ? 'smooth' : 'auto' })
  }, [])

  const grownRef = useRef(grown)
  grownRef.current = grown

  useLayoutEffect(() => {
    center(selected, !first.current)
    first.current = false
  }, [selected, grown, center])

  // колесо мыши: одно движение — одна карточка (горизонтальный тачпад листает сам браузер)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const pick = useRef(onSelect)
  pick.current = onSelect

  useEffect(() => {
    const scroller = ref.current
    if (!scroller) return
    let acc = 0
    let lock = 0
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      if (grownRef.current) return
      event.preventDefault()
      const now = performance.now()
      if (now < lock) return
      acc += event.deltaY
      if (Math.abs(acc) < 30) return
      const index = ORDER.findIndex((item) => item.id === selectedRef.current)
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, index + (acc > 0 ? 1 : -1)))]
      acc = 0
      lock = now + 380
      if (next.id !== selectedRef.current) pick.current(next.id)
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  // когда лента остановилась, выбираем карточку по центру
  const onScroll = () => {
    window.clearTimeout(timer.current)
    if (grownRef.current) return // в компактной ленте выбирают нажатием
    timer.current = window.setTimeout(() => {
      const scroller = ref.current
      if (!scroller) return
      const mid = scroller.scrollLeft + scroller.clientWidth / 2
      let best: string | null = null
      let gap = Infinity
      scroller.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid)
        if (distance < gap) {
          gap = distance
          best = card.dataset.card ?? null
        }
      })
      if (best && best !== selected) onSelect(best as SystemId)
    }, 120)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <>
      <i className="deck-handle" aria-hidden="true" />
      <div className="deck" data-deck ref={ref} role="group" aria-label="Системы организма" onScroll={onScroll}>
        {ORDER.map((item) => {
          const itemLevel = levelOf(item.risk)
          const on = item.id === selected
          return (
            <button
              key={item.id}
              type="button"
              className={on ? 'dcard is-on' : 'dcard'}
              data-card={item.id}
              aria-current={on ? 'true' : undefined}
              aria-expanded={on ? grown : undefined}
              aria-label={`${ORGAN_TITLE[item.id]}, ${RISK_LABEL[itemLevel]}, ${item.risk}.${on ? (grown ? ' Свернуть подробности' : ' Открыть подробности') : ' Показать'}`}
              tabIndex={on ? 0 : -1}
              style={{ ['--c' as string]: MESH_COLOR[itemLevel], ['--soft' as string]: RISK_SOFT[itemLevel] }}
              onClick={() => (on ? toggle() : onSelect(item.id))}
            >
              <span className="dthumb">
                <img src={thumb(item.id)} alt="" width="84" height="84" draggable={false} decoding="async" />
              </span>
              <span className="dbody">
                <span className="dname">{ORGAN_TITLE[item.id]}</span>
                <RiskTag level={itemLevel} score={item.risk} />
                <span className="dsum">{item.summary}</span>
              </span>
              {on && (
                <span className="dchev" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

const SHEET_GAP = 12

function Sheet({
  grab,
  rail,
  deck,
  children,
  label,
  resetKey,
  onMetrics,
}: {
  grab?: ReactNode
  rail?: ReactNode
  deck?: (api: { grown: boolean; toggle: () => void }) => ReactNode
  children: ReactNode
  label: string
  resetKey?: string
  onMetrics: (covered: number, height: number) => void
}) {
  const [height, setHeight] = useState(0)
  const [peek, setPeek] = useState(0)
  const [dragging, setDragging] = useState(false)
  const heightRef = useRef(0)
  const peekRef = useRef(0)
  const drag = useRef<{ y: number; h: number; moved: boolean; lastY: number; lastT: number; v: number } | null>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const topRef = headRef
  const deck_ = useRef<{ x: number; y: number; axis: '' | 'x' | 'y'; left: number } | null>(null)
  const suppressClick = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const setH = (value: number) => {
    heightRef.current = value
    setHeight(value)
  }

  useLayoutEffect(() => {
    const el = headRef.current
    if (!el) return
    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().height)
      if (!next) return
      const collapsed = heightRef.current === 0 || heightRef.current <= peekRef.current + 1
      // раскрытая шторка перестраивает ленту в компактную — высоту «свёрнуто» не трогаем
      if (!collapsed) return
      peekRef.current = next
      setPeek(next)
      if (collapsed) setH(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [resetKey])

  useEffect(() => {
    if (!height || !peek) return
    // камера кадрирует тело по прежнему пределу (78%), даже когда шторка раскрыта на всю высоту
    onMetrics(peek + SHEET_GAP, Math.min(height, cameraMax()) + SHEET_GAP)
  }, [height, peek, onMetrics])

  const stageHeight = () => sheetRef.current?.parentElement?.clientHeight ?? window.innerHeight
  const cameraMax = () => Math.max(peekRef.current + 160, Math.round(stageHeight() * 0.78))
  // шторка с деталью органа раскрывается почти на весь экран, как в мобильных паттернах
  const maxHeight = () => (deck ? Math.max(peekRef.current + 160, stageHeight() - 6) : cameraMax())

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    drag.current = {
      y: event.clientY,
      h: heightRef.current,
      moved: false,
      lastY: event.clientY,
      lastT: performance.now(),
      v: 0,
    }
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* указатель уже отпущен */
    }
  }

  const moveHeight = (state: NonNullable<typeof drag.current>, clientY: number) => {
    const now = performance.now()
    const dt = Math.max(now - state.lastT, 1)
    state.v = (state.lastY - clientY) / dt
    state.lastY = clientY
    state.lastT = now
    const delta = state.y - clientY
    if (Math.abs(delta) > 5) state.moved = true
    const raw = state.h + delta
    const max = maxHeight()
    // за верхним пределом шторка «упирается» с сопротивлением, а не обрывается
    const next = raw > max ? max + Math.min(36, (raw - max) * 0.28) : raw
    setH(Math.max(peekRef.current, next))
  }

  const settleHeight = (state: NonNullable<typeof drag.current>) => {
    const floor = peekRef.current
    const max = maxHeight()
    const current = heightRef.current
    if (!state.moved) {
      setH(current > floor + 24 ? floor : max)
      return
    }
    if (Math.abs(state.v) > 0.45) {
      setH(state.v > 0 ? max : floor)
      return
    }
    setH(current > (floor + max) / 2 ? max : floor)
  }

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    moveHeight(state, event.clientY)
  }

  const onUp = () => {
    const state = drag.current
    if (!state) return
    drag.current = null
    setDragging(false)
    settleHeight(state)
  }

  // Лента карточек: вертикальный жест тянет шторку, горизонтальный листает ленту
  // (на тач-экранах её листает браузер, мышью — мы сами).
  const getScroller = () => topRef.current?.querySelector<HTMLElement>('[data-deck]') ?? null

  const snapDeck = (scroller: HTMLElement) => {
    scroller.style.scrollSnapType = ''
    const mid = scroller.scrollLeft + scroller.clientWidth / 2
    let target = scroller.scrollLeft
    let gap = Infinity
    scroller.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
      const cardMid = card.offsetLeft + card.offsetWidth / 2
      if (Math.abs(cardMid - mid) < gap) {
        gap = Math.abs(cardMid - mid)
        target = cardMid - scroller.clientWidth / 2
      }
    })
    scroller.scrollTo({ left: target, behavior: 'smooth' })
  }

  const onDeckDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    deck_.current = {
      x: event.clientX,
      y: event.clientY,
      axis: '',
      left: getScroller()?.scrollLeft ?? 0,
    }
    drag.current = {
      y: event.clientY,
      h: heightRef.current,
      moved: false,
      lastY: event.clientY,
      lastT: performance.now(),
      v: 0,
    }
  }

  const onDeckMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = deck_.current
    const state = drag.current
    if (!gesture || !state) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (!gesture.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return
      gesture.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
      if (gesture.axis === 'y') {
        setDragging(true)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* указатель уже отпущен */
        }
      } else if (event.pointerType === 'mouse') {
        const scroller = getScroller()
        if (scroller) scroller.style.scrollSnapType = 'none'
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* указатель уже отпущен */
        }
      } else {
        // на тач-экране горизонталь забирает браузер
        deck_.current = null
        drag.current = null
        return
      }
    }
    if (gesture.axis === 'x') {
      const scroller = getScroller()
      if (scroller) scroller.scrollLeft = gesture.left - dx
      return
    }
    moveHeight(state, event.clientY)
  }

  const onDeckUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = deck_.current
    const state = drag.current
    deck_.current = null
    drag.current = null
    if (!gesture || !gesture.axis) return
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 60)
    if (gesture.axis === 'x') {
      const scroller = getScroller()
      if (scroller) snapDeck(scroller)
      return
    }
    setDragging(false)
    if (state && event.type !== 'pointercancel') settleHeight(state)
    else if (state) setH(peekRef.current)
  }

  const toggleSheet = () => setH(heightRef.current > peekRef.current + 24 ? peekRef.current : maxHeight())

  const grown = height > peek + 28
  const className = ['sheet', deck && 'is-deck', grown && 'is-grown', dragging && 'is-dragging'].filter(Boolean).join(' ')

  return (
    <>
      {grown && <div className="sheet-scrim" onClick={() => setH(peekRef.current)} aria-hidden="true" />}
      <section ref={sheetRef} className={className} style={height ? { height } : undefined} aria-label={label}>
        <div
          ref={headRef}
          className={deck ? 'sheet-top is-deck' : 'sheet-top'}
          {...(deck
            ? {
                onPointerDown: onDeckDown,
                onPointerMove: onDeckMove,
                onPointerUp: onDeckUp,
                onPointerCancel: onDeckUp,
                onClickCapture: (event: React.MouseEvent) => {
                  if (!suppressClick.current) return
                  event.stopPropagation()
                  event.preventDefault()
                },
              }
            : {})}
        >
          {deck ? (
            deck({ grown, toggle: toggleSheet })
          ) : (
            <>
              <div
                className="sheet-grab"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                role="button"
                tabIndex={0}
                aria-expanded={grown}
                aria-label={grown ? `${label}: свернуть шторку` : `${label}: потяните шторку вверх`}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setH(maxHeight())
                    return
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setH(peekRef.current)
                    return
                  }
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setH(grown ? peekRef.current : maxHeight())
                }}
              >
                <i />
                {grab}
              </div>
              {rail}
            </>
          )}
        </div>
        <div ref={bodyRef} className="sheet-body">
          {children}
        </div>
      </section>
    </>
  )
}

function useWide() {
  const query = '(min-width: 960px), (orientation: landscape) and (min-width: 640px) and (max-height: 520px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setWide(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return wide
}
