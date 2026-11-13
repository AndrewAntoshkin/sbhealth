import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretLeft } from '@phosphor-icons/react'
import { TopActions } from './TopActions'

function useScrolled<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [scrolled, setScrolled] = useState(0)

  useEffect(() => {
    const scroller = ref.current?.closest('.screen') as HTMLElement | null
    if (!scroller) return
    const onScroll = () => setScrolled(scroller.scrollTop)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  return [ref, scrolled] as const
}

/** Шапка вкладки: одна и та же на Сводке, Атласе, Врачах и Сообщениях. */
export function TabHeader({
  title,
  sub,
  go,
  before,
  inert,
}: {
  title: string
  sub?: string
  go: (to: string) => void
  before?: ReactNode
  inert?: boolean
}) {
  const [ref, scrolled] = useScrolled<HTMLElement>()
  return (
    <header className={scrolled > 2 ? 'top tab-top is-scrolled' : 'top tab-top'} ref={ref} inert={inert || undefined}>
      <div className="tab-top-in">
        {before}
        <div className="top-title">
          <h1>{title}</h1>
          {sub && <p className="kicker">{sub}</p>}
        </div>
        <TopActions go={go} />
      </div>
    </header>
  )
}

/**
 * Навигационная панель как в iOS: прилипает к верху экрана, под ней прокручивается контент.
 * Пока виден крупный заголовок страницы, панель прозрачная; когда он ушёл вверх —
 * появляется материал с размытием и короткий заголовок по центру.
 */
export function NavBar({
  title,
  onBack,
  backLabel = 'Назад',
  left,
  right,
  titleAfter = 56,
}: {
  title: string
  onBack?: () => void
  backLabel?: string
  left?: ReactNode
  right?: ReactNode
  /** через сколько пикселей прокрутки показать короткий заголовок */
  titleAfter?: number
}) {
  const [ref, scrolled] = useScrolled<HTMLDivElement>()

  const cls = ['nav', scrolled > 2 && 'is-scrolled', scrolled > titleAfter && 'is-titled'].filter(Boolean).join(' ')

  return (
    <div className={cls} ref={ref}>
      <div className="nav-in">
        <div className="nav-side">
          {left}
          {onBack && (
            <button type="button" className="nav-btn" aria-label={backLabel} onClick={onBack}>
              <CaretLeft size={22} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="nav-title" aria-hidden="true">
          {title}
        </p>
        <div className="nav-side is-right">{right}</div>
      </div>
    </div>
  )
}
