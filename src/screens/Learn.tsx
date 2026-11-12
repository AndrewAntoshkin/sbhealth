import { ArrowRight, BookOpenText, CaretLeft, Check } from '@phosphor-icons/react'
import { ARTICLES, articleById } from '../data/articles'
import { doctorById } from '../data/doctors'
import { MESH_COLOR, RISK_SOFT, levelOf, systemById, type SystemId } from '../data/systems'
import { DoctorAva, ORGAN_TITLE, thumb } from '../shared'
import { Dock, type DockTab } from './Dock'

function Tile({ systemId }: { systemId?: SystemId }) {
  if (!systemId) return <span className="ln-mark" aria-hidden="true"><BookOpenText size={30} weight="duotone" /></span>
  return <img src={thumb(systemId)} alt="" width="256" height="256" decoding="async" draggable={false} />
}

export function Learn({ id, go, onTab, onAtlas }: { id: string | null; go: (to: string) => void; onTab: (tab: DockTab) => void; onAtlas: (id: SystemId) => void }) {
  const article = id ? articleById(id) : null
  const system = article?.systemId ? systemById(article.systemId) : null
  const level = system ? levelOf(system.risk) : null
  const doctor = article?.doctorId ? doctorById(article.doctorId) : null

  return (
    <>
      <main className="screen learn">
        <div className="ln-wrap">
          <button type="button" className="back ln-back" aria-label={article ? 'К статьям' : 'На главную'} onClick={() => go(article ? '#/learn' : '#/home')}>
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          {article ? (
            <article className="ln-article" style={level ? { ['--soft' as string]: RISK_SOFT[level], ['--c' as string]: MESH_COLOR[level] } : undefined}>
              <header className="ln-hero">
                <span className="ln-art">
                  <Tile systemId={article.systemId} />
                </span>
                <p className="ln-kicker">
                  {article.kicker} · {article.minutes} мин чтения
                </p>
                <h1>{article.title}</h1>
                <p className="ln-lead">{article.lead}</p>
              </header>

              <div className="ln-text">
                {article.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>

              {article.list && (
                <section className="pf-card ln-list" aria-label={article.list.title}>
                  <h2>{article.list.title}</h2>
                  <ul>
                    {article.list.items.map((item) => (
                      <li key={item}>
                        <Check size={16} weight="bold" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="ln-next">
                {article.systemId && (
                  <button type="button" className="nx-btn" onClick={() => onAtlas(article.systemId as SystemId)}>
                    Показать в атласе: {ORGAN_TITLE[article.systemId]}
                  </button>
                )}
                {doctor && (
                  <button type="button" className="ln-doc" onClick={() => go(`#/doctors/${doctor.id}`)}>
                    <DoctorAva id={doctor.id} size={52} />
                    <span>
                      <small>Спросить врача</small>
                      <b>{doctor.name}</b>
                      <em>{doctor.role}</em>
                    </span>
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="pf-fine">Материал носит справочный характер и не заменяет консультацию врача.</p>
            </article>
          ) : (
            <>
              <header className="tab-head ln-head">
                <div>
                  <h1>Полезное</h1>
                  <p>Короткие объяснения без лишних слов</p>
                </div>
              </header>
              <ul className="ln-list-all">
                {ARTICLES.map((a, i) => {
                  const sys = a.systemId ? systemById(a.systemId) : null
                  const lv = sys ? levelOf(sys.risk) : null
                  return (
                    <li key={a.id} className={i === 0 ? 'is-first' : undefined}>
                      <button type="button" className="ln-item" style={lv ? { ['--soft' as string]: RISK_SOFT[lv] } : undefined} onClick={() => go(`#/learn/${a.id}`)}>
                        <span className="ln-art">
                          <Tile systemId={a.systemId} />
                        </span>
                        <span className="ln-copy">
                          <small>
                            {a.kicker} · {a.minutes} мин
                          </small>
                          <b>{a.title}</b>
                          <span>{a.lead}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </main>

      <Dock active={null} onGo={(tab) => onTab(tab)} />
    </>
  )
}
