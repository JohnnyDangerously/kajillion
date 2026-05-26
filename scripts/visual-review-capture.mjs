import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ZOOM_SHOTS = [
  { id: 'macro', label: 'Macro / Galaxy', distance: 92 },
  { id: 'cluster', label: 'Cluster / Discovery', distance: 75 },
  { id: 'work', label: 'Close / Work', distance: 24 },
]

function argValue (name, fallback) {
  const prefix = `${name}=`
  const value = process.argv.find(arg => arg.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

function stamp () {
  return new Date().toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z')
}

function runBrowser (args, options = {}) {
  return execFileSync('agent-browser', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
}

function evalBrowser (session, source) {
  return execFileSync('agent-browser', ['--session', session, 'eval', '--stdin'], {
    encoding: 'utf8',
    input: source,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function setZoomSource (distance) {
  return `(() => {
    const graph = window.__demoGraph;
    if (!graph) return { ok: false, reason: 'missing __demoGraph' };
    graph.setZoomLevel(graph.zoomDistanceToLevel(${distance}), 0, false);
    return {
      ok: true,
      requestedDistance: ${distance},
      zoomDistance: graph.getZoomDistance(),
      nodes: graph.config?.pointsNumber
    };
  })()`
}

function captureShot (session, shot, imagesDir) {
  const imagePath = join(imagesDir, `${shot.id}.png`)
  const state = evalBrowser(session, setZoomSource(shot.distance))
  runBrowser(['--session', session, 'wait', '900'])
  runBrowser(['--session', session, 'screenshot', imagePath])
  return { ...shot, imagePath, state: state.trim() }
}

function contactHtml (captures, url) {
  const cards = captures.map(capture => {
    const file = `images/${capture.id}.png`
    return `<section class="card">
      <h2>${capture.label}</h2>
      <p>zoom distance ${capture.distance}</p>
      <img src="${file}" alt="${capture.label}">
      <pre>${escapeHtml(capture.state)}</pre>
    </section>`
  }).join('\n')
  return `<!doctype html>
<meta charset="utf-8">
<title>Kajillion Visual Review</title>
<style>
  body { margin: 0; background: #080b10; color: #e7edf7; font: 14px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; }
  header { padding: 18px 22px 8px; border-bottom: 1px solid #1d2633; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  h2 { margin: 0; font-size: 15px; }
  p { margin: 4px 0 10px; color: #a7b3c5; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 12px; }
  .card { background: #0d121a; border: 1px solid #1d2633; border-radius: 8px; padding: 10px; }
  img { width: 100%; display: block; border-radius: 4px; background: #05070b; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #90a0b8; font-size: 11px; margin: 8px 0 0; }
</style>
<header>
  <h1>Kajillion Visual Review</h1>
  <p>${escapeHtml(url)}</p>
</header>
<main class="grid">${cards}</main>`
}

function escapeHtml (value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function main () {
  const baseUrl = argValue('--url', 'http://127.0.0.1:4183/')
  const session = argValue('--session', `kajillion-visual-${Date.now()}`)
  const outDir = resolve(argValue('--out', `.visual-reviews/${stamp()}`))
  const imagesDir = join(outDir, 'images')
  const params = new URLSearchParams({
    n: argValue('--n', '100000'),
    data: argValue('--data', 'work'),
    theme: argValue('--theme', 'dark'),
    palette: argValue('--palette', 'category'),
    useWebGPU: '1',
    msaa: '4',
    sim: '0',
    density: '1',
    lod: '1',
    lanes: '1',
    renderLinks: '1',
    depth: 'standard',
    visualCapture: stamp(),
  })
  const url = `${baseUrl.replace(/\/?$/, '/')}?${params.toString()}`

  mkdirSync(imagesDir, { recursive: true })
  runBrowser(['--session', session, 'open', url])
  runBrowser(['--session', session, 'wait', '--load', 'networkidle'])
  runBrowser(['--session', session, 'wait', '1500'])

  const captures = ZOOM_SHOTS.map(shot => captureShot(session, shot, imagesDir))
  const htmlPath = join(outDir, 'contact.html')
  writeFileSync(htmlPath, contactHtml(captures, url))
  runBrowser(['--session', session, 'open', pathToFileURL(htmlPath).href])
  runBrowser(['--session', session, 'wait', '500'])
  runBrowser(['--session', session, 'screenshot', '--full', join(outDir, 'contact.png')])

  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ url, captures }, null, 2))
  console.log(outDir)
}

main()
