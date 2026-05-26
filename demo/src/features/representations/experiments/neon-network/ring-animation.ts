import type { Graph } from '@kajillion/graph'

// Angular velocities per ring band, radians/second. Slow + counter-
// rotating so the disc feels alive without anything visibly moving in
// a single frame. Halved from earlier ambient values — user wanted
// the rotation back but subtle.
const BAND_OMEGAS = [0.010, -0.006, 0.004, -0.0025, 0.0015]
const BAND_COUNT = BAND_OMEGAS.length

export interface RingAnimationHandle {
  /** Capture current positions as the "rest state" and begin rotating
   *  around `center`. Idempotent — calling twice does not stack RAFs.
   *  `maxIndex` (optional) — only the first N nodes participate; the
   *  rest stay anchored in place. Used to keep the starfield halo
   *  perfectly still while the disc spins underneath. */
  start: (center: { x: number; y: number }, maxIndex?: number) => void;
  /** Pause the rotation. Positions stay where they last were; callers
   *  that need a clean baseline (e.g. tween source) should read them
   *  from the graph after calling stop(). */
  stop: () => void;
  /** True if a RAF is currently running. */
  isRunning: () => boolean;
  dispose: () => void;
}

/**
 * Continuous rotation around a fixed center. Each node's distance from
 * center stays constant; only its angle changes. Nodes are grouped into
 * radial bands and each band gets its own (signed) angular velocity, so
 * the disc reads as a few counter-rotating rings rather than a uniform
 * spin.
 *
 * Per-frame work is **5 sincos calls + 4 mul + 2 add per node**, no
 * branches in the hot loop. The "per-band rotation matrix" trick: for a
 * fixed angular velocity ω over time dt, every node in that band rotates
 * by the same angle ω·dt, so we precompute (cos(ω·dt), sin(ω·dt)) once
 * per frame per band and apply the 2D rotation to each node's stored
 * offset-from-center. At 5k nodes / 120 fps this is essentially free;
 * the old per-node sincos formulation would have eaten ~10 ms/frame at
 * 50k.
 */
export function createRingAnimation (graph: Graph): RingAnimationHandle {
  // Offsets from center, stored once at capture(). dx0/dy0 are the
  // node's position relative to (centerX, centerY) in the "rest" frame.
  // Rotation of (dx0, dy0) by ω·dt produces the live offset; we add
  // (centerX, centerY) when writing to the scratch buffer.
  let dx0: Float32Array | null = null
  let dy0: Float32Array | null = null
  let bandIdx: Uint8Array | null = null
  let scratch: Float32Array | null = null
  // Per-band cos/sin of the current rotation, recomputed once per frame.
  const cosOmega = new Float32Array(BAND_COUNT)
  const sinOmega = new Float32Array(BAND_COUNT)
  let centerX = 0
  let centerY = 0
  let startTime = 0
  let rafId = 0
  let running = false
  let disposed = false
  // Last `maxIndex` passed to start(). Used in the hot loop so we only
  // touch the disc nodes — the halo + ambient field stay frozen.
  let rotatedCount = 0

  const capture = (center: { x: number; y: number }, maxIndex?: number): void => {
    centerX = center.x
    centerY = center.y
    const live = graph.getPointPositions()
    const totalN = live.length / 2
    const n = Math.min(totalN, maxIndex ?? totalN)
    rotatedCount = n
    if (!dx0 || dx0.length !== totalN) {
      dx0 = new Float32Array(totalN)
      dy0 = new Float32Array(totalN)
      bandIdx = new Uint8Array(totalN)
      scratch = new Float32Array(totalN * 2)
    }
    // Seed the FULL scratch buffer with every node's live position so
    // halo / field stars sit at their resting positions when the hot
    // loop overwrites only the first `rotatedCount` entries each frame.
    for (let i = 0; i < totalN; i += 1) {
      scratch[i * 2] = live[i * 2] as number
      scratch[(i * 2) + 1] = live[(i * 2) + 1] as number
    }
    let maxR = 0
    for (let i = 0; i < n; i += 1) {
      const x = (live[i * 2] as number) - centerX
      const y = (live[(i * 2) + 1] as number) - centerY
      dx0[i] = x
      dy0[i] = y
      const r = Math.sqrt((x * x) + (y * y))
      if (r > maxR) maxR = r
    }
    for (let i = 0; i < n; i += 1) {
      const x = dx0[i] as number
      const y = dy0[i] as number
      const r = Math.sqrt((x * x) + (y * y))
      let b = maxR > 0 ? Math.floor((r / maxR) * BAND_COUNT) : 0
      if (b >= BAND_COUNT) b = BAND_COUNT - 1
      bandIdx[i] = b
    }
    startTime = performance.now()
  }

  const step = (now: number): void => {
    if (!running) { rafId = 0; return }
    if (!dx0 || !dy0 || !bandIdx || !scratch) { rafId = 0; return }
    const dt = (now - startTime) / 1000
    // 5 sincos per frame total, regardless of N.
    for (let b = 0; b < BAND_COUNT; b += 1) {
      const theta = (BAND_OMEGAS[b] as number) * dt
      cosOmega[b] = Math.cos(theta)
      sinOmega[b] = Math.sin(theta)
    }
    // Hot loop: branchless 2D rotation + add center. Only the first
    // `rotatedCount` nodes are touched; halo / field stars retain the
    // positions seeded in capture() and never get overwritten.
    for (let i = 0; i < rotatedCount; i += 1) {
      const x = dx0[i] as number
      const y = dy0[i] as number
      const c = cosOmega[bandIdx[i] as number] as number
      const s = sinOmega[bandIdx[i] as number] as number
      scratch[i * 2] = centerX + ((x * c) - (y * s))
      scratch[(i * 2) + 1] = centerY + ((x * s) + (y * c))
    }
    graph.setPointPositions(scratch, true)
    graph.render()
    rafId = requestAnimationFrame(step)
  }

  return {
    start (center, maxIndex): void {
      if (disposed || running) return
      capture(center, maxIndex)
      running = true
      rafId = requestAnimationFrame(step)
    },
    stop (): void {
      running = false
      if (rafId !== 0) cancelAnimationFrame(rafId)
      rafId = 0
    },
    isRunning (): boolean { return running },
    dispose (): void {
      disposed = true
      running = false
      if (rafId !== 0) cancelAnimationFrame(rafId)
      rafId = 0
      dx0 = null
      dy0 = null
      bandIdx = null
      scratch = null
    },
  }
}
