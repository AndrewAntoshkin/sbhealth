import { useRef, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { doctorPhoto, doctorById } from '../data/doctors'
import { MESH_COLOR, RISK_LABEL, RISK_SOFT, levelOf, systemById, type SystemId } from '../data/systems'
import { Legend, Mark, ORGAN_TITLE, RiskTag, thumb } from '../shared'

const HERO = `${import.meta.env.BASE_URL}hero.webp`

// три плашки на теле: вся шкала от спокойного до высокого
const CHIPS: { id: SystemId; style: React.CSSProperties }[] = [
  { id: 'respiratory', style: { left: '50%', top: '17%' } },
  { id: 'cardiovascular', style: { left: '0%', top: '30%' } },
  { id: 'digestive', style: { left: '16%', top: '52%' } },
]

// четыре органа с разным уровнем: вся шкала цвета в одном кадре
const TILES: SystemId[] = ['cardiovascular', 'respiratory', 'nervous', 'digestive']

const SLIDES = [
  { id: 'body', title: 'Всё тело на одном экране' },
  { id: 'color', title: 'Цвет показывает, куда смотреть' },
  { id: 'doctor', title: 'Врач рядом, когда нужно' },
]

function BodyVisual() {
  return (
    <div className="st-visual is-body" aria-hidden="true">
      <div className="st-bodybox">
        <img src={HERO} alt="" width="900" height="1100" fetchPriority="high" decoding="async" draggable={false} />
        {CHIPS.map(({ id, style }, i) => {
          const level = levelOf(systemById(id).risk)
          return (
            <span className="st-chip" key={id} style={{ ...style, ['--d' as string]: `${0.5 + i * 0.14}s` }}>
              <i style={{ background: MESH_COLOR[level] }} />
              <b>{ORGAN_TITLE[id]}</b>
              <em>{RISK_LABEL[level]}</em>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function ColorVisual() {
  return (
    <div className="st-visual is-color" aria-hidden="true">
      <ul className="st-tiles">
        {TILES.map((id) => {
          const system = systemById(id)
          const level = levelOf(system.risk)
          return (
            <li key={id} style={{ background: RISK_SOFT[level] }}>
              <img src={thumb(id)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
              <b>{ORGAN_TITLE[id]}</b>
              <RiskTag level={level} />
            </li>
          )
        })}
      </ul>
      <Legend />
    </div>
  )
}

function DoctorVisual() {
  const main = doctorById('levin')
  return (
    <div className="st-visual is-doctor" aria-hidden="true">
      <div className="st-docbox">
      {(['sokolova', 'orlova'] as const).map((id, i) => (
        <img key={id} className={i === 0 ? 'st-ava is-a' : 'st-ava is-b'} src={doctorPhoto(id)} alt="" width="360" height="360" loading="lazy" decoding="async" draggable={false} />
      ))}
      <figure className="st-person">
        <img src={doctorPhoto(main.id)} alt="" width="360" height="360" loading="lazy" decoding="async" draggable={false} />
        <figcaption>
          <b>{main.name}</b>
          <span>{main.role}</span>
        </figcaption>
      </figure>
      </div>
    </div>
  )
}

const VISUALS = [BodyVisual, ColorVisual, DoctorVisual]

export function Start({ onStart }: { onStart: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const next = Math.round(el.scrollLeft / el.clientWidth)
    if (next !== index) setIndex(next)
  }

  const goTo = (i: number) => {
    const el = track.current
    if (!el) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: i * el.clientWidth, behavior: calm ? 'auto' : 'smooth' })
  }

  return (
    <main className="screen start">
      <header className="st-top">
        <span className="st-brand">
          <Mark />
          <b>Атлас</b>
        </span>
      </header>

      <div className="st-track" ref={track} onScroll={onScroll}>
        {SLIDES.map((slide, i) => {
          const Visual = VISUALS[i]
          const Heading = i === 0 ? 'h1' : 'h2'
          return (
            <section className="st-slide" key={slide.id} aria-roledescription="слайд" aria-label={`${i + 1} из ${SLIDES.length}`}>
              <Heading>{slide.title}</Heading>
              <Visual />
            </section>
          )
        })}
      </div>

      <div className="st-foot">
        <div className="st-dots" role="group" aria-label="Слайды">
          {SLIDES.map((slide, i) => (
            <button key={slide.id} type="button" className={i === index ? 'is-on' : undefined} aria-label={`Слайд ${i + 1}`} aria-current={i === index ? 'true' : undefined} onClick={() => goTo(i)} />
          ))}
        </div>
        <button className="primary st-go" type="button" onClick={onStart}>
          Начать
          <span className="st-go-icon">
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </span>
        </button>
      </div>
    </main>
  )
}
