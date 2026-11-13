import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowsCounterClockwise, CaretRight, Sparkle } from '@phosphor-icons/react'
import { ask, resetAssistant, suggestions, takeQueued, useAssistant, type AiMsg } from '../assistant'
import type { SystemId } from '../data/systems'
import { NavBar } from '../NavBar'
import { ORGAN_TITLE } from '../shared'

export function AiMark({ size = 28 }: { size?: number }) {
  return (
    <span className="ai-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Sparkle size={Math.round(size * 0.55)} weight="fill" />
    </span>
  )
}

function Answer({ msg, go }: { msg: AiMsg; go: (to: string) => void }) {
  const open = (to: string) => (to.startsWith('tel:') ? (window.location.href = to) : go(to))
  return (
    <li className="ai-msg">
      <AiMark />
      <div className="ai-body">
        <p>{msg.text}</p>
        {!msg.live && msg.points && (
          <ul className="ai-points">
            {msg.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {!msg.live && msg.facts && (
          <div className="ai-facts">
            <small>Из ваших данных</small>
            {msg.facts.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        )}
        {!msg.live && msg.actions && (
          <div className="ai-actions">
            {msg.actions.map((a) => (
              <button key={a.to + a.label} type="button" onClick={() => open(a.to)}>
                {a.label}
                <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

export function Assistant({ about, go }: { about: SystemId | null; go: (to: string) => void }) {
  const { msgs, thinking } = useAssistant()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const busy = thinking || msgs.some((m) => m.live)

  useEffect(() => {
    const q = takeQueued()
    if (q) ask(q, about)
  }, [about])

  const last = msgs[msgs.length - 1]
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: msgs.length > 1 ? 'smooth' : 'auto' })
  }, [msgs.length, last?.text, thinking])

  const back = () => (window.history.length > 1 ? window.history.back() : go('#/home'))
  const send = (q: string) => {
    if (busy) return
    ask(q, about)
    setText('')
  }

  return (
    <main className="screen assistant">
      <NavBar
        title="Ассистент"
        onBack={back}
        titleAfter={-1}
        right={
          msgs.length > 0 && (
            <button type="button" className="nav-btn" aria-label="Новый диалог" onClick={resetAssistant}>
              <ArrowsCounterClockwise size={20} weight="bold" aria-hidden="true" />
            </button>
          )
        }
      />

      <div className="ai-wrap">
        {msgs.length === 0 && (
          <header className="ai-hello">
            <AiMark size={56} />
            <h1>{about ? `Спросите про «${ORGAN_TITLE[about]}»` : 'Чем помочь?'}</h1>
            <p>Объясняю показатели атласа простыми словами и подсказываю, что делать дальше. Диагнозов не ставлю.</p>
          </header>
        )}

        {msgs.length === 0 && (
          <ul className="ai-suggest" aria-label="Примеры вопросов">
            {suggestions(about).map((s) => (
              <li key={s}>
                <button type="button" onClick={() => send(s)}>
                  {s}
                  <ArrowUp size={16} weight="bold" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className="ai-thread" aria-live="polite">
          {msgs.map((m) =>
            m.from === 'me' ? (
              <li key={m.id} className="ai-me">
                <p>{m.text}</p>
              </li>
            ) : (
              <Answer key={m.id} msg={m} go={go} />
            ),
          )}
          {thinking && (
            <li className="ai-msg is-thinking" aria-label="Ассистент думает">
              <AiMark />
              <p className="ai-dots">
                <i />
                <i />
                <i />
              </p>
            </li>
          )}
        </ul>
        <div ref={end} />
      </div>

      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault()
          send(text)
        }}
      >
        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Спросите о своём здоровье" aria-label="Вопрос ассистенту" autoComplete="off" enterKeyHint="send" />
        <button type="submit" aria-label="Отправить" disabled={!text.trim() || busy}>
          <ArrowUp size={20} weight="bold" aria-hidden="true" />
        </button>
      </form>
    </main>
  )
}
