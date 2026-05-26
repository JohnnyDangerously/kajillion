export interface HeadshotManifest {
  count: number;
  grid: number;
  cellSizes: number[];
  missing: number[];
  entries: Array<{ id: number; name: string }>;
}

export interface SlicedAtlas {
  manifest: HeadshotManifest;
  images: ImageData[];
  /** Per-node index into `images`, or NaN when no headshot exists for that node. */
  imageIndices: Float32Array;
}

const BASE = '/headshots'
const CELL_PX = 128
const ATLAS_FILE = 'atlas-128.webp'

/**
 * Fetch atlas-64.webp + manifest and slice the atlas into one `ImageData`
 * per node so Cosmos's native point-image pipeline can render headshots
 * directly on the GPU (single draw call, no overlay).
 */
export async function loadAndSliceHeadshotAtlas (nodeCount: number): Promise<SlicedAtlas | null> {
  try {
    const [manifestRes, atlasRes] = await Promise.all([
      fetch(`${BASE}/manifest.json`),
      fetch(`${BASE}/${ATLAS_FILE}`),
    ])
    if (!manifestRes.ok || !atlasRes.ok) return null
    const manifest = (await manifestRes.json()) as HeadshotManifest
    const bitmap = await createImageBitmap(await atlasRes.blob())

    // Decode the entire atlas into a single ImageData once, then slice it
    // into per-cell ImageData on the CPU. This avoids 4000 separate
    // createImageBitmap calls (each ~1 ms = 4 s of blocking).
    const decode = new OffscreenCanvas(bitmap.width, bitmap.height)
    const decodeCtx = decode.getContext('2d', { willReadFrequently: true })
    if (!decodeCtx) return null
    decodeCtx.drawImage(bitmap, 0, 0)
    const full = decodeCtx.getImageData(0, 0, bitmap.width, bitmap.height)

    const limit = Math.min(nodeCount, manifest.count)
    const missing = new Set(manifest.missing)
    const images: ImageData[] = []
    const imageIndices = new Float32Array(nodeCount)
    for (let i = 0; i < nodeCount; i += 1) imageIndices[i] = Number.NaN

    for (let i = 0; i < limit; i += 1) {
      if (missing.has(i)) continue
      const col = i % manifest.grid
      const row = Math.floor(i / manifest.grid)
      const ring = ringColorForNode(i)
      const slice = sliceCell(full, col * CELL_PX, row * CELL_PX, CELL_PX, ring)
      imageIndices[i] = images.length
      images.push(slice)
    }
    return { manifest, images, imageIndices }
  } catch (err) {
    console.warn('[neon-glass] failed to load headshot atlas:', err)
    return null
  }
}

// Three transforms baked in during slicing:
//   1. Circular alpha mask — Cosmos's image fragment uses max(shapeOpacity,
//      imageAlpha); an opaque image would fill the whole quad.
//   2. Vertical mirror — Cosmos's UV mapping inverts Y between ImageData
//      (Y-down) and the rendered quad.
//   3. Colored ring — Cosmos only supports a single global outline colour,
//      so we paint each node's "graph edge" ring directly into its slice.
//      Per-node hue gives a cohort/category feel without engine changes.
function sliceCell (
  full: ImageData,
  sx: number,
  sy: number,
  size: number,
  ring: { r: number; g: number; b: number }
): ImageData {
  const out = new ImageData(size, size)
  const src = full.data
  const dst = out.data
  const srcStride = full.width * 4
  const r = size * 0.5
  const ringOuter = r                    // outer rim sits at the alpha edge
  const ringInner = r - size * 0.07      // 7% of cell thickness — visible but not gaudy
  const photoOuter = ringInner - 1.5     // small soft buffer between photo and ring
  const edgeSoft = 1.6
  for (let y = 0; y < size; y += 1) {
    const dy = y + 0.5 - r
    const dy2 = dy * dy
    const srcRow = (sy + (size - 1 - y)) * srcStride + sx * 4
    const dstRow = y * size * 4
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - r
      const dist = Math.sqrt(dx * dx + dy2)
      const si = srcRow + x * 4
      const di = dstRow + x * 4
      if (dist >= ringOuter) {
        dst[di + 3] = 0
        continue
      }
      if (dist >= ringInner) {
        // Anti-aliased outer rim.
        const a = dist <= ringOuter - edgeSoft ? 1 : (ringOuter - dist) / edgeSoft
        dst[di] = ring.r
        dst[di + 1] = ring.g
        dst[di + 2] = ring.b
        dst[di + 3] = (a * 255) | 0
        continue
      }
      if (dist >= photoOuter) {
        // Soft blend from ring colour into photo.
        const t = (dist - photoOuter) / (ringInner - photoOuter)
        dst[di] = (src[si] * (1 - t) + ring.r * t) | 0
        dst[di + 1] = (src[si + 1] * (1 - t) + ring.g * t) | 0
        dst[di + 2] = (src[si + 2] * (1 - t) + ring.b * t) | 0
        dst[di + 3] = 255
        continue
      }
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = 255
    }
  }
  return out
}

/**
 * Deterministic high-saturation hue per node index. Uses the same hash
 * function as elsewhere in the preset for visual consistency.
 */
function ringColorForNode (idx: number): { r: number; g: number; b: number } {
  const h = ((Math.imul(idx + 1, 2654435761) >>> 0) / 0x1_0000_0000) * 360
  return hslToRgb(h, 0.72, 0.56)
}

function hslToRgb (h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0; let g1 = 0; let b1 = 0
  if (hp < 1) { r1 = c; g1 = x }
  else if (hp < 2) { r1 = x; g1 = c }
  else if (hp < 3) { g1 = c; b1 = x }
  else if (hp < 4) { g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const m = l - c / 2
  return { r: ((r1 + m) * 255) | 0, g: ((g1 + m) * 255) | 0, b: ((b1 + m) * 255) | 0 }
}
