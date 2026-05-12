// Binary format for pre-baked graph layouts.
//
// Layout (little-endian, 8-byte aligned):
//
//   offset  bytes  field
//   ------  -----  -----
//        0      4  magic "BAKE" (0x42 0x41 0x4B 0x45)
//        4      4  version (u32) — current = 1
//        8      4  nodeCount (u32)
//       12      4  edgeCount (u32) — 0 if points-only
//       16     16  reserved (4 × u32, zero)
//       32  N*8    positions Float32 LE, [x0, y0, x1, y1, …]
//       32+P E*8  links Float32 LE, [a0, b0, a1, b1, …] (indices)
//
// where P = nodeCount * 2 * 4 and E = edgeCount.

export const BAKED_MAGIC = 0x454B4142 // 'BAKE' LE
export const BAKED_VERSION = 1
const HEADER_BYTES = 32

export interface BakedLayout {
  nodeCount: number;
  edgeCount: number;
  positions: Float32Array;
  links: Float32Array;
}

export function encodeBaked (layout: BakedLayout): ArrayBuffer {
  const { nodeCount, edgeCount, positions, links } = layout
  if (positions.length !== nodeCount * 2) {
    throw new Error(`encodeBaked: positions.length ${positions.length} != nodeCount*2 ${nodeCount * 2}`)
  }
  if (links.length !== edgeCount * 2) {
    throw new Error(`encodeBaked: links.length ${links.length} != edgeCount*2 ${edgeCount * 2}`)
  }
  const totalBytes = HEADER_BYTES + positions.byteLength + links.byteLength
  const buf = new ArrayBuffer(totalBytes)
  const view = new DataView(buf)
  view.setUint32(0, BAKED_MAGIC, true)
  view.setUint32(4, BAKED_VERSION, true)
  view.setUint32(8, nodeCount, true)
  view.setUint32(12, edgeCount, true)
  // bytes 16..32 stay zero.
  new Float32Array(buf, HEADER_BYTES, positions.length).set(positions)
  new Float32Array(buf, HEADER_BYTES + positions.byteLength, links.length).set(links)
  return buf
}

export function decodeBaked (buf: ArrayBuffer): BakedLayout {
  if (buf.byteLength < HEADER_BYTES) throw new Error('baked: buffer too small for header')
  const view = new DataView(buf)
  const magic = view.getUint32(0, true)
  if (magic !== BAKED_MAGIC) throw new Error(`baked: bad magic 0x${magic.toString(16)}`)
  const version = view.getUint32(4, true)
  if (version !== BAKED_VERSION) throw new Error(`baked: unsupported version ${version}`)
  const nodeCount = view.getUint32(8, true)
  const edgeCount = view.getUint32(12, true)
  const positionsBytes = nodeCount * 2 * Float32Array.BYTES_PER_ELEMENT
  const linksBytes = edgeCount * 2 * Float32Array.BYTES_PER_ELEMENT
  if (buf.byteLength < HEADER_BYTES + positionsBytes + linksBytes) {
    throw new Error('baked: buffer truncated')
  }
  const positions = new Float32Array(buf.slice(HEADER_BYTES, HEADER_BYTES + positionsBytes))
  const links = edgeCount > 0
    ? new Float32Array(buf.slice(HEADER_BYTES + positionsBytes, HEADER_BYTES + positionsBytes + linksBytes))
    : new Float32Array(0)
  return { nodeCount, edgeCount, positions, links }
}
