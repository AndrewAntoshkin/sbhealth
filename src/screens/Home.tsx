import { useCallback, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Info } from '@phosphor-icons/react'
import { IndexSheet } from '../IndexSheet'
import { MESH_COLOR, RISK_SOFT, levelOf, systemById, type SystemId } from '../data/systems'
import { Fine, INDEX, Mark, ORDER, ORGAN_TITLE, RiskTag, TONE, thumb } from '../shared'
import { Dock, type DockTab } from './Dock'

const HERO = `${import.meta.env.BASE_URL}hero.webp`

const ATTENTION = ORDER.slice(0, 3)
const REST = ORDER.slice(3)

// показатели недели: по одному-два из самых заметных систем
const READINGS: { id: SystemId; at: number }[] = [
  { id: 'cardiovascular', at: 0 },
  { id: 'cardiovascular', at: 1 },
  { id: 'endocrine', at: 0 },
  { id: 'nervous', at: 0 },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function today() {
  const text = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function Home({ onAtlas }: { onAtlas: (id?: SystemId) => void }) {
  const [indexOpen, setIndexOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)

  const openIndex = useCallback((from: HTMLElement | null) => {
    opener.current = from
    setIndexOpen(true)
  }, [])
  const closeIndex = useCallback(() => {
    setIndexOpen(false)
    // вернуть фокус после того, как фон перестанет быть inert
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }))
  }, [])

  const onTab = (tab: DockTab, el: HTMLElement) => {
    if (tab === 'atlas') onAtlas()
    if (tab === 'index') openIndex(el)
  }

  return (
    <>
      <main className="screen home" inert={indexOpen || undefined}>
        <div className="hm-wrap">
          <header className="hm-top">
            <div>
              <p>{today()}</p>
              <h1>{greeting()}</h1>
            </div>
            <Mark />
          </header>

          <section className="hm-hero" aria-label="Индекс здоровья">
            <img src={HERO} alt="" width="900" height="1100" decoding="async" fetchPriority="high" draggable={false} />
            <div className="hm-hero-copy">
              <p className="hm-label">Индекс здоровья</p>
              <p className="hm-index">
                <b>{INDEX}</b>
                <span>/100</span>
              </p>
              <p className="hm-tone">{TONE}</p>
              <div className="hm-hero-actions">
                <button className="hm-open" type="button" onClick={() => onAtlas()}>
                  Открыть атлас
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </button>
                <button
                  className="hm-info"
                  type="button"
                  aria-label="Как считается индекс"
                  aria-haspopup="dialog"
                  onClick={(event) => openIndex(event.currentTarget)}
                >
                  <Info size={20} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <section className="hm-sec hm-att" aria-labelledby="hm-att">
            <div className="hm-head">
              <h2 id="hm-att">Требуют внимания</h2>
              <button type="button" className="hm-link" onClick={() => onAtlas()}>
                Весь атлас
              </button>
            </div>
            <div className="hm-bento">
              {ATTENTION.map((item, i) => {
                const level = levelOf(item.risk)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={i === 0 ? 'tile is-wide' : 'tile'}
                    style={{ ['--soft' as string]: RISK_SOFT[level], ['--c' as string]: MESH_COLOR[level] }}
                    onClick={() => onAtlas(item.id)}
                  >
                    <img src={thumb(item.id)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
                    <span className="tile-body">
                      <span className="tile-name">{ORGAN_TITLE[item.id]}</span>
                      <RiskTag level={level} score={item.risk} />
                      {i === 0 && <span className="tile-sum">{item.summary}</span>}
                    </span>
                    <span className="tile-go" aria-hidden="true">
                      <ArrowUpRight size={16} weight="bold" />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="hm-sec hm-read" aria-labelledby="hm-read">
            <div className="hm-head">
              <h2 id="hm-read">Показатели недели · демо</h2>
            </div>
            <ul className="hm-readings">
              {READINGS.map(({ id, at }) => {
                const system = systemById(id)
                const metric = system.metrics[at]
                return (
                  <li key={`${id}-${at}`}>
                    <button type="button" onClick={() => onAtlas(id)}>
                      <i style={{ background: MESH_COLOR[levelOf(system.risk)] }} />
                      <span className="rd-name">
                        {metric.label}
                        <small>{metric.hint}</small>
                      </span>
                      <b>{metric.value}</b>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="hm-sec hm-rest" aria-labelledby="hm-all">
            <div className="hm-head">
              <h2 id="hm-all">Остальные системы</h2>
            </div>
            <ul className="hm-rail">
              {REST.map((item) => {
                const level = levelOf(item.risk)
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => onAtlas(item.id)} style={{ ['--soft' as string]: RISK_SOFT[level] }}>
                      <span className="rail-thumb">
                        <img src={thumb(item.id)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
                      </span>
                      <span className="rail-name">{ORGAN_TITLE[item.id]}</span>
                      <RiskTag level={level} score={item.risk} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <Fine />
        </div>
      </main>

      <div inert={indexOpen || undefined}>
        <Dock active="home" onGo={onTab} />
      </div>

      {indexOpen && (
        <IndexSheet
          onClose={closeIndex}
          onSelect={(id) => {
            setIndexOpen(false)
            onAtlas(id)
          }}
        />
      )}
    </>
  )
}
