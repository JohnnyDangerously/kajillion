import type { Plugin } from 'vite'

import { MAX_AGENT_COMMAND_BYTES } from './constants'
import { readJsonBody } from './json-body'

interface AgentCommandEnvelope {
  id: number;
  receivedAt: string;
  command: unknown;
}

function writeJson (res: import('http').ServerResponse, payload: unknown): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function writeError (res: import('http').ServerResponse, error: unknown): void {
  res.statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
  res.end((error as Error).message)
}

export function agentCommandPlugin (): Plugin {
  let cursor = 0
  const commands: AgentCommandEnvelope[] = []
  const acks: unknown[] = []
  return {
    name: 'kajillion-agent-command-api',
    configureServer (server) {
      server.middlewares.use('/agent/command', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const command = await readJsonBody(req, MAX_AGENT_COMMAND_BYTES)
          const envelope = { id: ++cursor, receivedAt: new Date().toISOString(), command }
          commands.push(envelope)
          if (commands.length > 250) commands.splice(0, commands.length - 250)
          writeJson(res, { ok: true, id: envelope.id, cursor })
        } catch (error) {
          writeError(res, error)
        }
      })

      server.middlewares.use('/agent/commands', (req, res, next) => {
        if (req.method !== 'GET') return next()
        const url = new URL(req.url ?? '/agent/commands', 'http://localhost')
        const after = Number.parseInt(url.searchParams.get('after') ?? '0', 10) || 0
        writeJson(res, { ok: true, cursor, commands: commands.filter(command => command.id > after) })
      })

      server.middlewares.use('/agent/ack', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const payload = await readJsonBody(req, 1024 * 1024)
          acks.push({ receivedAt: new Date().toISOString(), payload })
          if (acks.length > 250) acks.splice(0, acks.length - 250)
          writeJson(res, { ok: true })
        } catch (error) {
          writeError(res, error)
        }
      })

      server.middlewares.use('/agent/status', (req, res, next) => {
        if (req.method !== 'GET') return next()
        writeJson(res, { ok: true, cursor, queued: commands.length, acked: acks.length, latestAck: acks.at(-1) ?? null })
      })
    },
  }
}
