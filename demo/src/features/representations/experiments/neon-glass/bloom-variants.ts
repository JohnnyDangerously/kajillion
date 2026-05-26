export type BloomVariant = 'pop' | 'spiral' | 'inward' | 'twinkle' | 'wave' | 'burst'

export const BLOOM_VARIANT_IDS: readonly BloomVariant[] = [
  'pop', 'spiral', 'inward', 'twinkle', 'wave', 'burst',
] as const

export interface BloomState {
  n: number;
  cx: number;
  cy: number;
  innerHole: number;
  ringCount: number;
  ringStep: number;
  cosA: Float32Array;
  sinA: Float32Array;
  finalRadius: Float32Array;
  finalPositions: Float32Array;
  finalSizes: Float32Array;
  positions: Float32Array;
  sizes: Float32Array;
  /** Per-node normalised start time, computed once per run. */
  startT: Float32Array;
  /** Per-variant scratch min/max for projections etc. */
  scratch: { min: number; max: number };
}

const TAU = Math.PI * 2

export function resolveBloomVariant (value: string | null | undefined): BloomVariant {
  if (!value) return 'pop'
  return (BLOOM_VARIANT_IDS as readonly string[]).includes(value) ? value as BloomVariant : 'pop'
}

/** One-time pre-pass: fill state.startT and state.scratch for the variant. */
export function prepareVariant (s: BloomState, variant: BloomVariant): void {
  switch (variant) {
    case 'pop': return prepareRingStagger(s, false)
    case 'inward': return prepareRingStagger(s, true)
    case 'spiral': return prepareSpiral(s)
    case 'twinkle': return prepareTwinkle(s)
    case 'wave': return prepareWave(s)
    case 'burst': return prepareBurst(s)
  }
}

/** Per-frame: write positions[] and sizes[] for the variant at normalised time t. */
export function applyVariantFrame (s: BloomState, variant: BloomVariant, t: number): void {
  switch (variant) {
    case 'pop': return frameSlidePop(s, t, 0.55)
    case 'inward': return frameSlidePop(s, t, -0.55)
    case 'spiral': return frameStaticSize(s, t, 0.18, easeOutBack)
    case 'twinkle': return frameStaticSize(s, t, 0.18, easeOutCubic)
    case 'wave': return frameStaticSize(s, t, 0.22, easeOutBack)
    case 'burst': return frameBurst(s, t)
  }
}

function prepareRingStagger (s: BloomState, reverse: boolean): void {
  const spread = 0.65
  const denom = Math.max(1, s.ringCount - 1)
  for (let i = 0; i < s.n; i += 1) {
    const ring = ringIdx(s, i)
    const r = reverse ? (s.ringCount - 1 - ring) : ring
    s.startT[i] = (r / denom) * spread
  }
}

function prepareSpiral (s: BloomState): void {
  // Inner-ring-first AND clockwise-angular-sweep. Each ring's full pass takes
  // 1/ringCount of the total spread; within a ring the angle adds a fraction.
  const spread = 0.85
  for (let i = 0; i < s.n; i += 1) {
    const ang = Math.atan2(s.sinA[i], s.cosA[i])
    const aNorm = (ang + Math.PI) / TAU // 0..1
    s.startT[i] = ((ringIdx(s, i) + aNorm) / s.ringCount) * spread
  }
}

function prepareTwinkle (s: BloomState): void {
  const spread = 0.85
  for (let i = 0; i < s.n; i += 1) s.startT[i] = hash01(i) * spread
}

function prepareWave (s: BloomState): void {
  // Top-left → bottom-right diagonal sweep. Project each node's final
  // position onto the direction vector, normalise to [0..spread].
  const dx = Math.cos(-Math.PI / 4)
  const dy = Math.sin(-Math.PI / 4)
  let minP = Infinity; let maxP = -Infinity
  for (let i = 0; i < s.n; i += 1) {
    const p = s.cosA[i] * s.finalRadius[i] * dx + s.sinA[i] * s.finalRadius[i] * dy
    if (p < minP) minP = p
    if (p > maxP) maxP = p
  }
  s.scratch.min = minP
  s.scratch.max = maxP
  const range = (maxP - minP) || 1
  const spread = 0.75
  for (let i = 0; i < s.n; i += 1) {
    const p = s.cosA[i] * s.finalRadius[i] * dx + s.sinA[i] * s.finalRadius[i] * dy
    s.startT[i] = ((p - minP) / range) * spread
  }
}

function prepareBurst (s: BloomState): void {
  for (let i = 0; i < s.n; i += 1) s.startT[i] = 0
}

/**
 * Pop / inward shared frame: per-node radial slide + scale-up with
 * overshoot. `slideSign` = +1 inward-from-final (rings rise outward),
 * `-1` outward-from-final (rings fall inward).
 */
function frameSlidePop (s: BloomState, t: number, slideSign: number): void {
  const window = 0.35
  const offset = slideSign * s.ringStep
  for (let i = 0; i < s.n; i += 1) {
    const localT = clamp01((t - s.startT[i]) / window)
    const ePos = easeOutCubic(localT)
    const eSize = easeOutBack(Math.min(1, localT * 1.4))
    const startR = Math.max(s.innerHole * 0.4, s.finalRadius[i] - offset)
    const r = startR + (s.finalRadius[i] - startR) * ePos
    s.positions[i * 2] = s.cx + s.cosA[i] * r
    s.positions[i * 2 + 1] = s.cy + s.sinA[i] * r
    s.sizes[i] = s.finalSizes[i] * eSize
  }
}

/** Static positions, size ramps with the given easing over `window`. */
function frameStaticSize (
  s: BloomState,
  t: number,
  window: number,
  ease: (x: number) => number
): void {
  for (let i = 0; i < s.n; i += 1) {
    const localT = clamp01((t - s.startT[i]) / window)
    s.sizes[i] = s.finalSizes[i] * ease(localT)
    s.positions[i * 2] = s.finalPositions[i * 2]
    s.positions[i * 2 + 1] = s.finalPositions[i * 2 + 1]
  }
}

function frameBurst (s: BloomState, t: number): void {
  // All dots scale-bounce together: start at 1.3×, settle to 1×.
  const e = easeOutBack(t)
  const scale = 1.3 + (1.0 - 1.3) * e
  for (let i = 0; i < s.n; i += 1) {
    s.sizes[i] = s.finalSizes[i] * scale
    s.positions[i * 2] = s.finalPositions[i * 2]
    s.positions[i * 2 + 1] = s.finalPositions[i * 2 + 1]
  }
}

function ringIdx (s: BloomState, i: number): number {
  return Math.max(0, Math.min(s.ringCount - 1, Math.floor((s.finalRadius[i] - s.innerHole) / s.ringStep)))
}

function easeOutCubic (t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

function easeOutBack (t: number): number {
  const c1 = 1.42
  const c3 = c1 + 1
  const u = t - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

function clamp01 (x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x
}

function hash01 (i: number): number {
  return (Math.imul(i + 1, 2654435761) >>> 0) / 0x1_0000_0000
}
