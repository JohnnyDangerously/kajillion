import type { DebugFrameTraceEvent } from './runtime-contracts'

export interface DebugFrameTraceSourceEvent {
  type: string;
  sourceEvent?: { type?: string } | null;
}

export interface DebugFrameTraceInput {
  name: string;
  raf: number;
  rendered: number;
  skipped: number;
  alpha: number;
  sim: boolean;
  zoom: boolean;
  drag: boolean;
  dirty: boolean;
  dirtyFrames: number;
  event?: DebugFrameTraceSourceEvent;
  camera: { x: number; y: number; k: number };
  screen: [number, number];
  canvas?: HTMLCanvasElement;
  data?: Record<string, unknown>;
}

export function formatDebugFrameEventType (event: DebugFrameTraceSourceEvent | undefined): string | undefined {
  if (!event) return undefined
  const maybeSource = event.sourceEvent
  if (maybeSource?.type) return `${event.type}:${maybeSource.type}`
  return event.type
}

export function createDebugFrameTraceEvent (input: DebugFrameTraceInput): DebugFrameTraceEvent {
  const canvas = input.canvas
    ? {
      clientWidth: input.canvas.clientWidth,
      clientHeight: input.canvas.clientHeight,
      width: input.canvas.width,
      height: input.canvas.height,
    }
    : undefined

  return {
    t: performance.now(),
    name: input.name,
    raf: input.raf,
    rendered: input.rendered,
    skipped: input.skipped,
    alpha: input.alpha,
    sim: input.sim,
    zoom: input.zoom,
    drag: input.drag,
    dirty: input.dirty,
    dirtyFrames: input.dirtyFrames,
    eventType: formatDebugFrameEventType(input.event),
    camera: { ...input.camera },
    screen: [...input.screen] as [number, number],
    canvas,
    data: input.data,
  }
}

export function appendBoundedDebugFrameTraceEvent (
  trace: DebugFrameTraceEvent[],
  event: DebugFrameTraceEvent,
  limit: number
): void {
  trace.push(event)
  if (trace.length > limit) {
    trace.splice(0, trace.length - limit)
  }
}

export function cloneDebugFrameTrace (trace: readonly DebugFrameTraceEvent[]): DebugFrameTraceEvent[] {
  return trace.map(event => ({
    ...event,
    camera: { ...event.camera },
    screen: [...event.screen] as [number, number],
    canvas: event.canvas ? { ...event.canvas } : undefined,
    data: event.data ? { ...event.data } : undefined,
  }))
}
