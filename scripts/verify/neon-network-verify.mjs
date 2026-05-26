// Headless verification harness for the neon-network rep.
//
// Drives the rep through bloom → each color mode → explode → portrait
// → personal → back-to-atlas, screenshotting each state. Uses the
// dev hooks the rep exposes on window (__neonExplode, __neonPortrait,
// __neonExitFocus, __neonPersonal) and clicks the actual <select> for
// color modes so we test the real event path.
//
// Output: PNGs in /tmp/kajillion-verify/<seq>-<state>.png
//
// Run: node scripts/verify/neon-network-verify.mjs

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:4174/?rep=neon-network'
const OUT_DIR = '/tmp/kajillion-verify'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shoot (page, name, seq) {
  const path = `${OUT_DIR}/${String(seq).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`  → ${path}`)
}

async function getConsoleMessages (page, fn) {
  const messages = []
  const handler = (msg) => {
    messages.push({ type: msg.type(), text: msg.text(), location: msg.location() })
  }
  page.on('console', handler)
  page.on('pageerror', (err) => {
    messages.push({ type: 'pageerror', text: err.message, stack: err.stack })
  })
  await fn()
  page.off('console', handler)
  return messages
}

async function main () {
  const puppeteer = await loadPuppeteer()
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false, // headed so WebGPU works reliably
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--disable-vulkan-fallback-to-gl-for-testing',
      '--no-sandbox',
      '--window-size=1600,1100',
    ],
    defaultViewport: { width: 1600, height: 1100, deviceScaleFactor: 1 },
  })

  const page = await browser.newPage()
  const allMessages = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('[neon-network]') || msg.type() === 'error' || msg.type() === 'warn') {
      allMessages.push({ type: msg.type(), text })
    }
  })
  page.on('pageerror', (err) => {
    allMessages.push({ type: 'pageerror', text: err.message })
  })

  let seq = 0

  console.log('Loading page…')
  await page.goto(URL, { waitUntil: 'domcontentloaded' })

  // Capture mid-bloom + settled to verify the bloom animation runs.
  // Bootstrap (network bin + atlas decode) takes ~1.5s; bloom is 1400ms
  // so we grab at 2.4s (mid) and 5s (settled).
  console.log('Waiting for mid-bloom (2.4s)…')
  await sleep(2400)
  await shoot(page, 'atlas-hue-mid-bloom', ++seq)
  console.log('Waiting for settled (2.6s more)…')
  await sleep(2600)
  await shoot(page, 'atlas-hue-settled', ++seq)

  // Inspect the color bar
  const colorBarState = await page.evaluate(() => {
    const sel = document.querySelector('[data-node-explorer="color-bar"] select')
    if (!sel) return { exists: false }
    return {
      exists: true,
      value: sel.value,
      options: Array.from(sel.options).map((o) => o.value),
    }
  })
  console.log('Color bar:', JSON.stringify(colorBarState))

  // Cycle through every facet mode and snapshot the result.
  const facetModes = (colorBarState.options ?? []).filter((m) => m !== 'hue')
  for (const mode of facetModes) {
    console.log(`Switching to ${mode}…`)
    await page.evaluate((m) => {
      const sel = document.querySelector('[data-node-explorer="color-bar"] select')
      sel.value = m
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }, mode)
    await sleep(1200) // tween (700ms) + settle
    await shoot(page, `mode-${mode}`, ++seq)
  }

  // Back to hue
  await page.evaluate(() => {
    const sel = document.querySelector('[data-node-explorer="color-bar"] select')
    sel.value = 'hue'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await sleep(1200)
  await shoot(page, 'mode-hue-return', ++seq)

  // Test explode → portrait → personal → back via dev hooks
  const hookCheck = await page.evaluate(() => ({
    explode: typeof window.__neonExplode,
    exit: typeof window.__neonExitFocus,
    personal: typeof window.__neonPersonal,
    portrait: typeof window.__neonPortrait,
  }))
  console.log('Dev hooks:', JSON.stringify(hookCheck))

  // Switch to markets mode before exploding — explode is gated on
  // currentClusterIndex which is null in hue mode.
  console.log('Switching to markets for explode test…')
  await page.evaluate(() => {
    const sel = document.querySelector('[data-node-explorer="color-bar"] select')
    sel.value = 'markets'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await sleep(1500)

  if (hookCheck.explode === 'function') {
    console.log('Triggering explode for node 100…')
    await page.evaluate(() => window.__neonExplode(100))
    await sleep(1500)
    await shoot(page, 'explode', ++seq)
  }

  if (hookCheck.exit === 'function') {
    console.log('Exit back to atlas…')
    await page.evaluate(() => window.__neonExitFocus())
    await sleep(1200)
    await shoot(page, 'back-to-atlas', ++seq)
  }

  if (hookCheck.personal === 'function') {
    console.log('Personal network for node 100…')
    await page.evaluate(() => window.__neonPersonal(100))
    await sleep(2500) // CSR fetch + force-relax kickoff
    await shoot(page, 'personal', ++seq)

    await page.evaluate(() => window.__neonExitFocus())
    await sleep(1200)
    await shoot(page, 'back-from-personal', ++seq)
  }

  // Dump captured messages
  console.log('\n=== Captured console messages ===')
  for (const m of allMessages) {
    console.log(`[${m.type}] ${m.text}`)
  }

  await writeFile(`${OUT_DIR}/console.json`, JSON.stringify(allMessages, null, 2))

  console.log(`\nDone. Screenshots + console.json in ${OUT_DIR}`)
  await browser.close()
}

async function loadPuppeteer () {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)')
    const mod = await dynamicImport('puppeteer-core')
    return mod.default ?? mod
  } catch {
    throw new Error('Install puppeteer-core to run neon-network visual verification.')
  }
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
