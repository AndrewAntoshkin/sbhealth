import { useState } from 'react'
import { ArrowRight, CalendarCheck, CaretRight, Stethoscope, TestTube } from '@phosphor-icons/react'
import { IndexSheet } from '../IndexSheet'
import { MESH_COLOR, levelOf, systemById, type SystemId } from '../data/systems'
import { metricIcon } from '../metricIcons'
import { AVATAR, INDEX, TONE } from '../shared'
import { DOCTOR, MODE_LABEL, nextAppointment, resetDemo, setPref, usePrefs, useCore, type Prefs } from '../store'
import { fmtDay, fmtTime, inDays } from '../time'
import { Dock, type DockTab } from './Dock'

const HEIGHT = 178
const WEIGHT = 82
const BMI = WEIGHT / (HEIGHT / 100) ** 2

const ANALYSES: { id: SystemId; at: number; when: string }[] = [
  { id: 'cardiovascular', at: 0, when: 'Октябрь' },
  { id: 'endocrine', at: 0, when: 'Октябрь' },
  { id: 'hematopoietic', at: 0, when: 'Сентябрь' },
  { id: 'hematopoietic', at: 1, when: 'Сентябрь' },
]

const HISTORY = [
  { title: 'Осмотр терапевта', sub: 'Плановый, профилактика', when: '14 мая', icon: Stethoscope },
  { title: 'Липидный профиль', sub: 'Анализ крови', when: '2 мая', icon: TestTube },
]

const SWITCHES: { key: keyof Prefs; title: string; sub: string }[] = [
  { key: 'remind', title: 'Напоминания о приёмах', sub: 'За день и за час до записи' },
  { key: 'tips', title: 'Советы недели', sub: 'Короткие подсказки по вашим системам' },
  { key: 'share', title: 'Делиться данными с врачом', sub: 'По умолчанию при записи' },
]

const fmt = (n: number) => n.toFixed(1).replace('.', ',')

function IndexRing() {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg className="pf-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="#f1b43c" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * INDEX) / 100} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="38" textAnchor="middle" fontSize="19" fontWeight="600" fill="#fff">
        {INDEX}
      </text>
    </svg>
  )
}

export function Profile({ go, onAtlas, onTab }: { go: (to: string) => void; onAtlas: (id?: SystemId) => void; onTab: (tab: DockTab) => void }) {
  const [indexOpen, setIndexOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const { appts } = useCore()
  const prefs = usePrefs()
  const next = nextAppointment(appts)

  return (
    <>
      <main className="screen profile">
        <div className="pf-wrap">
          <header className="pf-id">
            <img className="pf-ava" src={AVATAR} alt="Алексей Морозов" width="320" height="320" decoding="async" fetchPriority="high" draggable={false} />
            <div>
              <h1>Алексей Морозов</h1>
              <p>34 года · Москва</p>
              <p className="pf-chips">
                <span>Демо-профиль</span>
                <span>Группа крови II+</span>
              </p>
            </div>
          </header>

          <div className="pf-col">
            <button type="button" className="pf-index" aria-haspopup="dialog" onClick={() => setIndexOpen(true)}>
              <IndexRing />
              <span>
                <small>Индекс здоровья</small>
                <b>{TONE}</b>
                <em>Как это считается</em>
              </span>
              <CaretRight size={20} weight="bold" aria-hidden="true" />
            </button>

            <section className="hm-sec" aria-labelledby="pf-body">
              <div className="hm-head">
                <h2 id="pf-body">Тело</h2>
              </div>
              <dl className="pf-stats">
                <div>
                  <dt>Рост</dt>
                  <dd>{HEIGHT}<small> см</small></dd>
                </div>
                <div>
                  <dt>Вес</dt>
                  <dd>{WEIGHT}<small> кг</small></dd>
                </div>
                <div>
                  <dt>ИМТ</dt>
                  <dd>{fmt(BMI)}<small className="pf-warn">выше нормы</small></dd>
                </div>
                <div>
                  <dt>Талия</dt>
                  <dd>94<small> см</small></dd>
                </div>
              </dl>
            </section>

            <section className="hm-sec" aria-labelledby="pf-set">
              <div className="hm-head">
                <h2 id="pf-set">Настройки</h2>
              </div>
              <ul className="pf-card pf-set">
                {SWITCHES.map((item) => (
                  <li key={item.key}>
                    <button type="button" role="switch" aria-checked={prefs[item.key]} className="bk-switch-row" onClick={() => setPref(item.key, !prefs[item.key])}>
                      <span>
                        <b>{item.title}</b>
                        <small>{item.sub}</small>
                      </span>
                      <i className={prefs[item.key] ? 'bk-switch is-on' : 'bk-switch'} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {confirmReset ? (
                <div className="nx-actions" role="group" aria-label="Сбросить демо-данные?">
                  <button type="button" className="nx-btn is-dark" onClick={() => { resetDemo(); setConfirmReset(false) }}>
                    Да, сбросить
                  </button>
                  <button type="button" className="nx-btn" onClick={() => setConfirmReset(false)}>
                    Отмена
                  </button>
                </div>
              ) : (
                <button type="button" className="pf-reset" onClick={() => setConfirmReset(true)}>
                  Сбросить демо-данные
                </button>
              )}
            </section>
          </div>

          <div className="pf-col">
            <section className="hm-sec" aria-labelledby="pf-visits">
              <div className="hm-head">
                <h2 id="pf-visits">Приёмы</h2>
              </div>
              <ul className="pf-list">
                {next ? (
                  <li>
                    <button type="button" className="pf-row is-next" onClick={() => go(`#/messages/${DOCTOR.id}`)}>
                      <span className="pf-ico"><CalendarCheck size={22} weight="fill" aria-hidden="true" /></span>
                      <span className="pf-copy">
                        <b>Приём терапевта · {inDays(next.start)}</b>
                        <small>{DOCTOR.name} · {MODE_LABEL[next.mode].toLowerCase()}</small>
                      </span>
                      <span className="pf-val">{fmtDay(next.start).split(', ')[1]}<small>{fmtTime(next.start)}</small></span>
                    </button>
                  </li>
                ) : (
                  <li className="pf-empty">Предстоящих записей нет. Записаться можно из карточки органа или с главной.</li>
                )}
                {HISTORY.map(({ title, sub, when, icon: Icon }) => (
                  <li key={title}>
                    <div className="pf-row">
                      <span className="pf-ico"><Icon size={22} weight="duotone" aria-hidden="true" /></span>
                      <span className="pf-copy">
                        <b>{title}</b>
                        <small>{sub}</small>
                      </span>
                      <span className="pf-val">{when}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="hm-sec" aria-labelledby="pf-labs">
              <div className="hm-head">
                <h2 id="pf-labs">Последние анализы · демо</h2>
                <button type="button" className="hm-link" onClick={() => onAtlas()}>
                  Атлас <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>
              <ul className="pf-list">
                {ANALYSES.map(({ id, at, when }) => {
                  const system = systemById(id)
                  const metric = system.metrics[at]
                  const Icon = metricIcon(metric.label)
                  return (
                    <li key={`${id}-${at}`}>
                      <button type="button" className="pf-row" onClick={() => onAtlas(id)}>
                        <span className="pf-ico"><Icon size={22} weight="duotone" aria-hidden="true" /></span>
                        <span className="pf-copy">
                          <b>{metric.label}</b>
                          <small>{when} · {metric.hint}</small>
                        </span>
                        <span className="pf-val">
                          <i style={{ background: MESH_COLOR[levelOf(system.risk)] }} />
                          {metric.value}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <p className="pf-fine">Демо-данные для интерфейса, не медицинское заключение. Всё хранится только на этом устройстве.</p>
        </div>
      </main>

      <div inert={indexOpen || undefined}>
        <Dock active="profile" onGo={(tab) => onTab(tab)} />
      </div>

      {indexOpen && (
        <IndexSheet
          onClose={() => setIndexOpen(false)}
          onSelect={(id) => {
            setIndexOpen(false)
            onAtlas(id)
          }}
        />
      )}
    </>
  )
}
