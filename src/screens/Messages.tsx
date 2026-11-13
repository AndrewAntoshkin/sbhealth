import { useEffect, useRef, useState } from 'react'
import { ArrowUp, CalendarCheck, CaretLeft } from '@phosphor-icons/react'
import { doctorById } from '../data/doctors'
import { TopActions } from '../TopActions'
import { MODE_LABEL, nextAppointment, sendMessage, useCore, useLive, viewThread, type Appointment, type Msg, type Thread } from '../store'
import { fmtTime, fmtWhen, rel } from '../time'
import { NavBar } from '../NavBar'
import { AiMark } from './Assistant'
import { Dock, type DockTab } from './Dock'

const QUICK = ['Что взять с собой?', 'Хочу перенести', 'Спасибо']

function Avatar({ thread, size = 48 }: { thread: Pick<Thread, 'initials' | 'doctor' | 'avatar'>; size?: number }) {
  if (thread.avatar) return <img className="mg-ava is-photo" src={thread.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} decoding="async" draggable={false} />
  return (
    <span className={thread.doctor ? 'mg-ava is-doc' : 'mg-ava'} style={{ width: size, height: size }} aria-hidden="true">
      {thread.initials}
    </span>
  )
}

function ApptCard({ appt }: { appt: Appointment }) {
  return (
    <span className={appt.status === 'cancelled' ? 'mg-appt is-off' : 'mg-appt'}>
      <CalendarCheck size={20} weight="duotone" aria-hidden="true" />
      <span>
        <b>{fmtWhen(appt.start)}</b>
        <small>{appt.status === 'cancelled' ? 'Запись отменена или перенесена' : `${MODE_LABEL[appt.mode]} · ${doctorById(appt.doctorId).name}`}</small>
      </span>
    </span>
  )
}

function Bubble({ msg, appts }: { msg: Msg; appts: Appointment[] }) {
  const appt = msg.appt ? appts.find((a) => a.id === msg.appt) : undefined
  return (
    <li className={msg.from === 'me' ? 'mg-msg is-me' : 'mg-msg'}>
      <p>{msg.text}</p>
      {appt && <ApptCard appt={appt} />}
      <time dateTime={new Date(msg.at).toISOString()}>{fmtTime(msg.at)}</time>
    </li>
  )
}

function ThreadView({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const { appts } = useCore()
  const { typing } = useLive()
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const next = thread.doctor ? nextAppointment(appts.filter((a) => `t-${a.doctorId}` === thread.id)) : null
  const last = thread.msgs[thread.msgs.length - 1]
  const isTyping = typing === thread.id

  useEffect(() => {
    viewThread(thread.id)
    return () => viewThread(null)
  }, [thread.id])

  useEffect(() => {
    if (thread.unread) viewThread(thread.id)
  }, [thread.id, thread.unread])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: thread.msgs.length > 2 ? 'smooth' : 'auto' })
  }, [thread.msgs.length, isTyping, thread.id])

  const submit = (value: string) => {
    sendMessage(thread.id, value)
    setText('')
  }

  return (
    <section className="mg-chat" aria-label={`Диалог: ${thread.name}`}>
      <header className="mg-chat-head">
        <button type="button" className="back mg-back" aria-label="К списку диалогов" onClick={onBack}>
          <CaretLeft size={20} weight="bold" aria-hidden="true" />
        </button>
        <Avatar thread={thread} size={44} />
        <div className="mg-who">
          <h2>{thread.name}</h2>
          <p>{thread.role}</p>
        </div>
      </header>

      {next && (
        <p className="mg-next">
          <CalendarCheck size={16} weight="fill" aria-hidden="true" />
          Приём {fmtWhen(next.start)}
        </p>
      )}

      <div className="mg-scroll" ref={scroller}>
        <ul className="mg-msgs">
          {thread.msgs.length === 0 && (
            <li className="mg-fresh">
              <b>Начните диалог</b>
              <span>Опишите, что беспокоит, или приложите показатели. Врач ответит в течение дня.</span>
            </li>
          )}
          {thread.msgs.map((msg) => (
            <Bubble key={msg.id} msg={msg} appts={appts} />
          ))}
          {isTyping && (
            <li className="mg-msg is-typing" aria-label="Печатает">
              <p>
                <i />
                <i />
                <i />
              </p>
            </li>
          )}
        </ul>
      </div>

      {thread.doctor && (last?.from === 'them' || !last) && !isTyping && (
        <div className="mg-quick" role="group" aria-label="Быстрые ответы">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => submit(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="mg-composer"
        onSubmit={(event) => {
          event.preventDefault()
          submit(text)
        }}
      >
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Сообщение" aria-label="Сообщение" autoComplete="off" enterKeyHint="send" />
        <button type="submit" aria-label="Отправить" disabled={!text.trim()}>
          <ArrowUp size={20} weight="bold" aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}

export function Messages({ threadId, go, onTab }: { threadId: string | null; go: (to: string) => void; onTab: (tab: DockTab, el: HTMLElement) => void }) {
  const { threads } = useCore()
  const sorted = [...threads].sort((a, b) => (b.msgs[b.msgs.length - 1]?.at ?? 0) - (a.msgs[a.msgs.length - 1]?.at ?? 0))
  const open = threadId ? threads.find((t) => t.id === threadId) ?? null : null

  return (
    <>
      <main className={open ? 'screen msgs has-thread' : 'screen msgs'}>
        <NavBar title="Сообщения" right={<TopActions go={go} />} />
        <div className="mg-wrap">
          <header className="mg-title">
            <h1>Сообщения</h1>
          </header>
          <div className="mg-body">
            <aside className="mg-list" aria-label="Диалоги">
              <button type="button" className="mg-row mg-ai" onClick={() => go('#/assistant')}>
                <AiMark size={48} />
                <span className="mg-copy">
                  <span className="mg-top">
                    <b>Ассистент</b>
                  </span>
                  <span className="mg-prev">
                    <span>Объяснит показатели атласа, отвечает сразу</span>
                  </span>
                </span>
              </button>
              <ul>
                {sorted.map((thread) => {
                  const last = thread.msgs[thread.msgs.length - 1]
                  return (
                    <li key={thread.id}>
                      <button type="button" className={thread.id === open?.id ? 'mg-row is-on' : 'mg-row'} aria-current={thread.id === open?.id ? 'true' : undefined} onClick={() => go(`#/messages/${thread.id}`)}>
                        <Avatar thread={thread} />
                        <span className="mg-copy">
                          <span className="mg-top">
                            <b>{thread.name}</b>
                            {last && <time dateTime={new Date(last.at).toISOString()}>{rel(last.at)}</time>}
                          </span>
                          <span className="mg-prev">
                            <span>{last ? `${last.from === 'me' ? 'Вы: ' : ''}${last.text}` : thread.role}</span>
                            {thread.unread > 0 && <em aria-label={`Непрочитано: ${thread.unread}`}>{thread.unread}</em>}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!threads.some((t) => t.doctor) && <p className="mg-hint">Диалог с врачом появится здесь после записи на приём.</p>}
            </aside>

            {open ? (
              <ThreadView key={open.id} thread={open} onBack={() => go('#/messages')} />
            ) : (
              <div className="mg-empty">
                <p>Выберите диалог, чтобы прочитать сообщения.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className={open ? 'dock-wrap is-thread' : 'dock-wrap'}>
        <Dock active="messages" onGo={onTab} />
      </div>
    </>
  )
}
