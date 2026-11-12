/**
 * Рендерит постер главного экрана (public/poster.webp): кадр тела на телефоне 390×844.
 * Показывается мгновенно, пока грузится настоящая 3D-модель. Нужен dev-сервер (npm run dev),
 * playwright-core и установленный Chrome:  node scripts/render-poster.cjs
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const URL = process.env.URL || 'http://localhost:5173/'
const OUT = path.join(__dirname, '..', 'public', 'poster.webp')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, hasTouch: true })
  const page = await ctx.newPage()
  const work = await ctx.newPage()
  await page.goto(URL)
  await page.waitForFunction(() => document.querySelector('.stage canvas') && !document.querySelector('.loader'), null, { timeout: 60000 })
  await page.addStyleTag({
    content: `html,body,#root,.app,.stage,.workspace{background:transparent!important}
      .top,.phone-ui,.sheet,.loader,.poster{visibility:hidden!important}
      .stage canvas{-webkit-mask-image:none!important;mask-image:none!important}`,
  })
  await page.waitForTimeout(1500)
  const png = await page.screenshot({ omitBackground: true })
  await work.setContent('<canvas id="c"></canvas>')
  const webp = await work.evaluate(async (b64) => {
    const img = new Image()
    await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + b64 })
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', 0.8).split(',')[1]
  }, png.toString('base64'))
  fs.writeFileSync(OUT, Buffer.from(webp, 'base64'))
  console.log('poster.webp', fs.statSync(OUT).size, 'байт')
  await browser.close()
})()
