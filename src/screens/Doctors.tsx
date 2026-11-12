import { useMemo, useState } from 'react'
import { ArrowRight, Buildings, CalendarBlank, CaretLeft, CaretRight, ChatCircleText, GraduationCap, MagnifyingGlass } from '@phosphor-icons/react'
import { Booking, freeSlots } from '../Booking'
import { DOCTORS, doctorById, doctorFor, threadOf, type Doctor } from '../data/doctors'
import { MESH_COLOR, RISK_SOFT, levelOf, systemById, type SystemId } from '../data/systems'
import { DoctorAva, ORDER, ORGAN_TITLE, RiskTag, thumb } from '../shared'
import { ensureThread } from '../store'
import { TopActions } from '../TopActions'
import { fmtDay, fmtTime, inDays } from '../time'
import { Dock, type DockTab } from './Dock'

/** «завтра, 09:00» или «пт, 13 ноября, 09:00» */
export function slotLabel(ts: number) {
  const d = inDays(ts)
  return `${d === 'сегодня' || d === 'завтра' ? d : fmtDay(ts)}, ${fmtTime(ts)}`
}

type BookingState = { systemId: SystemId; doctorId: string; initialStart?: number }

function Rec({ doctor, systemId, onOpen, onBook }: { doctor: Doctor; systemId: SystemId; onOpen: () => void; onBook: (start?: number) => void }) {
  const system = systemById(systemId)
  const level = levelOf(system.risk)
  const slot = freeSlots(doctor.id, 1)[0]
  return (
    <article className="dr-rec" style={{ ['--soft' as string]: RISK_SOFT[level], ['--c' as string]: MESH_COLOR[level] }}>
      <button type="button" className="dr-rec-main" onClick={onOpen} aria-label={`${doctor.name}, ${doctor.role}. Профиль`}>
        <DoctorAva id={doctor.id} size={64} />
        <span className="dr-rec-copy">
          <small>{doctor.role}</small>
          <b>{doctor.name}</b>
          <span>
            ★ {doctor.rating} · {doctor.reviews} отзывов
          </span>
        </span>
      </button>
      <p className="dr-why">
        <img src={thumb(systemId)} alt="" width="28" height="28" draggable={false} />
        <span>{ORGAN_TITLE[systemId]}</span>
        <RiskTag level={level} score={system.risk} />
      </p>
      <div className="dr-rec-foot">
        {slot && (
          <p>
            <small>Ближайшее время</small>
            <b>{slotLabel(slot)}</b>
          </p>
        )}
        <button type="button" className="nx-btn is-dark" onClick={() => onBook(slot)}>
          Записаться
        </button>
      </div>
    </article>
  )
}

export function Doctors({ go, onTab }: { go: (to: string) => void; onTab: (tab: DockTab) => void }) {
  const [query, setQuery] = useState('')
  const [booking, setBooking] = useState<BookingState | null>(null)

  const recs = useMemo(() => {
    const seen = new Set<string>()
    const out: { doctor: Doctor; systemId: SystemId }[] = []
    for (const system of ORDER.slice(0, 5)) {
      const doctor = doctorFor(system.id)
      if (seen.has(doctor.id)) continue
      seen.add(doctor.id)
      out.push({ doctor, systemId: system.id })
      if (out.length === 3) break
    }
    return out
  }, [])

  const q = query.trim().toLowerCase()
  const list = DOCTORS.filter(
    (d) => !q || [d.name, d.role, ...d.helps, ...d.systems.map((s) => systemById(s).name)].join(' ').toLowerCase().includes(q),
  )

  return (
    <>
      <main className="screen doctors" inert={booking !== null || undefined}>
        <div className="dr-wrap">
          <header className="tab-head">
            <div>
              <h1>Врачи</h1>
              <p>Запись за минуту, вопросы можно задать в чате</p>
            </div>
            <TopActions go={go} />
          </header>

          {!q && (
            <section className="hm-sec" aria-labelledby="dr-rec">
              <div className="hm-head">
                <h2 id="dr-rec">Рекомендуем по вашим зонам</h2>
              </div>
              <ul className="dr-recs">
                {recs.map(({ doctor, systemId }) => (
                  <li key={doctor.id}>
                    <Rec doctor={doctor} systemId={systemId} onOpen={() => go(`#/doctors/${doctor.id}`)} onBook={(start) => setBooking({ systemId, doctorId: doctor.id, initialStart: start })} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="hm-sec" aria-labelledby="dr-all">
            <div className="hm-head">
              <h2 id="dr-all">Все специалисты</h2>
            </div>
            <label className="dr-search">
              <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Врач, специальность или орган" aria-label="Поиск врача" />
            </label>
            <ul className="dr-list">
              {list.map((doctor) => {
                const slot = freeSlots(doctor.id, 1)[0]
                return (
                  <li key={doctor.id}>
                    <button type="button" className="dr-row" onClick={() => go(`#/doctors/${doctor.id}`)}>
                      <DoctorAva id={doctor.id} size={56} />
                      <span className="dr-row-copy">
                        <b>{doctor.name}</b>
                        <small>{doctor.role}</small>
                        <span>
                          ★ {doctor.rating} · стаж {doctor.years} лет{slot ? ` · ${slotLabel(slot)}` : ''}
                        </span>
                      </span>
                      <CaretRight size={18} weight="bold" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
              {list.length === 0 && <li className="pf-empty">Никого не нашли. Попробуйте другое слово, например «сердце» или «сон».</li>}
            </ul>
          </section>

          <p className="pf-fine">Врачи и отзывы вымышлены и нужны для демонстрации сценария.</p>
        </div>
      </main>

      <div inert={booking !== null || undefined}>
        <Dock active="doctors" onGo={(tab) => onTab(tab)} />
      </div>

      {booking && (
        <Booking
          systemId={booking.systemId}
          doctorId={booking.doctorId}
          initialStart={booking.initialStart}
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

export function DoctorProfile({ id, go, onAtlas }: { id: string; go: (to: string) => void; onAtlas: (id: SystemId) => void }) {
  const doctor = doctorById(id)
  const [booking, setBooking] = useState<BookingState | null>(null)
  const slots = useMemo(() => freeSlots(doctor.id, 6), [doctor.id])
  const topic = doctor.systems[0]

  const book = (start?: number) => setBooking({ systemId: topic, doctorId: doctor.id, initialStart: start })
  const write = () => {
    ensureThread(doctor.id)
    go(`#/messages/${threadOf(doctor.id)}`)
  }

  return (
    <>
      <main className="screen dprofile" inert={booking !== null || undefined}>
        <div className="dp-wrap">
          <button type="button" className="back dp-back" aria-label="К списку врачей" onClick={() => go('#/doctors')}>
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          <header className="dp-hero">
            <DoctorAva id={doctor.id} size={132} className="dp-ava" />
            <h1>{doctor.name}</h1>
            <p>{doctor.role}</p>
            <dl className="dp-stats">
              <div>
                <dd>{doctor.years}</dd>
                <dt>лет стажа</dt>
              </div>
              <div>
                <dd>★ {doctor.rating}</dd>
                <dt>рейтинг</dt>
              </div>
              <div>
                <dd>{doctor.reviews}</dd>
                <dt>отзывов</dt>
              </div>
            </dl>
            <div className="dp-actions">
              <button type="button" className="nx-btn is-dark" onClick={() => book(slots[0])}>
                <CalendarBlank size={18} weight="fill" aria-hidden="true" />
                Записаться
              </button>
              <button type="button" className="nx-btn" onClick={write}>
                <ChatCircleText size={18} weight="fill" aria-hidden="true" />
                Написать
              </button>
            </div>
          </header>

          <div className="dp-col">
            <section className="hm-sec" aria-labelledby="dp-about">
              <div className="hm-head">
                <h2 id="dp-about">О враче</h2>
              </div>
              <div className="pf-card dp-card">
                <p>{doctor.about}</p>
                <ul className="dp-chips" aria-label="С чем помогает">
                  {doctor.helps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="hm-sec" aria-labelledby="dp-systems">
              <div className="hm-head">
                <h2 id="dp-systems">Ведёт системы атласа</h2>
              </div>
              <ul className="dp-systems">
                {doctor.systems.map((sid) => {
                  const system = systemById(sid)
                  const level = levelOf(system.risk)
                  return (
                    <li key={sid}>
                      <button type="button" onClick={() => onAtlas(sid)} style={{ ['--soft' as string]: RISK_SOFT[level] }}>
                        <span className="rail-thumb">
                          <img src={thumb(sid)} alt="" width="256" height="256" loading="lazy" decoding="async" draggable={false} />
                        </span>
                        <span className="rail-name">{ORGAN_TITLE[sid]}</span>
                        <RiskTag level={level} score={system.risk} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          <div className="dp-col">
            <section className="hm-sec" aria-labelledby="dp-slots">
              <div className="hm-head">
                <h2 id="dp-slots">Ближайшее время</h2>
              </div>
              <ul className="dp-slots">
                {slots.map((ts) => (
                  <li key={ts}>
                    <button type="button" onClick={() => book(ts)}>
                      <small>{inDays(ts) === 'сегодня' || inDays(ts) === 'завтра' ? inDays(ts) : fmtDay(ts).split(',')[0]}</small>
                      <b>{fmtTime(ts)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="hm-sec" aria-labelledby="dp-edu">
              <div className="hm-head">
                <h2 id="dp-edu">Образование и клиника</h2>
              </div>
              <ul className="pf-list">
                {doctor.education.map((item) => (
                  <li key={item}>
                    <div className="pf-row">
                      <span className="pf-ico"><GraduationCap size={22} weight="duotone" aria-hidden="true" /></span>
                      <span className="pf-copy"><b>{item}</b></span>
                      <span />
                    </div>
                  </li>
                ))}
                <li>
                  <div className="pf-row">
                    <span className="pf-ico"><Buildings size={22} weight="duotone" aria-hidden="true" /></span>
                    <span className="pf-copy"><b>{doctor.clinic}</b><small>Приём в клинике или по видео</small></span>
                    <span />
                  </div>
                </li>
              </ul>
            </section>

            <section className="hm-sec" aria-labelledby="dp-fb">
              <div className="hm-head">
                <h2 id="dp-fb">Отзывы</h2>
              </div>
              <ul className="dp-fb">
                {doctor.feedback.map((r) => (
                  <li key={r.name} className="pf-card dp-card">
                    <p className="dp-fb-top">
                      <b>{r.name}</b>
                      <span>★★★★★ · {r.when}</span>
                    </p>
                    <p>{r.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="pf-fine">Врач и отзывы вымышлены и нужны для демонстрации сценария.</p>
        </div>
      </main>

      <div className="dp-bar" inert={booking !== null || undefined}>
        <button type="button" className="primary" onClick={() => book(slots[0])}>
          Записаться{slots[0] ? ` · ${slotLabel(slots[0])}` : ''}
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="dock-wrap dp-dock" inert={booking !== null || undefined}>
        <Dock active="doctors" onGo={(tab) => go(tab === 'home' ? '#/home' : tab === 'atlas' ? '#/atlas' : tab === 'doctors' ? '#/doctors' : '#/messages')} />
      </div>

      {booking && (
        <Booking
          systemId={booking.systemId}
          doctorId={booking.doctorId}
          initialStart={booking.initialStart}
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
