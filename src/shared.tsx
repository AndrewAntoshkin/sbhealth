import { MESH_COLOR, RISK_INK, RISK_LABEL, RISK_SOFT, healthIndex, indexTone, systemsByRisk, type RiskLevel, type SystemId } from './data/systems'

export const ORGAN_TITLE: Record<SystemId, string> = {
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

export const thumb = (id: SystemId) => `${import.meta.env.BASE_URL}organs/${id}.webp`

export const AVATAR = `${import.meta.env.BASE_URL}avatar.webp`

export const photo = (id: SystemId) => `${import.meta.env.BASE_URL}organs/lg/${id}.webp`

export const ORDER = systemsByRisk()
export const INDEX = healthIndex()
export const TONE = indexTone(INDEX)
export const LEVELS: RiskLevel[] = ['low', 'watch', 'elevated', 'high']
export const TOP = ORDER.slice(0, 3).map((item) => item.name.toLowerCase())
export const TOP_TEXT = `Выше остальных ${TOP[0]}, ${TOP[1]} и ${TOP[2]}. Цвет на модели — это риск, не диагноз.`

export function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      {LEVELS.map((item) => (
        <span key={item} style={{ ['--c' as string]: MESH_COLOR[item] }}>
          {RISK_LABEL[item]}
        </span>
      ))}
    </div>
  )
}

/** Шкала из делений: сколько из 100 занято риском. */
export function Meter({ value, level }: { value: number; level: RiskLevel }) {
  const total = 32
  const filled = Math.round((value / 100) * total)
  return (
    <div className="meter" role="img" aria-label={`${value} из 100`} style={{ ['--c' as string]: MESH_COLOR[level] }}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : undefined} style={{ ['--i' as string]: i }} />
      ))}
    </div>
  )
}

/** Подпись риска цветом уровня. */
export function RiskTag({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span className="risk-tag-pill" style={{ color: RISK_INK[level], background: RISK_SOFT[level] }}>
      <i style={{ background: MESH_COLOR[level] }} />
      {RISK_LABEL[level]}
      {score !== undefined && <b>{score}</b>}
    </span>
  )
}

export function Fine() {
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

export function Mark() {
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

export function ScoreChip({
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

