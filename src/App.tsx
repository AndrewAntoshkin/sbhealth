import { useEffect, useState } from 'react'
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
  type RiskLevel,
  type SystemId,
} from './data/systems'

const ORGAN_TITLE: Record<SystemId, string> = {
  cardiovascular: 'Сердце',
  nervous: 'Головной мозг',
  endocrine: 'Поджелудочная',
  musculoskeletal: 'Позвоночник',
  digestive: 'Печень',
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

export function App() {
  const [selected, setSelected] = useState<SystemId | null>(null)
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const wide = useWide()
  const system = selected ? systemById(selected) : null
  const level = system ? levelOf(system.risk) : null
  const expanded = wide || open

  useEffect(() => {
    setAsked(false)
    if (!selected) {
      setOpen(false)
      return
    }
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

  const top = ORDER.slice(0, 3).map((item) => item.name.toLowerCase())

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Mark />
          <div>
            <p className="kicker">Демо · не диагноз</p>
            <h1>Системы организма</h1>
            <p className="tone">{TONE}</p>
          </div>
        </div>
        <ScoreRing value={INDEX} />
      </header>

      <div className="workspace">
        <div className={selected && !open ? 'stage is-focus' : 'stage'}>
          <BodyCanvas
            selected={selected}
            resetSignal={resetSignal}
            onSelect={(id) => setSelected(id)}
          />
          {system && level && !open && (
            <div className="focus-ui">
              <button
                className="back"
                type="button"
                aria-label="Ко всему телу"
                onClick={() => setSelected(null)}
              >
                <BackIcon />
              </button>
              {system.metrics.slice(0, 2).map((metric, index) => (
                <div className={index === 0 ? 'float-pill is-a' : 'float-pill is-b'} key={metric.label}>
                  <i style={{ background: MESH_COLOR[level] }} />
                  <b>{metric.value}</b>
                  <span>{metric.label}</span>
                </div>
              ))}
              <div className="organ-card">
                <div>
                  <strong>{ORGAN_TITLE[system.id]}</strong>
                  <p>{system.summary}</p>
                </div>
                <button type="button" aria-label="Подробнее" onClick={() => setOpen(true)}>
                  <ArrowIcon />
                </button>
              </div>
            </div>
          )}
          {!selected && (
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

        <section className={expanded ? 'panel is-open' : 'panel'} aria-label="Системы и риск">
          <button
            className="handle"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Свернуть подробности' : 'Показать подробности'}
            onClick={() => setOpen((value) => !value)}
          >
            <i />
          </button>

          <div className="legend" aria-hidden="true">
            {LEVELS.map((item) => (
              <span key={item}>
                <i style={{ background: MESH_COLOR[item] }} />
                {RISK_LABEL[item]}
              </span>
            ))}
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
                  <p>{system.summary}</p>
                  {expanded && <p className="meaning">{system.meaning}</p>}
                </article>
                {expanded && (
                  <>
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
                    <button className="text-btn" type="button" onClick={() => setSelected(null)}>
                      Все системы
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <article className="card spotlight">
                  <p className="card-kicker">Куда смотреть сначала</p>
                  <h2>Три зоны внимания</h2>
                  <p>{`Выше остальных ${top[0]}, ${top[1]} и ${top[2]}. Цвет на модели — это риск, не диагноз.`}</p>
                </article>
                <h3 className="block-title">Все системы</h3>
                <ul className="overview-list">
                  {ORDER.map((item) => {
                    const itemLevel = levelOf(item.risk)
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => setSelected(item.id)}>
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
              </>
            )}
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
          </div>
        </section>
      </div>
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const tone = value >= 75 ? RISK_INK.low : value >= 55 ? RISK_INK.watch : RISK_INK.high
  return (
    <div className="score" role="img" aria-label={`Индекс здоровья ${value} из 100. Выше — спокойнее.`}>
      <strong style={{ color: tone }}>{value}</strong>
      <span>из 100</span>
    </div>
  )
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#21A038" />
      <circle cx="20" cy="12" r="3.4" fill="#fff" />
      <path fill="#fff" d="M14.2 18.4c.2-2 2-3.2 5.8-3.2s5.6 1.2 5.8 3.2V28c0 1.7-1.2 2.8-3 2.8h-5.6c-1.8 0-3-1.1-3-2.8V18.4z" />
      <circle cx="23.6" cy="21.6" r="1.7" fill="#FF0D65" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
