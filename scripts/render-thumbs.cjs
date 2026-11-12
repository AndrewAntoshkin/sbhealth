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

const URL = process.argv[2] || 'http://localhost:5173/#/atlas'
// SIZE=640 LARGE=1 — крупные картинки для шторки (public/organs/lg) + точки интереса (src/data/hotspots.json)
const LARGE = Boolean(process.env.LARGE)
const OUT = path.join(__dirname, '..', 'public', 'organs', LARGE ? 'lg' : '')
const SIZE = Number(process.env.SIZE) || (LARGE ? 720 : 256)
const SPOTS = {}
// Для длинных систем кадрируем плотнее: k — доля от габарита, c — вес центра масс (1 — только центр масс), dy — сдвиг по вертикали в долях стороны
const CROP = { cardiovascular: { k: 0.56, c: 1, dy: -0.2 }, integumentary: { k: 0.8, c: 0 } }
const CROP_LG = { immune: { k: 0.42, c: 1 }, integumentary: CROP.integumentary, sensory: { k: 1, c: 0.5 }, urinary: { k: 0.8, c: 0.5 } }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const ROWS = {
  cardiovascular: 'Сердечно', nervous: 'Нервная', endocrine: 'Эндокринная', musculoskeletal: 'Опорно',
  digestive: 'Пищеварительная', hematopoietic: 'Кроветворная', integumentary: 'Покровная', lymphatic: 'Лимфатическая',
  immune: 'Иммунная', reproductive: 'Репродуктивная', respiratory: 'Дыхательная', sensory: 'Органы чувств', urinary: 'Мочевыделительная',
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: LARGE ? 3 : 2 })
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
    if (LARGE) {
      // крупный план обрезает длинные системы по краю кадра — отъезжаем, чтобы вошла вся система
      await page.evaluate((zoom) => { const c = window.__atlas.controls; c.dollyTo(c.distance * zoom, false) }, Number(process.env.ZOOM) || 1.9)
      await page.waitForTimeout(500)
    }
    await page.evaluate((id) => {
      window.__atlas.scene.traverse((o) => {
        if (!o.isMesh) return
        o.visible = o.userData.system === id
      })
    }, id)
    await page.waitForTimeout(600)
    const png = await page.screenshot({ omitBackground: true })
    await work.setContent('<canvas id="c"></canvas>')
    const webp = await work.evaluate(async ({ b64, size, crop, large }) => {
      const img = new Image()
      await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + b64 })
      const w = img.width, h = img.height
      const src = document.createElement('canvas'); src.width = w; src.height = h
      const sctx = src.getContext('2d'); sctx.drawImage(img, 0, 0)
      const data = sctx.getImageData(0, 0, w, h).data
      const xs = [], ys = []
      let minX = w, minY = h, maxX = 0, maxY = 0, sum = 0, cx = 0, cy = 0
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const a = data[(y * w + x) * 4 + 3]
        if (a > 24) { xs.push(x); ys.push(y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); sum += a; cx += x * a; cy += y * a }
      }
      if (!sum) return null
      if (large) { // игнорируем тонкие «хвосты» (сосуды, мелкие фрагменты) — кадрируем по основной массе
        xs.sort((a, b) => a - b); ys.sort((a, b) => a - b)
        const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]
        minX = q(xs, 0.025); maxX = q(xs, 0.975); minY = q(ys, 0.025); maxY = q(ys, 0.975)
      }
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
      // три точки интереса: центры кластеров по непрозрачным пикселям (детерминированно)
      const od = octx.getImageData(0, 0, size, size).data
      const pts = []
      for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) if (od[(y * size + x) * 4 + 3] > 150) pts.push([x / size, y / size])
      let spots = []
      if (pts.length > 12) {
        const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
        const mean = pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length], [0, 0])
        const far = (from) => pts.reduce((best, p) => (Math.min(...from.map((f) => d2(p, f))) > Math.min(...from.map((f) => d2(best, f))) ? p : best), pts[0])
        let cs = [far([mean])]
        cs.push(far(cs)); cs.push(far(cs))
        for (let it = 0; it < 10; it++) {
          const sums = cs.map(() => [0, 0, 0])
          for (const p of pts) { let bi = 0; cs.forEach((c, i) => { if (d2(p, c) < d2(p, cs[bi])) bi = i }); sums[bi][0] += p[0]; sums[bi][1] += p[1]; sums[bi][2]++ }
          cs = cs.map((c, i) => (sums[i][2] ? [sums[i][0] / sums[i][2], sums[i][1] / sums[i][2]] : c))
        }
        spots = cs.map((c) => pts.reduce((best, p) => (d2(p, c) < d2(best, c) ? p : best), pts[0])).map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000])
        spots.sort((a, b) => a[1] - b[1] || a[0] - b[0])
      }
      return { webp: out.toDataURL('image/webp', 0.9).split(',')[1], spots }
    }, { b64: png.toString('base64'), size: SIZE, crop: LARGE ? CROP_LG[id] : CROP[id], large: LARGE && !CROP_LG[id] })
    if (!webp) { console.log('пусто:', id); continue }
    fs.writeFileSync(path.join(OUT, id + '.webp'), Buffer.from(webp.webp, 'base64'))
    SPOTS[id] = webp.spots
    console.log('ok', id)
    await page.evaluate(() => window.__atlas.scene.traverse((o) => { if (o.isMesh) o.visible = true }))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)
  }
  await browser.close()
  if (LARGE) {
    const file = path.join(__dirname, '..', 'src', 'data', 'hotspots.json')
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
    fs.writeFileSync(file, JSON.stringify({ ...prev, ...SPOTS }, null, 1) + '\n')
  }
})()
