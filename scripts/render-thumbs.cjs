/**
 * Рендерит миниатюры органов для карточек (public/organs/<system>.webp).
 * Нужен запущенный `npm run dev` и пакет playwright-core (npm i -D playwright-core) + установленный Chrome.
 *   node scripts/render-thumbs.cjs [http://localhost:5173/]
 * Для каждой системы выбираем орган, прячем всё остальное, делаем снимок с прозрачным фоном
 * и вырезаем квадрат вокруг видимой части.
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const URL = process.argv[2] || 'http://localhost:5173/'
const OUT = path.join(__dirname, '..', 'public', 'organs')
const SIZE = 256
// Для длинных систем кадрируем плотнее: k — доля от габарита, c — вес центра масс (1 — только центр масс), dy — сдвиг по вертикали в долях стороны
const CROP = { cardiovascular: { k: 0.56, c: 1, dy: -0.2 }, integumentary: { k: 0.8, c: 0 } }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const ROWS = {
  cardiovascular: 'Сердечно', nervous: 'Нервная', endocrine: 'Эндокринная', musculoskeletal: 'Опорно',
  digestive: 'Пищеварительная', hematopoietic: 'Кроветворная', integumentary: 'Покровная', lymphatic: 'Лимфатическая',
  immune: 'Иммунная', reproductive: 'Репродуктивная', respiratory: 'Дыхательная', sensory: 'Органы чувств', urinary: 'Мочевыделительная',
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const work = await ctx.newPage()
  await page.goto(URL)
  await page.waitForTimeout(5000)
  // широкая раскладка: камера кадрирует орган целиком, без шторки и сдвигов
  await page.addStyleTag({
    content: `html,body,#root,.app,.stage,.workspace{background:transparent!important}
      .top,.panel,.reset,.hint{visibility:hidden!important} .stage{box-shadow:none!important;border-radius:0!important}`,
  })
  const call = (sel, text) => page.evaluate(({ sel, text }) => {
    const el = [...document.querySelectorAll(sel)].find((n) => n.textContent.includes(text))
    if (!el) return false
    el[Object.keys(el).find((k) => k.startsWith('__reactProps'))].onClick()
    return true
  }, { sel, text })

  for (const [id, text] of Object.entries(ROWS)) {
    if (ONLY && !ONLY.includes(id)) continue
    await call('.overview-list button', text)
    await page.waitForTimeout(3200)
    await page.evaluate((id) => {
      window.__atlas.scene.traverse((o) => {
        if (!o.isMesh) return
        o.visible = o.userData.system === id
      })
    }, id)
    await page.waitForTimeout(600)
    const png = await page.screenshot({ omitBackground: true })
    await work.setContent('<canvas id="c"></canvas>')
    const webp = await work.evaluate(async ({ b64, size, crop }) => {
      const img = new Image()
      await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + b64 })
      const w = img.width, h = img.height
      const src = document.createElement('canvas'); src.width = w; src.height = h
      const sctx = src.getContext('2d'); sctx.drawImage(img, 0, 0)
      const data = sctx.getImageData(0, 0, w, h).data
      let minX = w, minY = h, maxX = 0, maxY = 0, sum = 0, cx = 0, cy = 0
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const a = data[(y * w + x) * 4 + 3]
        if (a > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); sum += a; cx += x * a; cy += y * a }
      }
      if (!sum) return null
      const bw = maxX - minX, bh = maxY - minY
      const centroid = [cx / sum, cy / sum], mid = [(minX + maxX) / 2, (minY + maxY) / 2]
      const cw = crop ? crop.c : 0.5
      const center = [centroid[0] * cw + mid[0] * (1 - cw), centroid[1] * cw + mid[1] * (1 - cw)]
      let side = Math.max(bw, bh) * 1.14 * (crop ? crop.k : 1)
      side = Math.min(side, w * 0.95, h * 0.95)
      center[1] += (crop && crop.dy ? crop.dy : 0) * side
      center[0] = Math.min(w - side / 2, Math.max(side / 2, center[0]))
      center[1] = Math.min(h - side / 2, Math.max(side / 2, center[1]))
      const out = document.createElement('canvas'); out.width = out.height = size
      const octx = out.getContext('2d'); octx.imageSmoothingQuality = 'high'
      octx.drawImage(src, center[0] - side / 2, center[1] - side / 2, side, side, 0, 0, size, size)
      return out.toDataURL('image/webp', 0.9).split(',')[1]
    }, { b64: png.toString('base64'), size: SIZE, crop: CROP[id] })
    if (!webp) { console.log('пусто:', id); continue }
    fs.writeFileSync(path.join(OUT, id + '.webp'), Buffer.from(webp, 'base64'))
    console.log('ok', id)
    await page.evaluate(() => window.__atlas.scene.traverse((o) => { if (o.isMesh) o.visible = true }))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)
  }
  await browser.close()
})()
