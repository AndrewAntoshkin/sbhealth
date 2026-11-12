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
import { IndexSheet } from './IndexSheet'
import {
  MESH_COLOR,
  RISK_INK,
  RISK_LABEL,
  RISK_SOFT,
  healthIndex,
  indexTone,
  levelOf,
  systemById,
  systemsByRisk,
  type BodySystem,
  type RiskLevel,
  type SystemId,
} from './data/systems'

// 3D-сцена (three + r3f) — отдельный чанк: интерфейс рисуется, пока он качается
const BodyCanvas = lazy(() => import('./scene/BodyCanvas').then((m) => ({ default: m.BodyCanvas })))
const POSTER = `${import.meta.env.BASE_URL}poster.webp`

const ORGAN_TITLE: Record<SystemId, string> = {
  cardiovascular: 'Сердце',
  nervous: 'Головной мозг',
  endocrine: 'Поджелудочная',
  musculoskeletal: 'Позвоночник',
  digestive: 'Пищеварение',
  hematopoietic: 'Костный мозг',
  integumentary: 'Кожа',
  lymphatic: 'Селезёнка',
  immune: 'Тимус',
  reproductive: 'Органы таза',
  respiratory: 'Лёгкие',
  sensory: 'Глаза',
  urinary: 'Почки',
}

const thumb = (id: SystemId) => `${import.meta.env.BASE_URL}organs/${id}.webp`

const ORDER = systemsByRisk()
const INDEX = healthIndex()
const TONE = indexTone(INDEX)
const LEVELS: RiskLevel[] = ['low', 'watch', 'elevated', 'high']
const TOP = ORDER.slice(0, 3).map((item) => item.name.toLowerCase())
const TOP_TEXT = `Выше остальных ${TOP[0]}, ${TOP[1]} и ${TOP[2]}. Цвет на модели — это риск, не диагноз.`

export function App() {
  const [selected, setSelected] = useState<SystemId | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [peek, setPeek] = useState(0)
  const [inset, setInset] = useState(0)
  const [hint, setHint] = useState(true)
  const [scoreOpen, setScoreOpen] = useState(false)
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

  const closeScore = useCallback(() => setScoreOpen(false), [])
  const scoreWas = useRef(false)

  useEffect(() => {
    // фокус возвращается на кнопку индекса уже после того, как фон перестал быть inert
    if (scoreWas.current && !scoreOpen) chipRef.current?.focus({ preventScroll: true })
    scoreWas.current = scoreOpen
  }, [scoreOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (scoreOpen) {
        if (event.key === 'Escape') closeScore()
        return
      }
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
  }, [selected, scoreOpen, closeScore])

  return (
    <div className="app">
      <header className="top" inert={scoreOpen || undefined}>
        <div className="brand">
          <Mark />
          <div>
            <h1>Системы организма</h1>
            <p className="kicker">Демо · не диагноз</p>
          </div>
        </div>
        <ScoreChip value={INDEX} tone={TONE} buttonRef={chipRef} onOpen={() => setScoreOpen(true)} />
      </header>

      <div className="workspace" inert={scoreOpen || undefined}>
        <div className="stage" onPointerDownCapture={() => setHint(false)}>
          {/* готовый кадр тела: виден сразу, пока качается и собирается настоящая модель */}
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
                  <button className="round at-left" type="button" aria-label="Ко всему телу" onClick={() => setSelected(null)}>
                    <BackIcon />
                  </button>
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
                    />
                    <Fine />
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
                    <ResetIcon />
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
                        <p className="card-kicker">Куда смотреть сначала</p>
                        <strong>Три зоны внимания</strong>
                        <p>{TOP_TEXT}</p>
                        <Legend />
                      </>
                    }
                  >
                    <h3 className="block-title">Все системы</h3>
                    <OverviewList onSelect={setSelected} />
                    <Fine />
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
              <ResetIcon />
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
                    withSummary
                  />
                </>
              ) : (
                <>
                  <article className="card spotlight">
                    <p className="card-kicker">Куда смотреть сначала</p>
                    <h2>Три зоны внимания</h2>
                    <p>{TOP_TEXT}</p>
                  </article>
                  <h3 className="block-title">Все системы</h3>
                  <OverviewList onSelect={setSelected} />
                </>
              )}
              <Fine />
            </div>
          </section>
        )}
      </div>

      {scoreOpen && (
        <IndexSheet
          onClose={closeScore}
          onSelect={(id) => {
            setScoreOpen(false)
            setSelected(id)
          }}
        />
      )}
    </div>
  )
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      {LEVELS.map((item) => (
        <span key={item}>
          <i style={{ background: MESH_COLOR[item] }} />
          {RISK_LABEL[item]}
        </span>
      ))}
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
              <span className="risk-word" style={{ color: RISK_INK[itemLevel] }}>
                {RISK_LABEL[itemLevel]}
                <small>{item.risk}</small>
              </span>
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
  withSummary = false,
}: {
  system: BodySystem
  level: RiskLevel
  backLabel: string
  onBack: () => void
  withSummary?: boolean
}) {
  const [asked, setAsked] = useState(false)
  return (
    <>
      <div className="stats">
        <div className="stat" style={{ background: RISK_SOFT[level] }}>
          <span>Риск</span>
          <b style={{ color: RISK_INK[level] }}>{RISK_LABEL[level]}</b>
        </div>
        <div className="stat">
          <span>Балл из 100</span>
          <b style={{ color: RISK_INK[level] }}>{system.risk}</b>
        </div>
      </div>
      <article className="card">
        {withSummary && <p>{system.summary}</p>}
        <p className={withSummary ? 'meaning' : undefined}>{system.meaning}</p>
      </article>
      <article className="card">
        <h3>Показатели · демо</h3>
        {system.metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.hint}</small>
          </div>
        ))}
      </article>
      <article className="card">
        <h3>Что с этим делать</h3>
        <p>{system.advice}</p>
      </article>
      {asked ? (
        <article className="card">
          <p>Это демо: запись не создаётся. В продукте здесь открылась бы консультация терапевта.</p>
          <button className="text-btn" type="button" onClick={() => setAsked(false)}>
            Понятно
          </button>
        </article>
      ) : (
        <button className="primary" type="button" onClick={() => setAsked(true)}>
          Обсудить с терапевтом
        </button>
      )}
      <button className="text-btn" type="button" onClick={onBack}>
        {backLabel}
      </button>
    </>
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

  useLayoutEffect(() => {
    center(selected, !first.current)
    first.current = false
  }, [selected, center])

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
                <span className="dtag" style={{ color: RISK_INK[itemLevel], background: RISK_SOFT[itemLevel] }}>
                  {RISK_LABEL[itemLevel]} · {item.risk}
                </span>
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

function Fine() {
  return (
    <p className="fine">
      Демо-данные для интерфейса, не медицинское заключение. Модель: Human Reference Atlas, мужской
      референс v1.10,{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
      . Упрощена для телефона.{' '}
      <a href="https://humanatlas.io/3d-reference-library" target="_blank" rel="noreferrer">
        Источник
      </a>
      .
    </p>
  )
}

function ScoreChip({
  value,
  tone,
  onOpen,
  buttonRef,
}: {
  value: number
  tone: string
  onOpen: () => void
  buttonRef: React.Ref<HTMLButtonElement>
}) {
  const color = value >= 75 ? RISK_INK.low : value >= 55 ? RISK_INK.watch : RISK_INK.high
  const circumference = 2 * Math.PI * 16
  return (
    <button
      ref={buttonRef}
      className="score"
      type="button"
      aria-haspopup="dialog"
      aria-label={`Индекс здоровья ${value} из 100. ${tone}. Открыть, как он считается`}
      onClick={onOpen}
    >
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(28, 40, 56, 0.09)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * value) / 100} ${circumference}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <strong style={{ color }}>{value}</strong>
      <span>Индекс</span>
      <svg className="score-chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="mk-bg" x1="6" y1="0" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3ACB61" />
          <stop offset="1" stopColor="#168B32" />
        </linearGradient>
        <radialGradient id="mk-glow" cx="12" cy="4" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="mk-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="#fff" />
          <path
            d="M10 25.4h6.6l2.2-4.6 3.2 8.6 2-4h6"
            fill="none"
            stroke="#000"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <rect width="40" height="40" fill="url(#mk-bg)" />
      <rect width="40" height="40" fill="url(#mk-glow)" />
      <g mask="url(#mk-cut)" transform="translate(20 20.4) scale(1.16) translate(-20 -21)">
        <circle cx="20" cy="11.6" r="3.7" fill="#fff" />
        <rect x="13.4" y="17.2" width="13.2" height="14.2" rx="6.6" fill="#fff" />
      </g>
    </svg>
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
    onMetrics(peek + SHEET_GAP, Math.min(height, maxHeight()) + SHEET_GAP)
  }, [height, peek, onMetrics])

  const maxHeight = () => {
    const stage = sheetRef.current?.parentElement?.clientHeight ?? window.innerHeight
    return Math.max(peekRef.current + 160, Math.round(stage * 0.78))
  }

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

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M16 10a6 6 0 1 1-1.6-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3.5V7h-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
