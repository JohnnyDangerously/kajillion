import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

import { MAX_BAKE_BYTES } from './constants'

export function captureBakePlugin (): Plugin {
  return {
    name: 'kajillion-demo-bake',
    configureServer (server) {
      server.middlewares.use('/bake', (req, res, next) => {
        if (req.method !== 'POST') return next()
        const labelRaw = readBakeLabel(req.url)
        if (!labelRaw) {
          res.statusCode = 400
          res.end('label must match /^[\\w.-]{1,64}$/')
          return
        }
        captureBakeBody(req, res, labelRaw)
      })
    },
  }
}

function readBakeLabel (urlRaw: string | undefined): string | null {
  const url = new URL(urlRaw ?? '/bake', 'http://localhost')
  const labelRaw = url.searchParams.get('label') ?? 'default'
  return /^[\w.-]{1,64}$/.test(labelRaw) ? labelRaw : null
}

function captureBakeBody (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  labelRaw: string,
): void {
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
    writeBakeResponse(Buffer.concat(chunks), res, labelRaw)
  })
}

function writeBakeResponse (body: Buffer, res: import('http').ServerResponse, labelRaw: string): void {
  try {
    const dir = resolve(__dirname, 'public')
    mkdirSync(dir, { recursive: true })
    const out = resolve(dir, `baked-${labelRaw}.bin`)
    const outTmp = resolve(dir, `baked-${labelRaw}.bin.tmp`)
    writeFileSync(outTmp, body)
    renameSync(outTmp, out)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ savedTo: out, bytes: body.length }))
  } catch (error) {
    cleanupBakeTemp(labelRaw)
    res.statusCode = 500
    res.end((error as Error).message)
  }
}

function cleanupBakeTemp (labelRaw: string): void {
  try {
    unlinkSync(resolve(__dirname, 'public', `baked-${labelRaw}.bin.tmp`))
  } catch {
    // Ignore partial-capture cleanup failures.
  }
}
