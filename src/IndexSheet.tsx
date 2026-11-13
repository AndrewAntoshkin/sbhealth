import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { IndexContent } from './IndexContent'
import type { SystemId } from './data/systems'

const WIDE = '(min-width: 960px), (orientation: landscape) and (min-width: 640px) and (max-height: 520px)'

export function IndexSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (id: SystemId) => void }) {
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; pid: number } | null>(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog.current) return
      const items = [...dialog.current.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    // на широком экране это боковой дровер: вниз его не тянут
    if (window.matchMedia(WIDE).matches) return
    drag.current = { y: event.clientY, t: performance.now(), pid: event.pointerId }
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* синтетические события без захвата */
    }
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setDy(Math.max(0, event.clientY - drag.current.y))
  }
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    drag.current = null
    setDragging(false)
    const distance = Math.max(0, event.clientY - start.y)
    const speed = distance / Math.max(1, performance.now() - start.t)
    if (distance > 120 || (distance > 36 && speed > 0.5)) {
      onClose()
      return
    }
    setDy(0)
  }

  return (
    <div className="modal" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialog}
        className={`modal-sheet${dragging ? ' is-dragging' : ''}`}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ix-title"
        tabIndex={-1}
      >
        <div
          className="modal-grab"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <i aria-hidden="true" />
          <div className="modal-head">
            <div>
              <h2 id="ix-title">Индекс здоровья</h2>
              <p className="card-kicker">Как это считается</p>
            </div>
            <button className="modal-close" type="button" aria-label="Закрыть" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <IndexContent onSelect={onSelect} />
        </div>
      </div>
    </div>
  )
}
