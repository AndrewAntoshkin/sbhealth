import { useMemo, useState } from 'react'
import { ArrowRight, Buildings, CalendarPlus, Check, ChatCircleText, MapPin, VideoCamera } from '@phosphor-icons/react'
import { MESH_COLOR, RISK_INK, RISK_SOFT, levelOf, systemById, type SystemId } from './data/systems'
import { Overlay } from './Overlay'
import { metricIcon } from './metricIcons'
import { DoctorAva, ORGAN_TITLE, RiskTag, thumb } from './shared'
import { doctorById, doctorFor, roleTo, threadOf } from './data/doctors'
import { CLINIC, DURATION, MODE_LABEL, book, getPrefs, type Appointment, type Mode } from './store'
import { cap, fmtDay, fmtDayLong, fmtTime, inDays } from './time'

const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '17:00', '17:30', '18:00', '18:30']
const GROUPS: { label: string; test: (time: string) => boolean }[] = [
  { label: 'Утро', test: (t) => t < '12:00' },
  { label: 'День', test: (t) => t >= '12:00' && t < '17:00' },
  { label: 'Вечер', test: (t) => t >= '17:00' },
]

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Детерминированная «занятость»: у демо-врача часть окон всегда занята. */
function busy(key: string, time: string) {
  let h = 7
  for (const ch of key + time) h = (h * 31 + ch.charCodeAt(0)) % 997
  return h % 4 === 0
}

function stamp(day: Date, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function buildDays(): Date[] {
  const out: Date[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (out.length < 8) {
    if (cursor.getDay() !== 0) out.push(new Date(cursor)) // по воскресеньям приёма нет
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

const isFree = (doctorId: string, day: Date, time: string, now: number) => stamp(day, time) > now + 60 * 60_000 && !busy(doctorId + dayKey(day), time)

/** Ближайшие свободные окна врача: для карточек и профиля. */
export function freeSlots(doctorId: string, count = 4): number[] {
  const now = Date.now()
  const out: number[] = []
  for (const day of buildDays()) {
    for (const t of TIMES) {
      if (isFree(doctorId, day, t, now)) out.push(stamp(day, t))
      if (out.length >= count) return out
    }
  }
  return out
}

function downloadIcs(appt: Appointment) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const utc = (ts: number) => {
    const d = new Date(ts)
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  }
  const end = appt.start + DURATION[appt.mode] * 60_000
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atlas sistem//RU',
    'BEGIN:VEVENT',
    `UID:${appt.id}@atlas-demo`,
    `DTSTAMP:${utc(Date.now())}`,
    `DTSTART:${utc(appt.start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:Приём: ${doctorById(appt.doctorId).role.toLowerCase()} (демо)`,
    `DESCRIPTION:${doctorById(appt.doctorId).name}. Тема: ${ORGAN_TITLE[appt.systemId]}.`,
    `LOCATION:${appt.mode === 'video' ? 'Видеосвязь' : CLINIC}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'priem.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Step = 'pick' | 'review' | 'done'

export function Booking({
  systemId,
  doctorId,
  initialStart,
  replace,
  onClose,
  onChat,
}: {
  systemId: SystemId
  doctorId?: string
  initialStart?: number
  replace?: Appointment | null
  onClose: () => void
  onChat: (to: string) => void
}) {
  const doctor = doctorById(replace?.doctorId ?? doctorId ?? doctorFor(systemId).id)
  const system = systemById(systemId)
  const level = levelOf(system.risk)
  const now = useMemo(() => Date.now(), [])
  const days = useMemo(buildDays, [])
  const [dayIndex, setDayIndex] = useState(() => {
    if (initialStart) {
      const match = days.findIndex((d) => dayKey(d) === dayKey(new Date(initialStart)))
      if (match >= 0) return match
    }
    const first = days.findIndex((d) => TIMES.some((t) => isFree(doctor.id, d, t, now)))
    return Math.max(first, 0)
  })
  const [time, setTime] = useState<string | null>(initialStart ? fmtTime(initialStart) : null)
  const [mode, setMode] = useState<Mode>(replace?.mode ?? 'video')
  const [share, setShare] = useState(replace?.share ?? getPrefs().share)
  const [step, setStep] = useState<Step>('pick')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)

  const day = days[dayIndex]
  const start = time ? stamp(day, time) : null
  const moved = Boolean(replace)

  const confirm = () => {
    if (!start || pending) return
    setPending(true)
    window.setTimeout(() => {
      setDone(book({ systemId, doctorId: doctor.id, start, mode, share, replaceId: replace?.id }))
      setPending(false)
      setStep('done')
    }, 900)
  }

  const prep = [
    'Паспорт и полис',
    `Последние анализы и измерения: ${system.metrics.map((m) => (/[А-ЯA-Z].*[А-ЯA-Z]/.test(m.label) ? m.label : m.label.toLowerCase())).join(', ')}`,
    'Список лекарств, которые принимаете',
  ]

  const tone = {
    ['--c' as string]: MESH_COLOR[level],
    ['--soft' as string]: RISK_SOFT[level],
    ['--ink-risk' as string]: RISK_INK[level],
  }

  const title = step === 'done' ? (moved ? 'Запись перенесена' : 'Вы записаны') : step === 'review' ? 'Проверьте запись' : moved ? 'Новое время' : 'Выберите время'
  const kicker = step === 'done' ? 'Готово' : moved ? 'Перенос приёма' : `Запись к ${roleTo(doctor)}`

  return (
    <Overlay
      kicker={kicker}
      title={title}
      variant="dialog"
      tone={tone}
      onClose={onClose}
      onBack={step === 'review' && !pending ? () => setStep('pick') : undefined}
      footer={({ close }) =>
        step === 'pick' ? (
          <>
            <p className="bk-pick" aria-live="polite">
              {start ? (
                <>
                  <b>{cap(fmtDay(start))}, {fmtTime(start)}</b> · {MODE_LABEL[mode]}, {DURATION[mode]} мин
                </>
              ) : (
                'Выберите день и время'
              )}
            </p>
            <button className="primary" type="button" disabled={!start} onClick={() => setStep('review')}>
              Продолжить
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </button>
          </>
        ) : step === 'review' ? (
          <>
            <button className="primary" type="button" onClick={confirm} disabled={pending} aria-busy={pending}>
              {pending ? (
                <>
                  <span className="bk-spin" aria-hidden="true" />
                  Записываем…
                </>
              ) : (
                <>
                  <Check size={18} weight="bold" aria-hidden="true" />
                  {moved ? 'Подтвердить перенос' : 'Подтвердить запись'}
                </>
              )}
            </button>
            <p className="bk-fine">Это демо: запись сохраняется только на этом устройстве.</p>
          </>
        ) : (
          <>
            <button className="primary" type="button" onClick={close}>
              Готово
            </button>
          </>
        )
      }
    >
      {step === 'pick' && (
        <div className="bk">
          <section className="bk-card bk-ctx" aria-label="Повод и врач">
            <div className="bk-thumb">
              <img src={thumb(systemId)} alt="" width="256" height="256" decoding="async" draggable={false} />
            </div>
            <div className="bk-ctx-copy">
              <p className="bk-label">Повод</p>
              <p className="bk-topic">
                {ORGAN_TITLE[systemId]} <RiskTag level={level} score={system.risk} />
              </p>
              <p className="bk-sub">{system.summary}</p>
            </div>
            <div className="bk-doc">
              <DoctorAva id={doctor.id} size={44} className="bk-ava" />
              <span>
                <b>{doctor.name}</b>
                <small>{doctor.role} · стаж {doctor.years} лет · {doctor.rating} ★ (демо)</small>
              </span>
            </div>
          </section>

          <section aria-labelledby="bk-mode">
            <h3 id="bk-mode" className="bk-h">Формат</h3>
            <div className="bk-modes" role="radiogroup" aria-label="Формат приёма">
              {(['video', 'clinic'] as Mode[]).map((m) => {
                const Icon = m === 'video' ? VideoCamera : Buildings
                return (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'bk-mode is-on' : 'bk-mode'} onClick={() => setMode(m)}>
                    <Icon size={22} weight="duotone" aria-hidden="true" />
                    <b>{MODE_LABEL[m]}</b>
                    <small>{DURATION[m]} мин{m === 'clinic' ? ' · Тверская, 12' : ''}</small>
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="bk-day">
            <h3 id="bk-day" className="bk-h">Дата</h3>
            <div className="bk-days" role="radiogroup" aria-label="Дата приёма">
              {days.map((d, i) => {
                const ts = d.getTime()
                const free = TIMES.some((t) => isFree(doctor.id, d, t, now))
                const word = i === 0 ? 'сегодня' : inDays(ts, now) === 'завтра' ? 'завтра' : fmtDay(ts).split(',')[0]
                return (
                  <button
                    key={ts}
                    type="button"
                    role="radio"
                    aria-checked={i === dayIndex}
                    aria-label={`${cap(fmtDayLong(ts))}${free ? '' : ', нет свободного времени'}`}
                    disabled={!free}
                    className={i === dayIndex ? 'bk-day is-on' : 'bk-day'}
                    onClick={() => {
                      setDayIndex(i)
                      setTime(null)
                    }}
                  >
                    <small>{word}</small>
                    <b>{d.getDate()}</b>
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="bk-time">
            <h3 id="bk-time" className="bk-h">Время</h3>
            {GROUPS.map((group) => {
              const slots = TIMES.filter(group.test)
              return (
                <div className="bk-group" key={group.label}>
                  <p>{group.label}</p>
                  <div className="bk-slots" role="radiogroup" aria-label={group.label}>
                    {slots.map((t) => {
                      const free = isFree(doctor.id, day, t, now)
                      return (
                        <button key={t} type="button" role="radio" aria-checked={time === t} disabled={!free} className={time === t ? 'bk-slot is-on' : 'bk-slot'} onClick={() => setTime(t)}>
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      )}

      {step === 'review' && start && (
        <div className="bk">
          <section className="bk-card bk-sum" aria-label="Запись">
            <p className="bk-label">Когда</p>
            <p className="bk-when">
              <b>{cap(fmtDayLong(start))}</b>
              <span>{fmtTime(start)} · {DURATION[mode]} мин · {inDays(start, now)}</span>
            </p>
            <dl className="bk-rows">
              <div><dt>Врач</dt><dd>{doctor.name}, {doctor.role.toLowerCase()}</dd></div>
              <div><dt>Формат</dt><dd>{mode === 'video' ? 'Видеосвязь, ссылка придёт в сообщении' : CLINIC}</dd></div>
              <div><dt>Тема</dt><dd>{ORGAN_TITLE[systemId]}</dd></div>
            </dl>
          </section>

          <section className="bk-card bk-share" aria-label="Данные атласа">
            <button type="button" role="switch" aria-checked={share} className="bk-switch-row" onClick={() => setShare((v) => !v)}>
              <span>
                <b>Передать врачу данные атласа</b>
                <small>Показатели по системе «{system.name}» и уровень риска</small>
              </span>
              <i className={share ? 'bk-switch is-on' : 'bk-switch'} aria-hidden="true" />
            </button>
            {share && (
              <ul className="bk-shared">
                {system.metrics.map((metric) => {
                  const Icon = metricIcon(metric.label)
                  return (
                    <li key={metric.label}>
                      <Icon size={18} weight="duotone" aria-hidden="true" />
                      <span>{metric.label}</span>
                      <b>{metric.value}</b>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="bk-prep">
            <h3 id="bk-prep" className="bk-h">Что взять с собой</h3>
            <ul className="bk-prep">
              {prep.map((item) => (
                <li key={item}>
                  <Check size={16} weight="bold" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {step === 'done' && done && (
        <div className="bk bk-done">
          <svg className="bk-check" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r="44" />
            <path d="M30 50l13 13 24-28" />
          </svg>
          <p className="bk-done-lead">Подтверждение пришло в уведомления, а врач написал вам в сообщения.</p>

          <section className="bk-card bk-sum" aria-label="Ваша запись">
            <p className="bk-when">
              <b>{cap(fmtDayLong(done.start))}</b>
              <span>{fmtTime(done.start)} · {DURATION[done.mode]} мин · {inDays(done.start, now)}</span>
            </p>
            <dl className="bk-rows">
              <div><dt>Врач</dt><dd>{doctor.name}, {doctor.role.toLowerCase()}</dd></div>
              <div>
                <dt>Где</dt>
                <dd>
                  {done.mode === 'video' ? (
                    'Видеосвязь, ссылка придёт за 15 минут'
                  ) : (
                    <>
                      <MapPin size={14} weight="fill" aria-hidden="true" /> {CLINIC}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <div className="bk-actions">
            <button type="button" className="bk-ghost" onClick={() => downloadIcs(done)}>
              <CalendarPlus size={20} weight="duotone" aria-hidden="true" />
              В календарь
            </button>
            <button type="button" className="bk-ghost" onClick={() => onChat(`#/messages/${threadOf(doctor.id)}`)}>
              <ChatCircleText size={20} weight="duotone" aria-hidden="true" />
              Написать врачу
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

