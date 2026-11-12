import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, X } from '@phosphor-icons/react'

const WIDE = '(min-width: 960px), (orientation: landscape) and (min-width: 640px) and (max-height: 520px)'

export interface OverlayApi {
  close: () => void
}

/**
 * Общая оболочка для потоков: на телефоне — шторка снизу (её можно утянуть вниз),
 * на широком экране — модальное окно по центру (dialog) или боковая панель (drawer).
 */
export function Overlay({
  kicker,
  title,
  variant = 'dialog',
  tone,
  onClose,
  onBack,
  footer,
  children,
}: {
  kicker?: string
  title: string
  variant?: 'dialog' | 'drawer'
  tone?: CSSProperties
  onClose: () => void
  onBack?: () => void
  footer?: ReactNode | ((api: OverlayApi) => ReactNode)
  children: ReactNode | ((api: OverlayApi) => ReactNode)
}) {
  const [shown, setShown] = useState(false)
  const [closing, setClosing] = useState(false)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number } | null>(null)
  const closed = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()

  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCloseRef.current()
      return
    }
    setClosing(true)
    window.setTimeout(() => onCloseRef.current(), 220)
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    const opener = document.activeElement as HTMLElement | null
    root?.setAttribute('inert', '')
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => setShown(true))
    panel.current?.focus({ preventScroll: true })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        return
      }
      // экран под окном не должен реагировать на стрелки
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation()
      if (event.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>('button, input, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey, true)
      root?.removeAttribute('inert')
      document.body.style.overflow = overflow
      // фокус возвращается после того, как фон перестал быть inert
      window.requestAnimationFrame(() => opener?.isConnected && opener.focus({ preventScroll: true }))
    }
  }, [close])

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    if (window.matchMedia(WIDE).matches) return
    drag.current = { y: event.clientY, t: performance.now() }
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* синтетические события без захвата */
    }
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) setDy(Math.max(0, event.clientY - drag.current.y))
  }
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    drag.current = null
    setDragging(false)
    const distance = Math.max(0, event.clientY - start.y)
    const speed = distance / Math.max(1, performance.now() - start.t)
    if (distance > 110 || (distance > 36 && speed > 0.5)) {
      close()
      return
    }
    setDy(0)
  }

  const className = ['ov', `ov--${variant}`, shown && 'is-in', closing && 'is-out'].filter(Boolean).join(' ')

  return createPortal(
    <div className={className} onPointerDown={(event) => event.target === event.currentTarget && close()}>
      <div
        ref={panel}
        className={dragging ? 'ov-panel is-dragging' : 'ov-panel'}
        style={{ ...tone, transform: dy ? `translateY(${dy}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="ov-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <i aria-hidden="true" />
          <div className="ov-head">
            {onBack && (
              <button className="ov-btn" type="button" aria-label="Назад" onClick={onBack}>
                <CaretLeft size={18} weight="bold" aria-hidden="true" />
              </button>
            )}
            <div className="ov-title">
              {kicker && <p>{kicker}</p>}
              <h2 id={titleId}>{title}</h2>
            </div>
            <button className="ov-btn" type="button" aria-label="Закрыть" onClick={close}>
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="ov-body">{typeof children === 'function' ? children({ close }) : children}</div>
        {footer && <div className="ov-foot">{typeof footer === 'function' ? footer({ close }) : footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
