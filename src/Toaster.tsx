import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck } from '@phosphor-icons/react'
import { dismissToast, useLive, type Toast } from './store'

function Item({ item, onGo }: { item: Toast; onGo: (to: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(item.id), 6000)
    return () => window.clearTimeout(timer)
  }, [item.id])

  return (
    <button
      type="button"
      className="toast"
      onClick={() => {
        dismissToast(item.id)
        if (item.to) onGo(item.to)
      }}
    >
      <span className="toast-ico">
        <CalendarCheck size={22} weight="fill" aria-hidden="true" />
      </span>
      <span className="toast-copy">
        <small>Атлас · сейчас</small>
        <b>{item.title}</b>
        <span>{item.text}</span>
      </span>
    </button>
  )
}

/** Пуш-уведомление поверх интерфейса: появляется, когда запись подтверждена. */
export function Toaster({ onGo }: { onGo: (to: string) => void }) {
  const { toasts } = useLive()
  const latest = toasts[toasts.length - 1]
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {latest && <Item key={latest.id} item={latest} onGo={onGo} />}
    </div>,
    document.body,
  )
}
