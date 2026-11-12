import { useEffect, useState } from 'react'
import {
  MESH_COLOR,
  RISK_INK,
  RISK_LABEL,
  RISK_SOFT,
  SYSTEMS,
  indexTone,
  levelOf,
  systemsByRisk,
  type RiskLevel,
  type SystemId,
} from './data/systems'

const LEVELS: RiskLevel[] = ['low', 'watch', 'elevated', 'high']
const ORDER = systemsByRisk()
const COUNT = SYSTEMS.length
const RESERVE = SYSTEMS.reduce((sum, item) => sum + (100 - item.risk), 0)
const RAW = RESERVE / COUNT
const INDEX = Math.round(RAW)
const MEAN_RISK = 100 - RAW
const TOP3 = ORDER.slice(0, 3)
const LOSS = 100 - RAW

/** Демо-динамика: последний столбик всегда равен текущему индексу. */
const TREND = [7, 6, 6, 4, 3, 2, 1, 0].map((delta) => INDEX + delta)

const fmt = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',')
const toneInk = (value: number) => (value >= 75 ? RISK_INK.low : value >= 55 ? RISK_INK.watch : RISK_INK.high)
const toneSoft = (value: number) => (value >= 75 ? RISK_SOFT.low : value >= 55 ? RISK_SOFT.watch : RISK_SOFT.high)

export function IndexContent({ onSelect }: { onSelect: (id: SystemId) => void }) {
  const [shown, setShown] = useState(false)
  const [what, setWhat] = useState<SystemId>(TOP3[0].id)
  const [delta, setDelta] = useState(20)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const picked = SYSTEMS.find((item) => item.id === what) ?? TOP3[0]
  const gainRisk = Math.min(delta, picked.risk)
  const nextRaw = (RESERVE + gainRisk) / COUNT
  const nextIndex = Math.round(nextRaw)
  const gain = nextRaw - RAW

  const median = ORDER[Math.floor(ORDER.length / 2)]
  const examples = [ORDER[0], median, ORDER[ORDER.length - 1]]

  const counts = LEVELS.map((level) => ({
    level,
    n: SYSTEMS.filter((item) => levelOf(item.risk) === level).length,
  }))

  return (
    <div className="ix-page">
      <div className="ix-col">
        <section className="card ix-hero">
            <div className="ix-hero-top">
              <Ring value={INDEX} shown={shown} />
              <div>
                <span className="ix-tone" style={{ color: toneInk(INDEX), background: toneSoft(INDEX) }}>
                  {indexTone(INDEX)}
                </span>
                <p>
                  Это среднее «запаса» по {COUNT} системам. Для каждой берём 100 минус риск: чем выше число,
                  тем спокойнее картина.
                </p>
              </div>
            </div>
            <Scale value={INDEX} />
          </section>
        <section className="card">
            <h3>Из чего складывается</h3>
            <p className="ix-sub">Риск по каждой системе. Пунктир — средний риск ({fmt(MEAN_RISK, 0)}). Нажмите на строку, чтобы открыть орган.</p>
            <div className="ix-bars">
              {ORDER.map((item, index) => {
                const level = levelOf(item.risk)
                return (
                  <button
                    key={item.id}
                    className="ix-row"
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-label={`${item.name}: риск ${item.risk}, ${RISK_LABEL[level]}. Открыть`}
                  >
                    <span className="ix-name">{item.short}</span>
                    <span className="ix-track" style={{ ['--mean' as string]: MEAN_RISK }}>
                      <span
                        className="ix-fill"
                        style={{ ['--v' as string]: item.risk, ['--i' as string]: index, background: MESH_COLOR[level] }}
                      />
                    </span>
                    <b className="ix-val" style={{ color: RISK_INK[level] }}>
                      {item.risk}
                    </b>
                  </button>
                )
              })}
            </div>
          </section>
        <section className="card">
            <h3>Что тянет индекс вниз</h3>
            <p className="ix-sub">Сколько пунктов из {fmt(LOSS, 0)} потерянных даёт каждая система.</p>
            {TOP3.map((item, index) => {
              const points = item.risk / COUNT
              const level = levelOf(item.risk)
              return (
                <button key={item.id} className="ix-load" type="button" onClick={() => onSelect(item.id)}>
                  <span className="ix-load-top">
                    <span>{index + 1}. {item.name}</span>
                    <b style={{ color: RISK_INK[level] }}>−{fmt(points)}</b>
                  </span>
                  <span className="ix-track">
                    <span
                      className="ix-fill"
                      style={{ ['--v' as string]: (points / (TOP3[0].risk / COUNT)) * 100, ['--i' as string]: index, background: MESH_COLOR[level] }}
                    />
                  </span>
                  <small>{fmt((points / LOSS) * 100, 0)}% от всей потери</small>
                </button>
              )
            })}
          </section>
      </div>
      <div className="ix-col">
        <section className="card">
            <h3>Пример расчёта</h3>
            <p className="ix-sub">Берём запас каждой системы, складываем и делим на {COUNT}.</p>
            {examples.map((item) => (
              <div className="ix-calc" key={item.id}>
                <span>{item.name}</span>
                <b>
                  100 − {item.risk} = <em style={{ color: RISK_INK[levelOf(item.risk)] }}>{100 - item.risk}</em>
                </b>
              </div>
            ))}
            <div className="ix-calc is-dim">
              <span>…и ещё {COUNT - examples.length} систем</span>
              <b>Σ = {RESERVE}</b>
            </div>
            <div className="ix-total">
              <span>
                {RESERVE} ÷ {COUNT} = {fmt(RAW)}
              </span>
              <strong style={{ color: toneInk(INDEX) }}>
                {INDEX}
                <small> — округляем</small>
              </strong>
            </div>
          </section>
        <section className="card">
            <h3>Сколько систем в каждой зоне</h3>
            <div className="ix-seg" role="img" aria-label={counts.map((c) => `${RISK_LABEL[c.level]}: ${c.n}`).join(', ')}>
              {counts
                .filter((c) => c.n > 0)
                .map((c) => (
                  <i key={c.level} style={{ ['--n' as string]: c.n, ['--c' as string]: MESH_COLOR[c.level] }}>
                    {c.n}
                  </i>
                ))}
            </div>
            <div className="ix-legend">
              {counts.map((c) => (
                <span key={c.level}>
                  <i style={{ background: MESH_COLOR[c.level] }} />
                  {RISK_LABEL[c.level]}
                  <b>{c.n}</b>
                </span>
              ))}
            </div>
          </section>
        <section className="card">
            <div className="ix-title-row">
              <h3>Динамика за 8 недель</h3>
            </div>
            <p className="ix-sub">
              Так индекс выглядел бы при регулярных анализах: за два месяца он снизился на {TREND[0] - INDEX}.
            </p>
            <Trend values={TREND} shown={shown} />
            <div className="ix-weeks">
              <span>8 нед. назад</span>
              <span>сейчас</span>
            </div>
          </section>
        <section className="card">
            <h3>А если улучшить?</h3>
            <p className="ix-sub">Выберите систему и сдвиньте ползунок, насколько снизится риск.</p>
            <div className="ix-picks" role="group" aria-label="Система для примера">
              {TOP3.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ix-pick"
                  aria-pressed={item.id === what}
                  onClick={() => setWhat(item.id)}
                >
                  {item.short}
                </button>
              ))}
            </div>
            <label className="ix-range-row">
              <span>
                Риск снизится на <b>{delta}</b>
              </span>
              <input
                className="ix-range"
                type="range"
                min={0}
                max={40}
                step={5}
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value))}
                style={{ ['--p' as string]: `${(delta / 40) * 100}%` }}
              />
            </label>
            <div className="ix-result">
              <div>
                <span>Сейчас</span>
                <b>{INDEX}</b>
              </div>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="is-next">
                <span>Станет</span>
                <b style={{ color: toneInk(nextIndex) }}>{nextIndex}</b>
              </div>
              <em style={{ color: toneInk(nextIndex), background: toneSoft(nextIndex) }}>+{fmt(gain)}</em>
            </div>
            <Scale value={nextIndex} ghost={INDEX} compact />
            <p className="ix-tip">
              <b>Что для этого сделать.</b> {picked.advice}
            </p>
          </section>
      </div>
      <p className="fine ix-fine">
            Расчёт показательный: риски не являются диагнозом и служат ориентиром, куда посмотреть в первую очередь.
          </p>
    </div>
  )
}

function Ring({ value, shown }: { value: number; shown: boolean }) {
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const color = toneInk(value)
  return (
    <div className="ix-ring" role="img" aria-label={`${value} из 100`}>
      <svg viewBox="0 0 120 120" width="116" height="116" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(28, 40, 56, 0.08)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${shown ? (circumference * value) / 100 : 0} ${circumference}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div>
        <strong style={{ color }}>{value}</strong>
        <span>из 100</span>
      </div>
    </div>
  )
}

function Scale({ value, ghost, compact }: { value: number; ghost?: number; compact?: boolean }) {
  const pos = (v: number) => Math.min(97, Math.max(3, v))
  return (
    <div className={`ix-scale${compact ? ' is-compact' : ''}`}>
      <div className="ix-rail">
        <div className="ix-zones" aria-hidden="true">
          <i style={{ flex: 55, background: MESH_COLOR.high }} />
          <i style={{ flex: 20, background: MESH_COLOR.watch }} />
          <i style={{ flex: 25, background: MESH_COLOR.low }} />
        </div>
        {ghost !== undefined && ghost !== value && <span className="ix-dot is-ghost" style={{ left: `${pos(ghost)}%` }} />}
        <span className="ix-dot" style={{ left: `${pos(value)}%`, borderColor: toneInk(value) }} />
      </div>
      <div className="ix-ticks" aria-hidden="true">
        <span style={{ left: '0%' }}>0</span>
        <span style={{ left: '55%' }}>55</span>
        <span style={{ left: '75%' }}>75</span>
        <span style={{ left: '100%' }}>100</span>
      </div>
      {!compact && (
        <div className="ix-zone-names" aria-hidden="true">
          <span style={{ flex: 55 }}>Стоит разобраться</span>
          <span style={{ flex: 20 }}>Внимание</span>
          <span style={{ flex: 25 }}>Спокойно</span>
        </div>
      )}
    </div>
  )
}

function Trend({ values, shown }: { values: number[]; shown: boolean }) {
  const width = 320
  const height = 150
  const left = 10
  const right = 34
  const top = 14
  const bottom = 12
  const min = 52
  const max = 78
  const x = (index: number) => left + ((width - left - right) * index) / (values.length - 1)
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom)
  const points = values.map((value, index) => [x(index), y(value)] as const)

  let path = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    path += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`
  }
  const last = points[points.length - 1]
  const area = `${path} L ${last[0]} ${height - bottom} L ${points[0][0]} ${height - bottom} Z`
  const color = toneInk(values[values.length - 1])

  return (
    <svg
      className={`ix-chart${shown ? ' is-shown' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Индекс за 8 недель: от ${values[0]} до ${values[values.length - 1]}`}
    >
      <defs>
        <linearGradient id="ix-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.26" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[75, 55].map((line) => (
        <g key={line}>
          <line x1={left} x2={width - right + 8} y1={y(line)} y2={y(line)} stroke="rgba(28,40,56,0.14)" strokeDasharray="3 4" />
          <text x={width - right + 14} y={y(line) + 3.5} fontSize="10" fontWeight="600" fill="#6d7682">
            {line}
          </text>
        </g>
      ))}
      <path className="ix-area" d={area} fill="url(#ix-area)" />
      <path className="ix-line" d={path} pathLength={1} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([px, py], index) => (
        <circle key={index} cx={px} cy={py} r={index === points.length - 1 ? 0 : 2.4} fill="#fff" stroke={color} strokeWidth="1.6" />
      ))}
      <g className="ix-end">
        <circle cx={last[0]} cy={last[1]} r="9" fill={color} opacity="0.16" />
        <circle cx={last[0]} cy={last[1]} r="5" fill="#fff" stroke={color} strokeWidth="3" />
        <rect x={last[0] - 15} y={last[1] - 31} width="30" height="20" rx="8" fill={color} />
        <text x={last[0]} y={last[1] - 17.5} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff">
          {values[values.length - 1]}
        </text>
      </g>
    </svg>
  )
}
