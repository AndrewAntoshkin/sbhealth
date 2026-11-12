import { ChatCircleText, House, PersonSimple } from '@phosphor-icons/react'
import { AVATAR } from '../shared'
import { unreadMessages, useCore } from '../store'

export type DockTab = 'home' | 'atlas' | 'messages' | 'profile'

const ITEMS: { id: DockTab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'atlas', label: 'Атлас', icon: PersonSimple },
  { id: 'messages', label: 'Сообщения', icon: ChatCircleText },
  { id: 'profile', label: 'Профиль', icon: PersonSimple },
]

/** Плавающая навигация: активный пункт раскрывается в подпись. */
export function Dock({ active, onGo }: { active: DockTab; onGo: (tab: DockTab, el: HTMLElement) => void }) {
  const unread = unreadMessages(useCore())
  return (
    <nav className="dock" aria-label="Разделы">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={id === active ? 'dock-item is-on' : 'dock-item'}
          aria-current={id === active ? 'page' : undefined}
          aria-label={id === 'messages' && unread ? `${label}, новых: ${unread}` : label}
          onClick={(event) => onGo(id, event.currentTarget)}
        >
          {id === 'profile' ? (
            <img className="dock-ava" src={AVATAR} alt="" width="28" height="28" draggable={false} />
          ) : (
            <Icon size={22} weight={id === active ? 'fill' : 'regular'} aria-hidden="true" />
          )}
          <span>{label}</span>
          {id === 'messages' && unread > 0 && <em className="dock-badge" aria-hidden="true">{unread}</em>}
        </button>
      ))}
    </nav>
  )
}
