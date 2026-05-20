import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

import { readJsonBody } from './json-body'

export function captureJsonPlugin (
  path: string,
  dirName: string,
  maxBytes: number,
  pluginName: string,
): Plugin {
  return {
    name: pluginName,
    configureServer (server) {
      server.middlewares.use(path, async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const payload = await readJsonBody(req, maxBytes)
          const savedTo = writeCapturedJson(dirName, payload)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ savedTo }))
        } catch (error) {
          cleanupTemp(dirName)
          res.statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
          res.end((error as Error).message)
        }
      })
    },
  }
}

function writeCapturedJson (dirName: string, payload: unknown): string {
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
  return stamped
}

function cleanupTemp (dirName: string): void {
  try {
    unlinkSync(resolve(__dirname, dirName, 'latest.json.tmp'))
  } catch {
    // Ignore partial-capture cleanup failures.
  }
}
