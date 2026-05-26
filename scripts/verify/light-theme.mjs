// Probe the light-theme variant. Loads ?rep=neon-network&theme=light
// and grabs screenshots of the disc (hue + a few facet modes).

import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:4174/?rep=neon-network&theme=light'
const OUT = '/tmp/kajillion-verify-light'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(OUT)) await mkdir(OUT, { recursive: true })

async function loadPuppeteer () {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)')
    const mod = await dynamicImport('puppeteer-core')
    return mod.default ?? mod
  } catch {
    throw new Error('Install puppeteer-core to run light-theme visual verification.')
  }
}

const puppeteer = await loadPuppeteer()

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 1100 },
})
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warn') console.log(`[${m.type()}]`, m.text())
})
page.on('pageerror', (e) => console.log('ERR', e.message))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await sleep(5000)
await page.screenshot({ path: `${OUT}/01-atlas-hue-light.png` })
console.log('atlas-hue-light.png')

for (const mode of ['markets', 'industries', 'functions']) {
  await page.evaluate((m) => {
    const sel = document.querySelector('[data-node-explorer="color-bar"] select')
    sel.value = m
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, mode)
  await sleep(1300)
  await page.screenshot({ path: `${OUT}/0X-mode-${mode}-light.png`.replace('0X', String(2 + ['markets', 'industries', 'functions'].indexOf(mode))) })
  console.log(`mode-${mode}-light.png`)
}

// Personal network in light theme — verify label cap + clean view
await page.evaluate(() => window.__neonPersonal?.(100))
await sleep(3000)
await page.screenshot({ path: `${OUT}/5-personal-light.png` })
console.log('personal-light.png')

await browser.close()
console.log(`Done. Screenshots in ${OUT}`)
