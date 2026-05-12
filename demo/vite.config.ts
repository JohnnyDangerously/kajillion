/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const MAX_BASELINE_BYTES = 5 * 1024 * 1024 // 5 MB

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
  plugins: [captureBaselinePlugin()],
})
