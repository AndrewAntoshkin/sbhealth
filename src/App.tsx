import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { BodyCanvas } from './scene/BodyCanvas'
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
    <div className="app">
      <header className="top">
        <div className="brand">
          <Mark />
          <div>
            <h1>Системы организма</h1>
            <p className="kicker">Демо · не диагноз</p>
          </div>
        </div>
        <ScoreChip value={INDEX} tone={TONE} />
      </header>

      <div className="workspace">
        <div className="stage" onPointerDownCapture={() => setHint(false)}>
          <BodyCanvas
            selected={selected}
            resetSignal={resetSignal}
            peek={wide ? 0 : peek}
            inset={wide ? 0 : inset}
            onSelect={(id) => setSelected(id)}
          />

          {!wide && (
            <div className="phone-ui">
              {system && level ? (
                <>
                  <button className="round at-left" type="button" aria-label="Ко всему телу" onClick={() => setSelected(null)}>
                    <BackIcon />
                  </button>
                  <div className="pill-row" style={{ bottom: peek + 12 }}>
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
                    grab={
                      <>
                        <div className="sheet-head">
                          <strong>{ORGAN_TITLE[system.id]}</strong>
                          <span className="risk-tag" style={{ background: RISK_SOFT[level], color: RISK_INK[level] }}>
                            {RISK_LABEL[level]} · {system.risk}
                          </span>
                        </div>
                        <p>{system.summary}</p>
                      </>
                    }
                    rail={<OrganRail selected={system.id} onSelect={setSelected} />}
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
                <i style={{ background: MESH_COLOR[itemLevel] }} />
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

function OrganRail({ selected, onSelect }: { selected: SystemId; onSelect: (id: SystemId) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rail = ref.current
    const active = rail?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!rail || !active) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollTo({
      left: active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [selected])

  return (
    <div className="organ-rail" ref={ref} role="group" aria-label="Другие системы">
      {ORDER.map((item) => {
        const itemLevel = levelOf(item.risk)
        const on = item.id === selected
        return (
          <button
            key={item.id}
            type="button"
            className={on ? 'rcard is-on' : 'rcard'}
            aria-pressed={on}
            style={{
              ['--c' as string]: MESH_COLOR[itemLevel],
              background: on ? RISK_SOFT[itemLevel] : undefined,
            }}
            onClick={() => onSelect(item.id)}
          >
            <span className="rdot" style={{ background: on ? 'rgba(255,255,255,0.7)' : RISK_SOFT[itemLevel] }}>
              <i style={{ background: MESH_COLOR[itemLevel] }} />
            </span>
            <span className="rtext">
              <b>{ORGAN_TITLE[item.id]}</b>
              <small style={{ color: RISK_INK[itemLevel] }}>
                {RISK_LABEL[itemLevel]} · {item.risk}
              </small>
            </span>
          </button>
        )
      })}
    </div>
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

function ScoreChip({ value, tone }: { value: number; tone: string }) {
  const color = value >= 75 ? RISK_INK.low : value >= 55 ? RISK_INK.watch : RISK_INK.high
  const circumference = 2 * Math.PI * 16
  return (
    <div className="score" role="img" aria-label={`Индекс здоровья ${value} из 100. ${tone}. Выше — спокойнее.`}>
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
    </div>
  )
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" fill="#21A038" />
      <circle cx="20" cy="12" r="3.4" fill="#fff" />
      <path fill="#fff" d="M14.2 18.4c.2-2 2-3.2 5.8-3.2s5.6 1.2 5.8 3.2V28c0 1.7-1.2 2.8-3 2.8h-5.6c-1.8 0-3-1.1-3-2.8V18.4z" />
      <circle cx="23.6" cy="21.6" r="1.7" fill="#FF0D65" />
    </svg>
  )
}

const SHEET_GAP = 12

function Sheet({
  grab,
  rail,
  children,
  label,
  resetKey,
  onMetrics,
}: {
  grab: ReactNode
  rail?: ReactNode
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
    onMetrics(peek + SHEET_GAP, height + SHEET_GAP)
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

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const now = performance.now()
    const dt = Math.max(now - state.lastT, 1)
    state.v = (state.lastY - event.clientY) / dt
    state.lastY = event.clientY
    state.lastT = now
    const delta = state.y - event.clientY
    if (Math.abs(delta) > 5) state.moved = true
    setH(Math.min(maxHeight(), Math.max(peekRef.current, state.h + delta)))
  }

  const onUp = () => {
    const state = drag.current
    if (!state) return
    drag.current = null
    setDragging(false)
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

  const grown = height > peek + 28
  const className = ['sheet', grown && 'is-grown', dragging && 'is-dragging'].filter(Boolean).join(' ')

  return (
    <>
      {grown && <div className="sheet-scrim" onClick={() => setH(peekRef.current)} aria-hidden="true" />}
      <section ref={sheetRef} className={className} style={height ? { height } : undefined} aria-label={label}>
        <div ref={headRef} className="sheet-top">
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
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              setH(grown ? peekRef.current : maxHeight())
            }}
          >
            <i />
            {grab}
          </div>
          {rail}
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
  const query = '(min-width: 960px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setWide(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return wide
}
