import { useSyncExternalStore } from 'react'
import { ARTICLES } from './data/articles'
import { doctorFor, roleTo } from './data/doctors'
import { RISK_LABEL, SYSTEMS, levelOf, systemById, type BodySystem, type SystemId } from './data/systems'
import { ATTENTION, INDEX, ORDER, ORGAN_TITLE, TONE, ZONES_TITLE } from './shared'
import { nextAppointment } from './store'
import { fmtWhen } from './time'

export interface AiAction {
  label: string
  to: string
}

export interface AiMsg {
  id: string
  from: 'me' | 'ai'
  text: string
  points?: string[]
  facts?: string[]
  actions?: AiAction[]
  /** ответ ещё «печатается» */
  live?: boolean
}

type State = { msgs: AiMsg[]; thinking: boolean }

let state: State = { msgs: [], thinking: false }
const subs = new Set<() => void>()
const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  subs.forEach((fn) => fn())
}

export const useAssistant = () =>
  useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => state,
  )

let pending: string | null = null
/** Вопрос, который задали с другого экрана: ассистент задаст его сам при открытии. */
export const queueQuestion = (q: string) => {
  pending = q
}
export const takeQueued = () => {
  const q = pending
  pending = null
  return q
}

const uid = () => Math.random().toString(36).slice(2, 9)

// ——— Распознавание темы ———

const WORDS: [SystemId, RegExp][] = [
  ['hematopoietic', /костн\S* мозг|кроветвор/],
  ['cardiovascular', /сердц|сосуд|давлен|пульс|холестер|лпнп|липид|кардио/],
  ['nervous', /мозг|нерв|сон|сна|сплю|стресс|вср|устал|голов/],
  ['endocrine', /гормон|глюкоз|сахар|поджелуд|эндокрин|инсулин|талия|диабет|щитовид/],
  ['musculoskeletal', /спин|позвон|поясниц|сустав|кост|шаг|опор|сидя/],
  ['digestive', /жкт|желуд|кишеч|печен|пищевар|стул|ужин|еда/],
  ['hematopoietic', /кров|гемоглоб|феррит|железо|анеми/],
  ['respiratory', /дыхан|лёгк|легк|одышк|кашл|spo/],
  ['urinary', /почк|моч|отёк|отек|креатин/],
  ['integumentary', /кож|витамин d/],
  ['immune', /иммун|орви|простуд|антибиот/],
  ['lymphatic', /лимф|узл|селезён/],
  ['sensory', /зрен|слух|глаз|ух[оа]/],
  ['reproductive', /репродукт|простат|мужск/],
]

function topicOf(q: string): BodySystem | null {
  const text = q.toLowerCase()
  for (const [id, re] of WORDS) if (re.test(text)) return systemById(id)
  const byName = SYSTEMS.find((s) => text.includes(s.name.toLowerCase().slice(0, 6)) || text.includes(ORGAN_TITLE[s.id].toLowerCase().slice(0, 5)))
  return byName ?? null
}

const articleFor = (id: SystemId) => ARTICLES.find((a) => a.systemId === id)

function systemActions(s: BodySystem): AiAction[] {
  const doc = doctorFor(s.id)
  const out: AiAction[] = [{ label: `Показать в атласе`, to: `#/atlas/${s.id}` }, { label: `Записаться к ${roleTo(doc)}`, to: `#/doctors/${doc.id}` }]
  const art = articleFor(s.id)
  if (art) out.push({ label: `Статья: ${art.title}`, to: `#/learn/${art.id}` })
  return out
}

const facts = (s: BodySystem) => s.metrics.slice(0, 3).map((m) => `${m.label}: ${m.value} — ${m.hint.toLowerCase()}`)

// ——— Ответы ———

function answer(q: string, about: SystemId | null): Omit<AiMsg, 'id' | 'from'> {
  const text = q.toLowerCase()

  if (/боль в груд|давит в груд|не могу дышать|задыха|потерял сознан|онемел/.test(text)) {
    return {
      text: 'Это может быть срочно. Не ждите ответа в приложении: позвоните 103 или 112 и опишите, что чувствуете.',
      actions: [{ label: 'Позвонить 103', to: 'tel:103' }],
    }
  }

  if (/индекс|балл|64|общ(ая|ую) картин/.test(text)) {
    const top = ORDER.slice(0, 3)
    return {
      text: `Индекс здоровья — ${INDEX} из 100: «${TONE.toLowerCase()}». Это средний «запас» по всем 13 системам. Сильнее всего его тянут вниз три системы:`,
      points: top.map((s) => `${ORGAN_TITLE[s.id]} — риск ${s.risk} из 100, ${RISK_LABEL[levelOf(s.risk)].toLowerCase()}`),
      facts: ['Индекс не диагноз: он показывает, с чего начать разговор с врачом.'],
      actions: [{ label: 'Как считается индекс', to: '#/home/index' }, { label: 'Открыть атлас', to: '#/atlas' }],
    }
  }

  const topic = topicOf(q) ?? (about ? systemById(about) : null)

  if (topic && /спрос|вопрос/.test(text)) {
    return {
      text: `Что стоит спросить у врача про «${ORGAN_TITLE[topic.id]}»:`,
      points: [
        ...topic.metrics.slice(0, 2).map((m) => `${m.label} ${m.value}: это повод для анализа или достаточно наблюдать?`),
        'Какие измерения вести дома и как часто?',
        'Когда пересдать анализы, чтобы увидеть динамику?',
      ],
      actions: systemActions(topic).slice(1),
    }
  }

  if (/запис|к кому|какой врач|врач[ау]? |специалист/.test(text)) {
    const s = topic ?? ORDER[0]
    const doc = doctorFor(s.id)
    const appt = nextAppointment()
    return {
      text: appt
        ? `У вас уже есть запись: ${fmtWhen(appt.start)}. Если хотите обсудить ещё и «${ORGAN_TITLE[s.id]}», лучше всего подойдёт ${doc.role.toLowerCase()} ${doc.name}.`
        : `С темой «${ORGAN_TITLE[s.id]}» лучше всего к ${roleTo(doc)}: ${doc.name}, стаж ${doc.years} лет, рейтинг ${doc.rating}. Приём займёт 30 минут, можно по видео.`,
      actions: [{ label: `Записаться к ${roleTo(doc)}`, to: `#/doctors/${doc.id}` }, { label: 'Все врачи', to: '#/doctors' }],
    }
  }

  if (topic && /сниз|улучш|что делать|как быть|помоч|исправ|совет/.test(text)) {
    return {
      text: `${topic.advice} Небольшие шаги, которые обычно помогают:`,
      points: TIPS[topic.id] ?? TIPS.default,
      facts: facts(topic).slice(0, 2),
      actions: systemActions(topic),
    }
  }

  if (topic) {
    const level = levelOf(topic.risk)
    return {
      text: `«${ORGAN_TITLE[topic.id]}» — риск ${topic.risk} из 100, ${RISK_LABEL[level].toLowerCase()}. ${topic.summary} ${topic.meaning}`,
      facts: facts(topic),
      actions: systemActions(topic),
    }
  }

  return {
    text: `Я отвечаю по данным вашего атласа: показателям, анализам и записям. Сейчас главное — ${ZONES_TITLE.toLowerCase()}:`,
    points: ATTENTION.map((s) => `${ORGAN_TITLE[s.id]}: ${s.summary.charAt(0).toLowerCase()}${s.summary.slice(1)}`),
    actions: [{ label: 'Открыть атлас', to: '#/atlas' }],
  }
}

const TIPS: Partial<Record<SystemId | 'default', string[]>> = {
  cardiovascular: ['Мерить давление утром и вечером 7 дней подряд', 'Меньше соли: готовая еда и соусы дают большую часть', '30 минут быстрой ходьбы в день'],
  nervous: ['Ложиться в одно время, даже в выходные', 'Без экрана за час до сна', 'Короткая прогулка днём снижает вечернюю тревогу'],
  endocrine: ['Ужинать за 3 часа до сна', 'Меньше сладких напитков', 'Пересдать глюкозу натощак и HbA1c'],
  musculoskeletal: ['Вставать каждые 45 минут', 'Цель — 7 000 шагов в день', 'Простая разминка для поясницы утром'],
  default: ['Вести короткий дневник самочувствия', 'Обсудить показатели на ближайшем приёме'],
}

// ——— Диалог ———

export function ask(q: string, about: SystemId | null = null) {
  const question = q.trim()
  if (!question || state.thinking) return
  set({ msgs: [...state.msgs, { id: uid(), from: 'me', text: question }], thinking: true })

  const reply = answer(question, about)
  window.setTimeout(() => {
    const id = uid()
    const words = reply.text.split(' ')
    set({ thinking: false, msgs: [...state.msgs, { id, from: 'ai', ...reply, text: '', live: true }] })
    let shown = 0
    const step = () => {
      shown = Math.min(words.length, shown + 3)
      const done = shown >= words.length
      set({ msgs: state.msgs.map((m) => (m.id === id ? { ...m, text: words.slice(0, shown).join(' '), live: !done } : m)) })
      if (!done) window.setTimeout(step, 45)
    }
    step()
  }, 650)
}

export function resetAssistant() {
  set({ msgs: [], thinking: false })
}

/** Подсказки на старте: зависят от того, откуда открыли ассистента. */
export function suggestions(about: SystemId | null): string[] {
  if (about) {
    const t = ORGAN_TITLE[about]
    return [`Почему «${t}» в ${zone(about)} зоне?`, `Как улучшить показатели?`, `Что спросить у врача?`, `К кому записаться?`]
  }
  const top = ORDER[0]
  return [`Почему «${ORGAN_TITLE[top.id]}» в красной зоне?`, 'Объясни индекс здоровья', 'Как снизить ЛПНП?', 'К кому записаться в первую очередь?']
}

function zone(id: SystemId) {
  const l = levelOf(systemById(id).risk)
  return l === 'high' ? 'красной' : l === 'elevated' ? 'оранжевой' : l === 'watch' ? 'жёлтой' : 'зелёной'
}
