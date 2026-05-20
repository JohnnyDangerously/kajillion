/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

import { kajillionManualChunks } from '../build/vite-manual-chunks'

const MAX_RESULT_BYTES = 5 * 1024 * 1024 // 5 MB

function captureResultsPlugin (): Plugin {
  return {
    name: 'kajillion-bench-capture',
    configureServer (server) {
      server.middlewares.use('/record-result', (req, res, next) => {
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
          if (total > MAX_RESULT_BYTES) {
            aborted = true
            res.statusCode = 413
            res.end(`Payload exceeds ${MAX_RESULT_BYTES} bytes`)
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
            const dir = resolve(__dirname, 'results')
            mkdirSync(dir, { recursive: true })
            const stamp = new Date().toISOString().replace(/[:.]/g, '-')
            const stamped = resolve(dir, `${stamp}.json`)
            const latest = resolve(dir, 'latest.json')
            const latestTmp = resolve(dir, 'latest.json.tmp')
            const out = JSON.stringify(payload, null, 2)
            writeFileSync(stamped, out)
            // Atomic latest update: write to .tmp then rename — survives crash
            // between writes without leaving latest pointing at the previous run.
            writeFileSync(latestTmp, out)
            renameSync(latestTmp, latest)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ savedTo: stamped }))
          } catch (e) {
            // Clean up tmp on failure
            try {
              unlinkSync(resolve(__dirname, 'results', 'latest.json.tmp'))
            } catch {
              // ignore — file may not exist
            }
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
    port: 4173,
    open: false,
  },
  resolve: {
    alias: {
      '@/graph': resolve(__dirname, '../src/'),
      '@kajillion/graph': resolve(__dirname, '../src/'),
    },
  },
  plugins: [captureResultsPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: kajillionManualChunks,
      },
    },
  },
})
