import { useCallback, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpenText, ChatCircleText, Info, VideoCamera, Buildings } from '@phosphor-icons/react'
import { Booking } from '../Booking'
import { ARTICLES } from '../data/articles'
import { doctorById, doctorFor, roleTo, threadOf } from '../data/doctors'
import { IndexSheet } from '../IndexSheet'
import { TopActions } from '../TopActions'
import { NavBar } from '../NavBar'
import { queueQuestion, suggestions } from '../assistant'
import { AiMark } from './Assistant'
import { DURATION, MODE_LABEL, nextAppointment, useCore, type Appointment } from '../store'
import { cap, fmtDay, fmtDayLong, fmtTime, inDays } from '../time'
import { MESH_COLOR, RISK_SOFT, levelOf, systemById, type SystemId } from '../data/systems'
import { AVATAR, DoctorAva, INDEX, ORDER, ORGAN_TITLE, RiskTag, TONE, thumb } from '../shared'
import { Dock, type DockTab } from './Dock'

const HERO = `${import.meta.env.BASE_URL}hero.webp`

const ATTENTION = ORDER.slice(0, 3)

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

export function Home({ onAtlas, go, open }: { onAtlas: (id?: SystemId) => void; go: (to: string) => void; open?: 'index' }) {
  const [indexOpen, setIndexOpen] = useState(open === 'index')
  const [booking, setBooking] = useState<{ systemId: SystemId; replace?: Appointment } | null>(null)
  const core = useCore()
  const appt = nextAppointment(core.appts)
  const overlay = indexOpen || booking !== null

  const opener = useRef<HTMLElement | null>(null)

  const openIndex = useCallback((from: HTMLElement | null) => {
    opener.current = from
    setIndexOpen(true)
  }, [])
  const closeIndex = useCallback(() => {
    setIndexOpen(false)
    // адрес вида #/home/index больше не нужен — не плодим записи в истории
    if (open) window.history.replaceState(null, '', '#/home')
    // вернуть фокус после того, как фон перестанет быть inert
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onTab = (tab: DockTab) => {
    if (tab === 'atlas') onAtlas()
    if (tab === 'messages') go('#/messages')
    if (tab === 'doctors') go('#/doctors')
  }

  const top = ATTENTION[0]
  const apptSystem = appt ? systemById(appt.systemId) : null

  return (
    <>
      <main className="screen home" inert={overlay || undefined}>
        <NavBar
          title="Сводка"
          titleAfter={9999}
          left={
            <button type="button" className="hm-me" onClick={() => go('#/profile')} aria-label="Профиль">
              <img src={AVATAR} alt="" width="44" height="44" decoding="async" draggable={false} />
              <span>
                <b>{greeting()}, Алексей</b>
                <small>{today()}</small>
              </span>
            </button>
          }
          right={<TopActions go={go} avatar={false} />}
        />
        <div className="hm-wrap">
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
                <button className="hm-info" type="button" aria-label="Как считается индекс" aria-haspopup="dialog" onClick={(event) => openIndex(event.currentTarget)}>
                  <Info size={20} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <nav className="hm-pills" aria-label="Системы организма">
            {ORDER.map((item) => {
              const level = levelOf(item.risk)
              return (
                <button key={item.id} type="button" onClick={() => onAtlas(item.id)}>
                  <img src={thumb(item.id)} alt="" width="64" height="64" loading="lazy" decoding="async" draggable={false} />
                  {ORGAN_TITLE[item.id]}
                  <i style={{ background: MESH_COLOR[level] }} aria-hidden="true" />
                </button>
              )
            })}
          </nav>

          <section className="hm-sec hm-att" aria-labelledby="hm-att">
            <div className="hm-head">
              <h2 id="hm-att">Требуют внимания</h2>
              <button type="button" className="hm-link" onClick={() => onAtlas()}>
                Весь атлас
              </button>
            </div>
            <ul className="hm-attlist">
              {ATTENTION.map((item) => {
                const level = levelOf(item.risk)
                return (
                  <li key={item.id}>
                    <button type="button" className="att" style={{ ['--soft' as string]: RISK_SOFT[level] }} onClick={() => onAtlas(item.id)}>
                      <span className="att-img">
                        <img src={thumb(item.id)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
                      </span>
                      <span className="att-copy">
                        <b>{ORGAN_TITLE[item.id]}</b>
                        <small>{item.summary}</small>
                        <RiskTag level={level} score={item.risk} />
                      </span>
                      <span className="att-go" aria-hidden="true">
                        <ArrowUpRight size={18} weight="bold" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="hm-sec hm-nextwrap" aria-labelledby="hm-next-h">
            <div className="hm-head">
              <h2 id="hm-next-h">{appt ? 'Ближайшая запись' : 'Следующий шаг'}</h2>
            </div>
            {appt && apptSystem ? (
              <div className="hm-next is-booked">
                <p className="nx-when">
                  <b>{cap(fmtDay(appt.start).split(',')[1].trim())}</b>
                  <span>{fmtTime(appt.start)}</span>
                </p>
                <p className="nx-line">
                  {inDays(appt.start)} · {doctorById(appt.doctorId).name}, {doctorById(appt.doctorId).role.toLowerCase()}
                </p>
                <p className="nx-meta">
                  {appt.mode === 'video' ? <VideoCamera size={16} weight="duotone" aria-hidden="true" /> : <Buildings size={16} weight="duotone" aria-hidden="true" />}
                  {MODE_LABEL[appt.mode]}, {DURATION[appt.mode]} мин · тема «{ORGAN_TITLE[appt.systemId]}» · {cap(fmtDayLong(appt.start).split(',')[0])}
                </p>
                <div className="nx-actions">
                  <button type="button" className="nx-btn is-dark" onClick={() => go(`#/messages/${threadOf(appt.doctorId)}`)}>
                    <ChatCircleText size={18} weight="fill" aria-hidden="true" />
                    Написать врачу
                  </button>
                  <button type="button" className="nx-btn" onClick={() => setBooking({ systemId: appt.systemId, replace: appt })}>
                    Перенести
                  </button>
                </div>
              </div>
            ) : (
              <div className="hm-next">
                <DoctorAva id={doctorFor(top.id).id} size={56} />
                <h3 className="nx-title">{`Запишитесь к ${roleTo(doctorFor(top.id))}`}</h3>
                <p className="nx-text">
                  {doctorFor(top.id).name} разберёт зону «{ORGAN_TITLE[top.id]}». Приём 30 минут, можно по видео.
                </p>
                <div className="nx-actions">
                  <button type="button" className="nx-btn is-dark" onClick={() => setBooking({ systemId: top.id })}>
                    Записаться
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </button>
                  <button type="button" className="nx-btn" onClick={() => go(`#/doctors/${doctorFor(top.id).id}`)}>
                    О враче
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="ai-entry" aria-label="Ассистент">
            <button type="button" className="ai-entry-main" onClick={() => go('#/assistant')}>
              <AiMark size={44} />
              <span>
                <b>Спросите ассистента</b>
                <small>Объяснит показатели и подскажет следующий шаг</small>
              </span>
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </button>
            <div className="ai-entry-chips">
              {suggestions(null).slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    queueQuestion(q)
                    go('#/assistant')
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section className="hm-sec hm-learn" aria-labelledby="hm-learn">
            <div className="hm-head">
              <h2 id="hm-learn">Полезное</h2>
              <button type="button" className="hm-link" onClick={() => go('#/learn')}>
                Все статьи
              </button>
            </div>
            <ul className="ln-rail">
              {ARTICLES.map((a) => {
                const sys = a.systemId ? systemById(a.systemId) : null
                const lv = sys ? levelOf(sys.risk) : null
                return (
                  <li key={a.id}>
                    <button type="button" className="ln-card" style={lv ? { ['--soft' as string]: RISK_SOFT[lv] } : undefined} onClick={() => go(`#/learn/${a.id}`)}>
                      {sys ? <img src={thumb(sys.id)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} /> : <span className="ln-mark" aria-hidden="true"><BookOpenText size={30} weight="duotone" /></span>}
                      <b>{a.title}</b>
                      <small>{a.kicker} · {a.minutes} мин</small>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="hm-sec hm-read" aria-labelledby="hm-read">
            <div className="hm-head">
              <h2 id="hm-read">Показатели недели</h2>
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
        </div>
      </main>

      <div inert={overlay || undefined}>
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

      {booking && (
        <Booking
          systemId={booking.systemId}
          doctorId={booking.replace?.doctorId ?? doctorFor(booking.systemId).id}
          replace={booking.replace}
          onClose={() => setBooking(null)}
          onChat={(to) => {
            setBooking(null)
            go(to)
          }}
        />
      )}
    </>
  )
}
