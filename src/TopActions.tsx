import { useState } from 'react'
import { BellSimple } from '@phosphor-icons/react'
import { Notifications } from './Notifications'
import { AVATAR } from './shared'
import { unreadNotifs, useCore } from './store'

/** Колокольчик с уведомлениями и аватар профиля: общий для экранов-вкладок. */
export function TopActions({ go, avatar = true }: { go: (to: string) => void; avatar?: boolean }) {
  const [open, setOpen] = useState(false)
  const unread = unreadNotifs(useCore())

  return (
    <>
      <div className="top-actions">
        <button className="hm-bell" type="button" aria-label={unread ? `Уведомления, новых: ${unread}` : 'Уведомления'} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <BellSimple size={24} weight="duotone" aria-hidden="true" />
          {unread > 0 && <em aria-hidden="true">{unread}</em>}
        </button>
        {avatar && (
          <button className="ta-ava" type="button" aria-label="Профиль" onClick={() => go('#/profile')}>
            <img src={AVATAR} alt="" width="50" height="50" decoding="async" draggable={false} />
          </button>
        )}
      </div>
      {open && (
        <Notifications
          onClose={() => setOpen(false)}
          onGo={(to) => {
            setOpen(false)
            go(to)
          }}
        />
      )}
    </>
  )
}
