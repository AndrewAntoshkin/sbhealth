import { Gauge, House, PersonSimple } from '@phosphor-icons/react'

export type DockTab = 'home' | 'atlas' | 'index'

const ITEMS: { id: DockTab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'atlas', label: 'Атлас', icon: PersonSimple },
  { id: 'index', label: 'Индекс', icon: Gauge },
]

/** Плавающая навигация: активный пункт раскрывается в подпись. */
export function Dock({ active, onGo }: { active: DockTab; onGo: (tab: DockTab, el: HTMLElement) => void }) {
  return (
    <nav className="dock" aria-label="Разделы">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={id === active ? 'dock-item is-on' : 'dock-item'}
          aria-current={id === active ? 'page' : undefined}
          aria-label={label}
          onClick={(event) => onGo(id, event.currentTarget)}
        >
          <Icon size={22} weight={id === active ? 'fill' : 'regular'} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
