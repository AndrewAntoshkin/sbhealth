/**
 * Русская типографика на лету: короткие предлоги, союзы и частицы не остаются
 * в конце строки, число не отрывается от единицы, тире не уезжает в начало строки.
 * Склеиваем неразрывными пробелами в текстовых узлах и следим за новыми.
 */
const NB = '\u00a0'
const SHORT =
  'в|во|на|с|со|к|ко|у|о|об|от|из|за|по|до|для|при|про|без|над|под|не|ни|и|а|но|да|же|бы|ли|или|как|что|то|ещё|уже|это|все|всё|без'
const WORD = new RegExp(`(?<![\\p{L}\\p{N}])(${SHORT})[ \\t]+(?=[\\p{L}\\p{N}«"(]|$)`, 'giu')
const UNIT = /(\d)[ \t]+(?=[\p{L}%°])/gu
const DASH = /[ \t]+([—–])(?=[ \t])/gu
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CANVAS'])

export function nbsp(text: string) {
  return text.replace(UNIT, `$1${NB}`).replace(WORD, `$1${NB}`).replace(DASH, `${NB}$1`)
}

function fix(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (!parent || SKIP.has(parent.tagName)) return
    const value = node.nodeValue ?? ''
    if (value.length < 3 || !/[ \t]/.test(value)) return
    const next = nbsp(value)
    if (next !== value) node.nodeValue = next
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has((node as Element).tagName)) return
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    fix(current)
    current = walker.nextNode()
  }
}

export function initTypo() {
  fix(document.body)
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') fix(record.target)
      else record.addedNodes.forEach(fix)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
