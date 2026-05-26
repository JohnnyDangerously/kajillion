import { DEMO_SPACE_SIZE } from '../../../demo-lifecycle/demo-space'
import type { DemoConfig } from '../../../control-plane/types'
import type { RepresentationVisualData } from '../../types'
import type { VisualAttributes } from '../../../ui-state/visual-attributes'

const CX = DEMO_SPACE_SIZE / 2
const CY = DEMO_SPACE_SIZE / 2
const OUTER = DEMO_SPACE_SIZE * 0.49
const INNER_HOLE = DEMO_SPACE_SIZE * 0.016

const ACCENTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 0.34, 0.66], // pink
  [0.36, 0.94, 1.00], // cyan
  [1.00, 0.48, 0.10], // orange
  [0.70, 0.94, 0.32], // lime
  [0.92, 0.30, 0.92], // magenta
  [1.00, 0.84, 0.30], // gold
  [0.86, 0.34, 0.96], // violet
]

export function applyNeonGlassAttributes (
  data: RepresentationVisualData,
  attributes: VisualAttributes,
  cfg?: DemoConfig
): void {
  const { pointColors, pointSizes } = attributes
  const n = data.nodeCount
  const isLight = cfg?.theme === 'light'
  // Same ring count formula as layout.ts so we can derive ring index.
  const ringCount = Math.max(6, Math.min(80, Math.round(Math.sqrt(n / Math.PI))))
  const ringStep = (OUTER - INNER_HOLE) / ringCount

  for (let i = 0; i < n; i += 1) {
    const x = data.positions[i * 2] ?? CX
    const y = data.positions[i * 2 + 1] ?? CY
    const dx = x - CX
    const dy = y - CY
    const r = Math.sqrt(dx * dx + dy * dy)
    const norm = Math.min(1, r / OUTER)
    const hash = (Math.imul(i + 1, 2654435761) >>> 0) / 0x1_0000_0000
    const ringIdx = Math.max(0, Math.min(ringCount - 1, Math.floor((r - INNER_HOLE) / ringStep)))
    const ringHash = (Math.imul(ringIdx + 17, 374761393) >>> 0) / 0x1_0000_0000
    const ringTone = ringHash * 2 - 1 // -1..1 per-ring tonal offset

    // Highlight crescent centered on the LEFT (angle = π). Sharper angular
    // falloff so the band reads as a defined crescent, not a soft blob.
    const angle = Math.atan2(dy, dx)
    const angleDelta = Math.abs(((angle - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
    const angularHighlight = Math.pow(Math.max(0, 1 - angleDelta / 1.55), 2.2)
    const radialHighlight = Math.max(0, 1 - Math.pow(Math.abs(norm - 0.48) / 0.52, 1.8))
    const highlight = angularHighlight * radialHighlight

    // Base ramp. In dark mode: luminous periwinkle → near-white core.
    // In light mode: navy → mid-blue (so missing-photo slots read against
    // the off-white background).
    const t = 1 - norm
    let baseR = isLight ? lerp(0.10, 0.30, t) : lerp(0.26, 0.66, t)
    let baseG = isLight ? lerp(0.14, 0.40, t) : lerp(0.36, 0.76, t)
    let baseB = isLight ? lerp(0.32, 0.70, t) : lerp(0.74, 0.98, t)

    // Moderate per-ring shimmer (±22%) — readable banding without overpowering.
    const ringBrightness = 1 + ringTone * 0.22
    baseR *= ringBrightness
    baseG *= ringBrightness
    baseB *= ringBrightness

    // Lavender bias on a subset of rings.
    const violetMix = Math.max(0, 1 - Math.abs(norm - 0.62) / 0.30) * 0.28 * (ringHash > 0.55 ? 1 : 0.1)
    baseR += violetMix * 0.22
    baseB += violetMix * 0.06
    baseG -= violetMix * 0.10

    // Highlight pushes toward a cool white — keep green slightly behind R/B so
    // the bright band stays in the blue/white family, not yellow-white.
    let cr = clamp01(baseR + highlight * 1.55)
    let cg = clamp01(baseG + highlight * 1.30)
    let cb = clamp01(baseB + highlight * 1.40)

    if (hash < 0.018) {
      const accent = ACCENTS[Math.floor(hash * 10000) % ACCENTS.length] as readonly [number, number, number]
      cr = accent[0]
      cg = accent[1]
      cb = accent[2]
    }

    pointColors[i * 4] = cr
    pointColors[i * 4 + 1] = cg
    pointColors[i * 4 + 2] = cb
    pointColors[i * 4 + 3] = 1

    // World-unit per-node size. Slightly above the layout's polar lattice
    // cell width (ringStep ≈ 65 world units) so faces read as nodes from
    // a comfortable zoom-out, accepting a sliver of overlap at fit-view
    // density. With scalePointsOnZoom + maxPointSizeOverride, rendered
    // size scales linearly until the 160 css-px cap engages around
    // zoom ≈ 2.3×; past that, cells keep growing while dots stay capped
    // so visible gaps form for comfortable browsing.
    pointSizes[i] = 70 + hash * 6
  }
}

function lerp (a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01 (v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
