const f = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ru-RU', options)

const SHORT = f({ weekday: 'short', day: 'numeric', month: 'long' })
const LONG = f({ weekday: 'long', day: 'numeric', month: 'long' })
const TIME = f({ hour: '2-digit', minute: '2-digit' })
const DAY_MONTH = f({ day: 'numeric', month: 'short' })

export const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const DM = f({ day: 'numeric', month: 'long' })
/** «14 ноября» */
export const fmtDm = (ts: number) => DM.format(ts)

/** «чт, 14 ноября» */
export const fmtDay = (ts: number) => SHORT.format(ts)
/** «четверг, 14 ноября» */
export const fmtDayLong = (ts: number) => LONG.format(ts)
/** «10:30» */
export const fmtTime = (ts: number) => TIME.format(ts)
/** «чт, 14 ноября, 10:30» */
export const fmtWhen = (ts: number) => `${fmtDay(ts)}, ${fmtTime(ts)}`

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** «только что», «12 мин», «3 ч», «вчера», «9 нояб.» */
export function rel(ts: number, now = Date.now()) {
  const diff = now - ts
  if (diff < 60_000) return 'только что'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин`
  if (startOfDay(now) <= ts) return `${Math.floor(diff / 3_600_000)} ч`
  if (startOfDay(now) - 86_400_000 <= ts) return 'вчера'
  return DAY_MONTH.format(ts).replace('.', '')
}

/** «сегодня», «завтра», «через 3 дня» */
export function inDays(ts: number, now = Date.now()) {
  const n = Math.round((startOfDay(ts) - startOfDay(now)) / 86_400_000)
  if (n <= 0) return 'сегодня'
  if (n === 1) return 'завтра'
  const last = n % 10
  const word = n % 100 > 10 && n % 100 < 15 ? 'дней' : last === 1 ? 'день' : last > 1 && last < 5 ? 'дня' : 'дней'
  return `через ${n} ${word}`
}
