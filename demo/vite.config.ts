/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const MAX_BASELINE_BYTES = 5 * 1024 * 1024 // 5 MB
// Baked layouts at 1M nodes are ~32 MB raw (positions + links), gzipped
// closer to ~6–10 MB. Cap at 128 MB to leave headroom for label variants
// without letting a runaway request fill the disk.
const MAX_BAKE_BYTES = 128 * 1024 * 1024

// Captures POST /record-baseline payloads and stores them under demo/baselines.
// Mirrors the benchmark capture plugin but writes to a separate directory so
// demo recordings don't intermix with the lower-level micro-benchmarks.
function captureBaselinePlugin (): Plugin {
  return {
    name: 'kajillion-demo-capture',
    configureServer (server) {
      server.middlewares.use('/record-baseline', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        const contentType = req.headers['content-type']
        if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
          res.statusCode = 415
          res.end('Content-Type must be application/json')
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        let aborted = false
        req.on('data', chunk => {
          if (aborted) return
          total += chunk.length
          if (total > MAX_BASELINE_BYTES) {
            aborted = true
            res.statusCode = 413
            res.end(`Payload exceeds ${MAX_BASELINE_BYTES} bytes`)
            req.destroy()
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => {
          if (aborted) return
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            const payload = JSON.parse(body)
            const dir = resolve(__dirname, 'baselines')
            mkdirSync(dir, { recursive: true })
            const stamp = new Date().toISOString().replace(/[:.]/g, '-')
            const stamped = resolve(dir, `${stamp}.json`)
            const latest = resolve(dir, 'latest.json')
            const latestTmp = resolve(dir, 'latest.json.tmp')
            const out = JSON.stringify(payload, null, 2)
            writeFileSync(stamped, out)
            writeFileSync(latestTmp, out)
            renameSync(latestTmp, latest)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ savedTo: stamped }))
          } catch (e) {
            try { unlinkSync(resolve(__dirname, 'baselines', 'latest.json.tmp')) } catch { /* ignore */ }
            res.statusCode = 500
            res.end((e as Error).message)
          }
        })
      })
    },
  }
}

// Captures POST /bake/:label binary payloads (pre-baked node layouts) and
// stores them under demo/public/baked-{label}.bin so they're served as
// static assets by Vite's dev server and bundled in `demo:build`. The
// layout is meant to be the "shipping" scale-story demo: a 500k–1M node
// graph rendered with enableSimulation=false. Generated once via the
// demo's Bake button; checked in.
function captureBakePlugin (): Plugin {
  return {
    name: 'kajillion-demo-bake',
    configureServer (server) {
      server.middlewares.use('/bake', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        // Parse label from query string. Fallback to "default".
        const url = new URL(req.url ?? '/bake', 'http://localhost')
        const labelRaw = url.searchParams.get('label') ?? 'default'
        // Whitelist: prevent ../ escapes or filename oddities.
        if (!/^[\w.-]{1,64}$/.test(labelRaw)) {
          res.statusCode = 400
          res.end('label must match /^[\\w.-]{1,64}$/')
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        let aborted = false
        req.on('data', chunk => {
          if (aborted) return
          total += chunk.length
          if (total > MAX_BAKE_BYTES) {
            aborted = true
            res.statusCode = 413
            res.end(`Payload exceeds ${MAX_BAKE_BYTES} bytes`)
            req.destroy()
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => {
          if (aborted) return
          try {
            const body = Buffer.concat(chunks)
            const dir = resolve(__dirname, 'public')
            mkdirSync(dir, { recursive: true })
            const out = resolve(dir, `baked-${labelRaw}.bin`)
            const outTmp = resolve(dir, `baked-${labelRaw}.bin.tmp`)
            writeFileSync(outTmp, body)
            renameSync(outTmp, out)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ savedTo: out, bytes: body.length }))
          } catch (e) {
            try { unlinkSync(resolve(__dirname, 'public', `baked-${labelRaw}.bin.tmp`)) } catch { /* ignore */ }
            res.statusCode = 500
            res.end((e as Error).message)
          }
        })
      })
    },
  }
}

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  root: __dirname,
  server: {
    port: 4174,
    open: false,
  },
  resolve: {
    alias: {
      '@/graph': resolve(__dirname, '../src/'),
      '@kajillion/graph': resolve(__dirname, '../src/'),
    },
  },
  plugins: [captureBaselinePlugin(), captureBakePlugin()],
})
