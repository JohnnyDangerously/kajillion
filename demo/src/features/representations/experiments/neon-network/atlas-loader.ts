import { hashHue } from './color-modes'
import { hslToRgb255, variantBase } from './shared'
import { bakeBase, buildCellShape, captureEdgeSourceColors } from './atlas-cell'

export interface PhotoManifest {
  render_count: number;
  photo_count: number;
  photoed_render_indices: number[];
  eids: number[];
  names: string[];
}

export interface LoadedNetworkAtlas {
  manifest: PhotoManifest;
  /** ImageData per atlas slot. Cosmos hands these to setImageData. The
   *  arrays are MUTATED IN PLACE by recolor() so callers should treat
   *  the slice as live (don't archive a reference). */
  images: ImageData[];
  /**
   * Per-render-index atlas slot, or NaN. Pass to Cosmos.setPointImageIndices.
   * Length = network nodeCount; only `photo_count` entries are non-NaN.
   */
  imageIndices: Float32Array;
  /** Bitmask of render indices that received a photo. */
  photoMask: Uint8Array;
  /** Re-color the rings + photo-edge band in place and return the
   *  mutated images array (same identity, new content). Photo cores
   *  aren't touched — they were baked once at load time. */
  recolor: (hueLookup: (renderIdx: number) => number) => ImageData[];
}

const CELL_PX = 128
const RING_SAT = 0.72
const RING_LIGHT = 0.56

export async function loadNetworkAtlas (networkNodeCount: number): Promise<LoadedNetworkAtlas | null> {
  try {
    const [manRes, atlasRes] = await Promise.all([
      fetch(`${variantBase()}/photo-manifest.json`),
      fetch(`${variantBase()}/atlas-128.webp`),
    ])
    if (!manRes.ok || !atlasRes.ok) {
      console.warn('[neon-network] atlas fetch returned', manRes.status, '/', atlasRes.status)
      return null
    }
    // Bail before JSON.parse if the dev server served HTML for a bad path.
    const manCt = manRes.headers.get('content-type') ?? ''
    if (!manCt.includes('json')) {
      console.warn('[neon-network] photo-manifest returned non-json content-type:', manCt, '— bad ?net= param?')
      return null
    }
    const manifest = (await manRes.json()) as PhotoManifest
    const bitmap = await createImageBitmap(await atlasRes.blob())

    // Decode full atlas once. Kept in memory only long enough to bake the
    // per-cell bases + capture edge-band source colors; not retained after.
    const decode = new OffscreenCanvas(bitmap.width, bitmap.height)
    const decodeCtx = decode.getContext('2d', { willReadFrequently: true })
    if (!decodeCtx) return null
    decodeCtx.drawImage(bitmap, 0, 0)
    const full = decodeCtx.getImageData(0, 0, bitmap.width, bitmap.height)

    const gridN = Math.ceil(Math.sqrt(manifest.photo_count))
    const imageIndices = new Float32Array(networkNodeCount)
    for (let i = 0; i < networkNodeCount; i += 1) imageIndices[i] = Number.NaN
    const photoMask = new Uint8Array(networkNodeCount)

    const slotToRenderIdx: number[] = []
    for (let slot = 0; slot < manifest.photo_count; slot += 1) {
      const renderIdx = manifest.photoed_render_indices[slot]
      if (renderIdx === undefined || renderIdx >= networkNodeCount) continue
      slotToRenderIdx.push(renderIdx)
      imageIndices[renderIdx] = slotToRenderIdx.length - 1
      photoMask[renderIdx] = 1
    }

    const shape = buildCellShape(CELL_PX)
    const images: ImageData[] = []
    // For each cell, we cache the per-edge-pixel source colour at bake
    // time so recolor() doesn't have to re-walk the source atlas.
    const edgeSrcColors: Uint8Array[] = []

    for (let slot = 0; slot < slotToRenderIdx.length; slot += 1) {
      const col = slot % gridN
      const row = Math.floor(slot / gridN)
      const sx = col * CELL_PX
      const sy = row * CELL_PX
      const out = new ImageData(CELL_PX, CELL_PX)
      bakeBase(out, full, sx, sy, CELL_PX)
      images.push(out)
      edgeSrcColors.push(captureEdgeSourceColors(full, shape, sx, sy, CELL_PX))
    }

    const initialHueLookup = (renderIdx: number): number => {
      const slot = imageIndices[renderIdx]
      if (slot === undefined || Number.isNaN(slot)) return 0
      return hashHue(manifest.eids[slot] ?? renderIdx)
    }

    // Fast recolor: mutate each ImageData in place. For each cell, walk
    // only the precomputed ring + edge offsets — typically ~3,500 pixels
    // out of 16,384, so ~5× faster than re-slicing the full cell.
    const recolor = (hueLookup: (renderIdx: number) => number): ImageData[] => {
      for (let slot = 0; slot < slotToRenderIdx.length; slot += 1) {
        const renderIdx = slotToRenderIdx[slot]!
        const ring = hslToRgb255(hueLookup(renderIdx), RING_SAT, RING_LIGHT)
        const out = images[slot]!.data
        // Ring band — paint flat ring colour with precomputed alpha.
        const rOff = shape.ringOffsets
        const rA = shape.ringAlphas
        for (let k = 0; k < rOff.length; k += 1) {
          const di = rOff[k] as number
          out[di] = ring.r
          out[di + 1] = ring.g
          out[di + 2] = ring.b
          out[di + 3] = rA[k] as number
        }
        // Edge band — lerp source colour with ring colour using
        // precomputed blend weight.
        const eOff = shape.edgeOffsets
        const eT = shape.edgeBlend
        const eSrc = edgeSrcColors[slot]!
        for (let k = 0; k < eOff.length; k += 1) {
          const di = eOff[k] as number
          const t = eT[k] as number
          const it = 1 - t
          out[di] = ((eSrc[k * 3] as number) * it + ring.r * t) | 0
          out[di + 1] = ((eSrc[(k * 3) + 1] as number) * it + ring.g * t) | 0
          out[di + 2] = ((eSrc[(k * 3) + 2] as number) * it + ring.b * t) | 0
          out[di + 3] = 255
        }
      }
      return images
    }

    // Initial colouring uses the legacy eid-hash hue so the disc looks
    // unchanged on first paint.
    recolor(initialHueLookup)

    return {
      manifest,
      images,
      imageIndices,
      photoMask,
      recolor,
    }
  } catch (err) {
    console.warn('[neon-network] atlas load failed:', err)
    return null
  }
}
