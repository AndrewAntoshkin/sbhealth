/**
 * Рендерит героя стартового экрана и главной (public/hero-*.webp).
 * Нужен dev-сервер, playwright-core и Chrome:  node scripts/render-hero.cjs [имя]
 */
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const URL = process.env.URL || 'http://localhost:5173/#/atlas'
const OUT = path.join(__dirname, '..', 'public')

// камера: цель (x,y,z), дистанция, азимут и подъём (рад.), угол обзора, размер кадра px
const SHOTS = {
  hero: { target: [0.01, 0.3, 0], dist: 2.95, az: 0.5, el: 0.07, fov: 30, w: 900, h: 1100, quality: 0.82 },
}

;(async () => {
  const only = process.argv[2]
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const [name, shot] of Object.entries(SHOTS)) {
    if (only && only !== name) continue
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto(URL)
    await page.waitForFunction(() => window.__atlas && window.__atlas.controls && !document.querySelector('.loader'), null, { timeout: 90000 })
    await page.addStyleTag({
      content: `html,body,#root,.app,.stage,.workspace{background:transparent!important}
        .top,.panel,.reset,.hint,.poster,.phone-ui,.loader,.dock{visibility:hidden!important}
        .stage{box-shadow:none!important;border-radius:0!important;position:fixed!important;inset:0!important;width:${shot.w}px!important;height:${shot.h}px!important}`,
    })
    await page.setViewportSize({ width: shot.w, height: shot.h })
    await page.waitForTimeout(800)
    await page.evaluate(({ shot }) => {
      const a = window.__atlas
      const [tx, ty, tz] = shot.target
      const pos = [tx + shot.dist * Math.sin(shot.az) * Math.cos(shot.el), ty + shot.dist * Math.sin(shot.el), tz + shot.dist * Math.cos(shot.az) * Math.cos(shot.el)]
      const hold = () => {
        a.controls.setLookAt(...pos, tx, ty, tz, false)
        a.camera.fov = shot.fov; a.camera.updateProjectionMatrix()
        requestAnimationFrame(hold)
      }
      hold()
    }, { shot })
    await page.waitForTimeout(1500)
    const png = await page.screenshot({ omitBackground: true })
    const work = await ctx.newPage()
    await work.setContent('<canvas></canvas>')
    const webp = await work.evaluate(async ({ b64, q }) => {
      const img = new Image()
      await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + b64 })
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.toDataURL('image/webp', q).split(',')[1]
    }, { b64: png.toString('base64'), q: shot.quality })
    const file = path.join(OUT, 'hero.webp')
    fs.writeFileSync(file, Buffer.from(webp, 'base64'))
    console.log(name, fs.statSync(file).size, 'байт')
    await ctx.close()
    console.log('ok', name)
  }
  await browser.close()
})()
