import { useSyncExternalStore } from 'react'
import { SYSTEMS, healthIndex, systemById, type SystemId } from './data/systems'
import { ORGAN_TITLE } from './shared'
import { fmtDm, fmtTime, fmtWhen } from './time'

export type Mode = 'video' | 'clinic'

export interface Appointment {
  id: string
  systemId: SystemId
  start: number
  mode: Mode
  share: boolean
  status: 'booked' | 'cancelled'
}

export interface Notif {
  id: string
  kind: 'booking' | 'cancel' | 'message' | 'result' | 'tip'
  title: string
  text: string
  at: number
  read: boolean
  /** hash-маршрут, куда ведёт уведомление */
  to?: string
}

export interface Msg {
  id: string
  from: 'them' | 'me'
  text: string
  at: number
  /** карточка записи внутри сообщения */
  appt?: string
}

export interface Thread {
  id: string
  name: string
  role: string
  initials: string
  doctor?: boolean
  unread: number
  msgs: Msg[]
}

interface Core {
  appts: Appointment[]
  notifs: Notif[]
  threads: Thread[]
}

export const DOCTOR = { id: 't-doc', name: 'Анна Соколова', role: 'Терапевт', initials: 'АС' }
export const TEAM = { id: 't-team', name: 'Команда Атласа', role: 'Поддержка', initials: 'А' }

export const DURATION: Record<Mode, number> = { video: 30, clinic: 40 }
export const MODE_LABEL: Record<Mode, string> = { video: 'Видео', clinic: 'В клинике' }
export const CLINIC = 'Клиника «Атлас», Тверская, 12'

const KEY = 'atlas-demo-v1'
const uid = () => Math.random().toString(36).slice(2, 9)

function seed(): Core {
  const now = Date.now()
  const index = healthIndex()
  return {
    appts: [],
    notifs: [
      {
        id: uid(),
        kind: 'result',
        title: 'Индекс здоровья обновлён',
        text: `Сейчас ${index} из 100. Сильнее всего его тянет вниз сердечно-сосудистая система.`,
        at: now - 3 * 3_600_000,
        read: false,
        to: '#/atlas/cardiovascular',
      },
      {
        id: uid(),
        kind: 'tip',
        title: 'Совет недели',
        text: 'Короткий сон сильнее всего влияет на нервную систему. Попробуйте ложиться на полчаса раньше.',
        at: now - 27 * 3_600_000,
        read: false,
        to: '#/atlas/nervous',
      },
    ],
    threads: [
      {
        ...TEAM,
        unread: 1,
        msgs: [
          {
            id: uid(),
            from: 'them',
            at: now - 2 * 3_600_000,
            text: 'Здравствуйте! Это демо «Атласа систем»: данные условные и не заменяют врача. Здесь будут сообщения от врача и подсказки по вашим системам.',
          },
        ],
      },
    ],
  }
}

function load(): Core {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as Core
      if (Array.isArray(data.appts) && Array.isArray(data.notifs) && Array.isArray(data.threads)) return data
    }
  } catch {
    /* приватный режим или битые данные — начинаем с чистого листа */
  }
  return seed()
}

let core: Core = load()
const listeners = new Set<() => void>()

function set(next: Core) {
  core = next
  try {
    localStorage.setItem(KEY, JSON.stringify(core))
  } catch {
    /* хранилище недоступно: демо работает до перезагрузки */
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useCore = () => useSyncExternalStore(subscribe, () => core)

/* ——— временное состояние: не сохраняется ——— */

export interface Toast {
  id: string
  title: string
  text: string
  to?: string
}

interface Live {
  toasts: Toast[]
  typing: string | null
  viewing: string | null
}

let live: Live = { toasts: [], typing: null, viewing: null }
const liveListeners = new Set<() => void>()

function setLive(patch: Partial<Live>) {
  live = { ...live, ...patch }
  liveListeners.forEach((fn) => fn())
}

export const useLive = () =>
  useSyncExternalStore(
    (fn) => {
      liveListeners.add(fn)
      return () => liveListeners.delete(fn)
    },
    () => live,
  )

export function toast(item: Omit<Toast, 'id'>) {
  const id = uid()
  setLive({ toasts: [...live.toasts, { ...item, id }] })
  return id
}

export const dismissToast = (id: string) => setLive({ toasts: live.toasts.filter((t) => t.id !== id) })

/* ——— выборки ——— */

export const nextAppointment = (appts: Appointment[] = core.appts) =>
  appts
    .filter((a) => a.status === 'booked' && a.start > Date.now() - 30 * 60_000)
    .sort((a, b) => a.start - b.start)[0] ?? null

export const unreadNotifs = (state: Core) => state.notifs.filter((n) => !n.read).length
export const unreadMessages = (state: Core) => state.threads.reduce((sum, t) => sum + t.unread, 0)

/* ——— действия ——— */

function pushNotif(state: Core, item: Omit<Notif, 'id' | 'at' | 'read'>): Core {
  return { ...state, notifs: [{ ...item, id: uid(), at: Date.now(), read: false }, ...state.notifs] }
}

function pushMessage(state: Core, threadId: string, msg: Omit<Msg, 'id' | 'at'>, unread: boolean): Core {
  const item: Msg = { ...msg, id: uid(), at: Date.now() }
  return {
    ...state,
    threads: state.threads.map((t) => (t.id === threadId ? { ...t, msgs: [...t.msgs, item], unread: unread ? t.unread + 1 : t.unread } : t)),
  }
}

function ensureDoctor(state: Core): Core {
  if (state.threads.some((t) => t.id === DOCTOR.id)) return state
  return { ...state, threads: [{ ...DOCTOR, doctor: true, unread: 0, msgs: [] }, ...state.threads] }
}

export function book(input: { systemId: SystemId; start: number; mode: Mode; share: boolean; replaceId?: string }): Appointment {
  const appt: Appointment = { id: uid(), systemId: input.systemId, start: input.start, mode: input.mode, share: input.share, status: 'booked' }
  const moved = Boolean(input.replaceId)
  const organ = ORGAN_TITLE[input.systemId]
  let next: Core = {
    ...core,
    appts: [appt, ...core.appts.map((a) => (a.id === input.replaceId ? { ...a, status: 'cancelled' as const } : a))],
  }
  next = ensureDoctor(next)
  next = pushNotif(next, {
    kind: 'booking',
    title: moved ? 'Запись перенесена' : 'Запись подтверждена',
    text: `${fmtWhen(appt.start)} · ${DOCTOR.name}, ${input.mode === 'video' ? 'видео' : 'в клинике'}`,
    to: `#/messages/${DOCTOR.id}`,
  })
  const hello = moved
    ? `Перенесла приём на ${fmtDm(appt.start)}, ${fmtTime(appt.start)}.`
    : `Здравствуйте! Записала вас на ${fmtDm(appt.start)} в ${fmtTime(appt.start)}. Тема — «${organ}».`
  next = pushMessage(next, DOCTOR.id, { from: 'them', text: hello, appt: appt.id }, true)
  next = pushMessage(
    next,
    DOCTOR.id,
    {
      from: 'them',
      text: input.share
        ? `Данные по системе «${systemById(input.systemId).name}» из атласа получила, посмотрю до встречи. Если что-то изменится, напишите сюда.`
        : 'Если захотите, пришлите показатели сюда — посмотрю до встречи.',
    },
    true,
  )
  set(next)
  toast({
    title: moved ? 'Запись перенесена' : 'Вы записаны к терапевту',
    text: `${fmtWhen(appt.start)} · ${DOCTOR.name}`,
    to: `#/messages/${DOCTOR.id}`,
  })
  return appt
}

export function cancelAppointment(id: string) {
  const appt = core.appts.find((a) => a.id === id)
  if (!appt) return
  let next: Core = { ...core, appts: core.appts.map((a) => (a.id === id ? { ...a, status: 'cancelled' as const } : a)) }
  next = pushNotif(next, { kind: 'cancel', title: 'Запись отменена', text: `${fmtWhen(appt.start)} · ${ORGAN_TITLE[appt.systemId]}` })
  set(next)
}

export function markNotifRead(id: string) {
  set({ ...core, notifs: core.notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) })
}

export function markAllNotifsRead() {
  if (!core.notifs.some((n) => !n.read)) return
  set({ ...core, notifs: core.notifs.map((n) => ({ ...n, read: true })) })
}

/** Диалог открыт: сообщения считаются прочитанными. */
export function viewThread(id: string | null) {
  setLive({ viewing: id })
  if (!id) return
  const thread = core.threads.find((t) => t.id === id)
  if (!thread || (!thread.unread && !core.notifs.some((n) => !n.read && n.to === `#/messages/${id}`))) return
  set({
    ...core,
    threads: core.threads.map((t) => (t.id === id ? { ...t, unread: 0 } : t)),
    notifs: core.notifs.map((n) => (n.to === `#/messages/${id}` ? { ...n, read: true } : n)),
  })
}

function reply(text: string, appt: Appointment | null): string {
  const t = text.toLowerCase()
  if (/перен|друго[ей] врем|не смогу|не успе/.test(t)) return 'Конечно. Откройте запись на главной и выберите другое время — подтвержу сразу.'
  if (/подготов|принест|взять|натощак|анализ/.test(t))
    return appt ? 'Паспорт, полис и последние анализы. Если сдаёте кровь — лучше натощак. Остальное обсудим на приёме.' : 'Для первого приёма достаточно паспорта и полиса. Остальное обсудим вместе.'
  if (/спасибо|благодар/.test(t)) return 'Пожалуйста! До встречи.'
  if (/привет|здравств/.test(t)) return 'Здравствуйте! Чем могу помочь?'
  return 'Спасибо, поняла. Посмотрю и отвечу в течение рабочего дня.'
}

export function sendMessage(threadId: string, text: string) {
  const clean = text.trim()
  if (!clean) return
  set(pushMessage(core, threadId, { from: 'me', text: clean }, false))
  const thread = core.threads.find((t) => t.id === threadId)
  if (!thread) return
  setLive({ typing: threadId })
  window.setTimeout(() => {
    const viewing = live.viewing === threadId
    const body = thread.doctor ? reply(clean, nextAppointment()) : 'Спасибо, передали команде. В демо живого ответа нет, но в продукте он пришёл бы сюда.'
    let next = pushMessage(core, threadId, { from: 'them', text: body }, !viewing)
    if (!viewing) next = pushNotif(next, { kind: 'message', title: thread.name, text: body, to: `#/messages/${threadId}` })
    set(next)
    setLive({ typing: live.typing === threadId ? null : live.typing })
  }, 1500)
}

/** Первая система с высоким риском — на что рекомендуем записаться. */
export const topSystem = () => [...SYSTEMS].sort((a, b) => b.risk - a.risk)[0]
