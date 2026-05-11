/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

function captureResultsPlugin (): Plugin {
  return {
    name: 'kajillion-bench-capture',
    configureServer (server) {
      server.middlewares.use('/record-result', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            const payload = JSON.parse(body)
            const dir = resolve(__dirname, 'results')
            mkdirSync(dir, { recursive: true })
            const stamp = new Date().toISOString().replace(/[:.]/g, '-')
            const stamped = resolve(dir, `${stamp}.json`)
            const latest = resolve(dir, 'latest.json')
            const out = JSON.stringify(payload, null, 2)
            writeFileSync(stamped, out)
            writeFileSync(latest, out)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ savedTo: stamped }))
          } catch (e) {
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
})
