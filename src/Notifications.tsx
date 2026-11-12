import { BellSimple, CalendarCheck, CalendarX, ChatCircleText, Lightbulb, Pulse } from '@phosphor-icons/react'
import { Overlay } from './Overlay'
import { markAllNotifsRead, markNotifRead, useCore, type Notif } from './store'
import { rel } from './time'

const ICON: Record<Notif['kind'], typeof BellSimple> = {
  booking: CalendarCheck,
  cancel: CalendarX,
  message: ChatCircleText,
  result: Pulse,
  tip: Lightbulb,
}

export function Notifications({ onClose, onGo }: { onClose: () => void; onGo: (to: string) => void }) {
  const { notifs } = useCore()
  const unread = notifs.filter((n) => !n.read)
  const earlier = notifs.filter((n) => n.read)

  const item = (n: Notif) => {
    const Icon = ICON[n.kind]
    const body = (
      <>
        <span className={`nt-ico is-${n.kind}`}>
          <Icon size={22} weight="duotone" aria-hidden="true" />
        </span>
        <span className="nt-copy">
          <span className="nt-top">
            <b>{n.title}</b>
            <time dateTime={new Date(n.at).toISOString()}>{rel(n.at)}</time>
          </span>
          <span className="nt-text">{n.text}</span>
        </span>
        {!n.read && <i className="nt-dot" aria-label="Не прочитано" />}
      </>
    )
    return (
      <li key={n.id}>
        {n.to ? (
          <button
            type="button"
            className="nt-item"
            onClick={() => {
              markNotifRead(n.id)
              onGo(n.to as string)
            }}
          >
            {body}
          </button>
        ) : (
          <button type="button" className="nt-item" onClick={() => markNotifRead(n.id)}>
            {body}
          </button>
        )}
      </li>
    )
  }

  return (
    <Overlay kicker={unread.length ? `${unread.length} нов.` : 'Всё прочитано'} title="Уведомления" variant="drawer" onClose={onClose}>
      <div className="nt">
        {unread.length > 0 && (
          <div className="nt-bar">
            <button type="button" className="text-btn" onClick={markAllNotifsRead}>
              Прочитать все
            </button>
          </div>
        )}
        {notifs.length === 0 && <p className="nt-empty">Пока тихо. Здесь появятся подтверждения записей и советы.</p>}
        {unread.length > 0 && (
          <section aria-label="Новые">
            <h3 className="bk-h">Новые</h3>
            <ul className="nt-list">{unread.map(item)}</ul>
          </section>
        )}
        {earlier.length > 0 && (
          <section aria-label="Раньше">
            <h3 className="bk-h">Раньше</h3>
            <ul className="nt-list">{earlier.map(item)}</ul>
          </section>
        )}
      </div>
    </Overlay>
  )
}
