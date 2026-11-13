export type SystemId =
  | 'integumentary'
  | 'nervous'
  | 'sensory'
  | 'endocrine'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'reproductive'
  | 'immune'
  | 'lymphatic'
  | 'musculoskeletal'
  | 'hematopoietic'

export type RiskLevel = 'low' | 'watch' | 'elevated' | 'high'

export interface Metric {
  label: string
  value: string
  hint: string
}

export interface BodySystem {
  id: SystemId
  name: string
  short: string
  risk: number
  /** Closest the camera should come, so small organs stay in context. */
  focus: number
  covers: string
  summary: string
  meaning: string
  advice: string
  metrics: Metric[]
}

export const MESH_COLOR: Record<RiskLevel, string> = {
  low: '#34C067',
  watch: '#F0B429',
  elevated: '#F27A1A',
  high: '#E23445',
}

export const RISK_INK: Record<RiskLevel, string> = {
  low: '#0E7A28',
  watch: '#8A5A00',
  elevated: '#B04508',
  high: '#C41428',
}

export const RISK_SOFT: Record<RiskLevel, string> = {
  low: '#E5F6EB',
  watch: '#FFF6D8',
  elevated: '#FDE8D4',
  high: '#FDE4E7',
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Низкий',
  watch: 'Внимание',
  elevated: 'Повышен',
  high: 'Высокий',
}

export const SYSTEMS: BodySystem[] = [
  {
    id: 'cardiovascular',
    name: 'Сердечно-сосудистая',
    short: 'Сердце',
    risk: 76,
    focus: 2.55,
    covers: 'Сердце, аорта и крупные сосуды',
    summary: 'Самый тёплый контур: липиды и давление выше спокойного диапазона.',
    meaning:
      'Это сочетание недосыпа, соли и малого движения. Цвет не ставит диагноз — он показывает, куда смотреть в первую очередь.',
    advice: 'Терапевту имеет смысл показать липидный профиль и несколько домашних измерений давления.',
    metrics: [
      { label: 'ЛПНП', value: '4,6 ммоль/л', hint: 'Выше обычного ориентира' },
      { label: 'Давление', value: '132/86', hint: 'Среднее за 7 дней' },
      { label: 'Пульс в покое', value: '78', hint: 'Чуть чаще привычного' },
    ],
  },
  {
    id: 'nervous',
    name: 'Нервная',
    short: 'Нервная',
    risk: 64,
    focus: 2.7,
    covers: 'Головной мозг и спинной мозг',
    summary: 'Сон короткий, восстановление не успевает за нагрузкой.',
    meaning:
      'На модели подсвечены мозг и спинной мозг. Повышенный цвет здесь — про режим, а не про острую неврологию.',
    advice: 'Имеет смысл сначала выровнять сон. Если головная боль или онемение держатся, это уже разговор с неврологом.',
    metrics: [
      { label: 'Сон', value: '5 ч 40 мин', hint: 'Среднее за неделю' },
      { label: 'Стресс', value: 'высокий', hint: 'Субъективная шкала' },
      { label: 'ВСР', value: 'снижена', hint: 'Восстановление слабее' },
    ],
  },
  {
    id: 'endocrine',
    name: 'Эндокринная',
    short: 'Гормоны',
    risk: 61,
    focus: 2.45,
    covers: 'Поджелудочная, гипоталамус и эпифиз',
    summary: 'Глюкоза натощак уже не в спокойной зоне.',
    meaning:
      'Крупнее всего на модели читается поджелудочная. Гипоталамус и эпифиз сидят в глубине мозга и на телефоне почти не видны. Щитовидной железы и надпочечников в этой модели нет.',
    advice: 'Повторить глюкозу натощак и обсудить с врачом, нужен ли гликированный гемоглобин.',
    metrics: [
      { label: 'Глюкоза', value: '6,3 ммоль/л', hint: 'Натощак' },
      { label: 'Талия', value: '94 см', hint: 'Есть запас для снижения' },
      { label: 'Энергия днём', value: 'провалы', hint: 'После обеда' },
    ],
  },
  {
    id: 'musculoskeletal',
    name: 'Опорно-двигательная',
    short: 'Опора',
    risk: 58,
    focus: 2.85,
    covers: 'Позвоночник, таз и кости ног',
    summary: 'Шея и поясница устают быстрее, чем мышцы успевают их держать.',
    meaning:
      'В этом референсе хорошо видны позвоночник, таз и ноги. Руки и рёбра в сборке не размечены, поэтому цвет стоит на том, что есть.',
    advice: 'Добавить ходьбу и разгрузить стол. Если боль отдаёт в ногу или не проходит ночью — к неврологу или ортопеду.',
    metrics: [
      { label: 'Шаги', value: '4 800', hint: 'Среднее за неделю' },
      { label: 'Сидя', value: '9 ч', hint: 'Рабочий день' },
      { label: 'Жалоба', value: 'поясница', hint: 'К вечеру' },
    ],
  },
  {
    id: 'digestive',
    name: 'Пищеварительная',
    short: 'ЖКТ',
    risk: 47,
    focus: 2.5,
    covers: 'Печень, желчный пузырь и кишечник',
    summary: 'Тяжесть после еды, без острых признаков.',
    meaning: 'Цвет собрали печень, желчный пузырь с протоками, тонкий и толстый кишечник. Желудка в этой модели нет. Это зона наблюдения, не повод для срочного обследования.',
    advice: 'Заметить, после какой еды становится тяжело. Если появится боль справа или желтизна — к врачу раньше планового визита.',
    metrics: [
      { label: 'Стул', value: 'нестабильный', hint: 'Пару раз за неделю' },
      { label: 'Печень, АЛТ', value: 'в норме', hint: 'Прошлый анализ' },
      { label: 'Режим еды', value: 'поздний', hint: 'Ужин после 21:00' },
    ],
  },
  {
    id: 'hematopoietic',
    name: 'Кроветворная',
    short: 'Кровь',
    risk: 43,
    focus: 2.55,
    covers: 'Красный костный мозг в костях таза',
    summary: 'Ферритин на нижней границе, гемоглобин пока держится.',
    meaning:
      'У взрослого кровь образуется в красном костном мозге, а он лежит внутри губчатой кости — больше всего в тазе. Поэтому подсвечены кости таза: сам мозг спрятан внутри них.',
    advice: 'Имеет смысл пересдать ферритин и общий анализ крови и не начинать железо самостоятельно.',
    metrics: [
      { label: 'Гемоглобин', value: '138 г/л', hint: 'В пределах ориентира' },
      { label: 'Ферритин', value: '22 мкг/л', hint: 'Нижняя зона' },
      { label: 'Усталость', value: 'к вечеру', hint: 'Не каждый день' },
    ],
  },
  {
    id: 'integumentary',
    name: 'Покровная',
    short: 'Кожа',
    risk: 22,
    focus: 3.7,
    covers: 'Кожа',
    summary: 'Кожа спокойная, отдельных жалоб нет.',
    meaning: 'Это внешний силуэт. Нажмите на руку или на свободное место фигуры — подсветится именно она.',
    advice: 'Плановый осмотр родинок раз в год. Сейчас повод для записи не виден.',
    metrics: [
      { label: 'Жалобы', value: 'нет', hint: 'Без жалоб' },
      { label: 'Витамин D', value: 'норма', hint: 'Прошлый сезон' },
      { label: 'Осмотр', value: 'не срочно', hint: 'Планово' },
    ],
  },
  {
    id: 'lymphatic',
    name: 'Лимфатическая',
    short: 'Лимфа',
    risk: 21,
    focus: 2.5,
    covers: 'Селезёнка',
    summary: 'Узлы не беспокоят, селезёнка без отклонения.',
    meaning: 'На модели систему представляет селезёнка. Мелкая сеть сосудов на масштабе телефона не читается.',
    advice: 'Отдельное обследование не требуется, пока нет длительного увеличения узлов или необъяснимой температуры.',
    metrics: [
      { label: 'Узлы', value: 'не увеличены', hint: 'Со слов' },
      { label: 'Температура', value: 'нет', hint: 'Последние недели' },
      { label: 'Селезёнка', value: 'спокойно', hint: 'Нет жалоб' },
    ],
  },
  {
    id: 'immune',
    name: 'Иммунная',
    short: 'Иммунитет',
    risk: 19,
    focus: 2.55,
    covers: 'Тимус и миндалины',
    summary: 'Простуды редкие, затяжных инфекций нет.',
    meaning: 'Цвет собран на тимусе и миндалинах. Это спокойный контур.',
    advice: 'Ничего срочного. Прививки и плановые осмотры — по календарю, не из-за этого экрана.',
    metrics: [
      { label: 'ОРВИ за год', value: '1', hint: 'Короткий эпизод' },
      { label: 'Антибиотики', value: 'нет', hint: 'Последний год' },
      { label: 'Восстановление', value: 'обычное', hint: '3–4 дня' },
    ],
  },
  {
    id: 'reproductive',
    name: 'Репродуктивная',
    short: 'Репродуктивная',
    risk: 16,
    focus: 2.9,
    covers: 'Простата и семенные пузырьки',
    summary: 'Жалоб нет и нет повода для срочного визита.',
    meaning: 'Референс мужской. Камера не приближается вплотную: система остаётся в контексте всего тела.',
    advice: 'Плановый осмотр по возрасту. Этот экран его не заменяет и не назначает.',
    metrics: [
      { label: 'Жалобы', value: 'нет', hint: 'Без жалоб' },
      { label: 'Осмотр', value: 'плановый', hint: 'Не срочно' },
      { label: 'Отклонения', value: 'не видны', hint: 'По данным осмотра' },
    ],
  },
  {
    id: 'respiratory',
    name: 'Дыхательная',
    short: 'Дыхание',
    risk: 14,
    focus: 2.55,
    covers: 'Лёгкие и дыхательные пути',
    summary: 'Дыхание ровное, одышки в покое нет.',
    meaning: 'Подсвечены лёгкие, гортань, трахея и бронхи. Низкий цвет значит, что здесь нет сигнала.',
    advice: 'Если появится одышка, кашель дольше трёх недель или кровь — это уже повод к врачу.',
    metrics: [
      { label: 'Одышка', value: 'нет', hint: 'В покое и на лестнице' },
      { label: 'Кашель', value: 'нет', hint: 'Последний месяц' },
      { label: 'SpO₂', value: '98%', hint: 'Разовое измерение' },
    ],
  },
  {
    id: 'sensory',
    name: 'Органы чувств',
    short: 'Чувства',
    risk: 12,
    focus: 2.35,
    covers: 'Глаза',
    summary: 'Зрение без новых жалоб.',
    meaning: 'В этой сборке видны глаза — они и забирают цвет системы. Уши в референсе отдельно не выделены.',
    advice: 'Проверка зрения планово. Внезапная пелена, вспышки или резкая потеря слуха — повод не ждать.',
    metrics: [
      { label: 'Зрение', value: 'привычное', hint: 'Очки не менялись' },
      { label: 'Слух', value: 'без жалоб', hint: 'Без жалоб' },
      { label: 'Осмотр', value: 'плановый', hint: 'Не из-за риска' },
    ],
  },
  {
    id: 'urinary',
    name: 'Мочевыделительная',
    short: 'Почки',
    risk: 11,
    focus: 2.5,
    covers: 'Почки и мочевой пузырь',
    summary: 'Почки и мочевой пузырь спокойные.',
    meaning: 'Цвет на почках, мочеточниках, мочевом пузыре и уретре. Низкий риск здесь просто означает отсутствие сигнала в тестовых данных.',
    advice: 'Пить воду по жажде. Боль в пояснице с температурой или кровь в моче — не ждать планового приёма.',
    metrics: [
      { label: 'Мочеиспускание', value: 'обычное', hint: 'Без рези' },
      { label: 'Отёки', value: 'нет', hint: 'Утром' },
      { label: 'Креатинин', value: 'в норме', hint: 'Прошлый анализ' },
    ],
  },
]

export function levelOf(risk: number): RiskLevel {
  if (risk >= 70) return 'high'
  if (risk >= 50) return 'elevated'
  if (risk >= 34) return 'watch'
  return 'low'
}

export function healthIndex(list: BodySystem[] = SYSTEMS): number {
  const score = list.reduce((sum, system) => sum + (100 - system.risk), 0) / list.length
  return Math.round(score)
}

export function indexTone(index: number): string {
  if (index >= 75) return 'Спокойная картина'
  if (index >= 55) return 'Есть зоны внимания'
  return 'Стоит разобраться'
}

export function systemsByRisk(): BodySystem[] {
  return [...SYSTEMS].sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name, 'ru'))
}

export function systemById(id: SystemId): BodySystem {
  const found = SYSTEMS.find((system) => system.id === id)
  if (!found) throw new Error(`Unknown system ${id}`)
  return found
}
