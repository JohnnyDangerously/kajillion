import type { AgentCommand, AgentCommandEnvelope } from './types'

export type AgentCommandApplier = (command: AgentCommand) => Promise<unknown>

export interface AgentCommandLoop {
  stop: () => void;
  apply: AgentCommandApplier;
}

export interface AgentCommandLoopOptions {
  commandPath?: string;
  ackPath?: string;
  pollDelayMs?: number;
  retryDelayMs?: number;
  fetchFn?: typeof fetch;
  setTimeoutFn?: typeof window.setTimeout;
  exposeGlobal?: boolean;
  globalTarget?: Window & typeof globalThis;
}

interface AgentCommandResponse {
  cursor?: number;
  commands?: AgentCommandEnvelope[];
}

export async function ackAgentCommand (
  id: number,
  ok: boolean,
  result: unknown,
  options: Pick<AgentCommandLoopOptions, 'ackPath' | 'fetchFn'> = {}
): Promise<void> {
  const fetchImpl = options.fetchFn ?? fetch
  try {
    await fetchImpl(options.ackPath ?? '/agent/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ok, result }),
    })
  } catch {
    // The agent API exists only on the Vite dev server.
  }
}

export function startAgentCommandLoop (
  applyAgentCommand: AgentCommandApplier,
  options: AgentCommandLoopOptions = {}
): AgentCommandLoop {
  const commandPath = options.commandPath ?? '/agent/commands'
  const pollDelayMs = options.pollDelayMs ?? 250
  const retryDelayMs = options.retryDelayMs ?? 2000
  const fetchImpl = options.fetchFn ?? fetch
  const setTimeoutImpl = options.setTimeoutFn ?? window.setTimeout.bind(window)
  let cursor = 0
  let stopped = false

  const poll = async (): Promise<void> => {
    if (stopped) return
    try {
      const response = await fetchImpl(`${commandPath}?after=${cursor}`, { cache: 'no-store' })
      if (!response.ok) {
        setTimeoutImpl(() => { void poll() }, retryDelayMs)
        return
      }
      const payload = await response.json() as AgentCommandResponse
      for (const envelope of payload.commands ?? []) {
        cursor = Math.max(cursor, envelope.id)
        try {
          const result = await applyAgentCommand(envelope.command)
          await ackAgentCommand(envelope.id, true, result, options)
        } catch (error) {
          await ackAgentCommand(envelope.id, false, error instanceof Error ? error.message : String(error), options)
        }
      }
      cursor = Math.max(cursor, payload.cursor ?? cursor)
      setTimeoutImpl(() => { void poll() }, pollDelayMs)
    } catch {
      setTimeoutImpl(() => { void poll() }, retryDelayMs)
    }
  }

  const loop: AgentCommandLoop = {
    stop: () => { stopped = true },
    apply: applyAgentCommand,
  }
  if (options.exposeGlobal !== false) {
    ((options.globalTarget ?? window) as unknown as {
      __kajillionAgent?: AgentCommandLoop;
    }).__kajillionAgent = loop
  }
  void poll()
  return loop
}
