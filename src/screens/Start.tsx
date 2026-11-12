import { ArrowRight } from '@phosphor-icons/react'
import { MESH_COLOR, RISK_LABEL, levelOf, systemById, type SystemId } from '../data/systems'
import { Mark, ORGAN_TITLE } from '../shared'

const HERO = `${import.meta.env.BASE_URL}hero.webp`

// три плашки на теле: вся шкала — от спокойного до высокого
const CHIPS: { id: SystemId; style: React.CSSProperties }[] = [
  { id: 'respiratory', style: { left: '47%', top: '19%' } },
  { id: 'cardiovascular', style: { left: '2%', top: '31%' } },
  { id: 'digestive', style: { left: '20%', top: '51%' } },
]

export function Start({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen start">
      <header className="st-top">
        <span className="st-brand">
          <Mark />
          <b>Атлас</b>
        </span>
        <span className="st-demo">Не диагноз</span>
      </header>

      <div className="st-copy">
        <h1>Куда смотреть в первую очередь</h1>
        <p>Тринадцать систем организма на 3D-модели. Цвет — уровень риска, нажатие — подробности.</p>
      </div>

      <div className="st-hero" aria-hidden="true">
        <img src={HERO} alt="" width="900" height="1100" fetchPriority="high" decoding="async" draggable={false} />
        {CHIPS.map(({ id, style }, i) => {
          const level = levelOf(systemById(id).risk)
          return (
            <span className="st-chip" key={id} style={{ ...style, ['--d' as string]: `${0.7 + i * 0.14}s` }}>
              <i style={{ background: MESH_COLOR[level] }} />
              <b>{ORGAN_TITLE[id]}</b>
              <em>{RISK_LABEL[level]}</em>
            </span>
          )
        })}
      </div>

      <div className="st-cta">
        <button className="primary st-go" type="button" onClick={onStart}>
          Начать
          <span className="st-go-icon">
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </span>
        </button>
        <p>Тестовые данные, не медицинское заключение</p>
      </div>
    </main>
  )
}
