/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync, renameSync, mkdirSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

const MAX_BASELINE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_REPLAY_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_AGENT_COMMAND_BYTES = 64 * 1024 * 1024 // 64 MB
// Baked layouts at 1M nodes are ~32 MB raw (positions + links), gzipped
// closer to ~6–10 MB. Cap at 128 MB to leave headroom for label variants
// without letting a runaway request fill the disk.
const MAX_BAKE_BYTES = 128 * 1024 * 1024

interface AgentCommandEnvelope {
  id: number;
  receivedAt: string;
  command: unknown;
}

function readJsonBody (req: import('http').IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolveJson, reject) => {
    const contentType = req.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
      reject(Object.assign(new Error('Content-Type must be application/json'), { statusCode: 415 }))
      return
    }
    const chunks: Buffer[] = []
    let total = 0
    let aborted = false
    req.on('data', chunk => {
      if (aborted) return
      total += chunk.length
      if (total > maxBytes) {
        aborted = true
        reject(Object.assign(new Error(`Payload exceeds ${maxBytes} bytes`), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      try {
        resolveJson(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function agentCommandPlugin (): Plugin {
  let cursor = 0
  const commands: AgentCommandEnvelope[] = []
  const acks: unknown[] = []
  return {
    name: 'kajillion-agent-command-api',
    configureServer (server) {
      server.middlewares.use('/agent/command', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        try {
          const command = await readJsonBody(req, MAX_AGENT_COMMAND_BYTES)
          const envelope: AgentCommandEnvelope = {
            id: ++cursor,
            receivedAt: new Date().toISOString(),
            command,
          }
          commands.push(envelope)
          if (commands.length > 250) commands.splice(0, commands.length - 250)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, id: envelope.id, cursor }))
        } catch (error) {
          res.statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
          res.end((error as Error).message)
        }
      })

      server.middlewares.use('/agent/commands', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }
        const url = new URL(req.url ?? '/agent/commands', 'http://localhost')
        const after = Number.parseInt(url.searchParams.get('after') ?? '0', 10) || 0
        const pending = commands.filter(command => command.id > after)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, cursor, commands: pending }))
      })

      server.middlewares.use('/agent/ack', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        try {
          const payload = await readJsonBody(req, 1024 * 1024)
          acks.push({ receivedAt: new Date().toISOString(), payload })
          if (acks.length > 250) acks.splice(0, acks.length - 250)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
          res.end((error as Error).message)
        }
      })

      server.middlewares.use('/agent/status', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          ok: true,
          cursor,
          queued: commands.length,
          acked: acks.length,
          latestAck: acks.at(-1) ?? null,
        }))
      })
    },
  }
}

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

function captureJsonPlugin (path: string, dirName: string, maxBytes: number, pluginName: string): Plugin {
  return {
    name: pluginName,
    configureServer (server) {
      server.middlewares.use(path, (req, res, next) => {
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
          if (total > maxBytes) {
            aborted = true
            res.statusCode = 413
            res.end(`Payload exceeds ${maxBytes} bytes`)
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
            const dir = resolve(__dirname, dirName)
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
            try { unlinkSync(resolve(__dirname, dirName, 'latest.json.tmp')) } catch { /* ignore */ }
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
  plugins: [
    agentCommandPlugin(),
    captureBaselinePlugin(),
    captureJsonPlugin('/record-replay', 'replays', MAX_REPLAY_BYTES, 'kajillion-demo-replay-capture'),
    captureBakePlugin(),
  ],
})
