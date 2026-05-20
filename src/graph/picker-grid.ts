import type { WebGpuLinkPickerGrid, WebGpuPointPickerGrid } from './runtime-contracts'

type LinkSegmentVisitor = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  linkIndex: number,
  visitor: (ax: number, ay: number, bx: number, by: number) => void
) => void

export function buildWebGpuPointPickerGrid (
  positions: Float32Array,
  pointCount: number,
  spaceSize: number
): WebGpuPointPickerGrid | undefined {
  if (pointCount === 0 || positions.length < pointCount * 2) return undefined
  const cellSize = Math.max(32, spaceSize / 128)
  const columns = Math.max(1, Math.ceil(spaceSize / cellSize))
  const rows = columns
  const bucketArrays: number[][] = Array.from({ length: columns * rows }, () => [])
  for (let i = 0; i < pointCount; i += 1) {
    const x = positions[i * 2] ?? NaN
    const y = positions[i * 2 + 1] ?? NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const cx = Math.min(columns - 1, Math.max(0, Math.floor(x / cellSize)))
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)))
    bucketArrays[cy * columns + cx]?.push(i)
  }
  return {
    positions,
    cellSize,
    columns,
    rows,
    buckets: bucketArrays.map(bucket => Int32Array.from(bucket)),
  }
}

export function buildWebGpuLinkPickerGrid (
  positions: Float32Array,
  links: Float32Array | undefined,
  linkCount: number,
  pointCount: number,
  spaceSize: number,
  visitLinkSegments: LinkSegmentVisitor
): WebGpuLinkPickerGrid | undefined {
  if (!links || linkCount === 0 || pointCount === 0 || positions.length < pointCount * 2) return undefined

  const cellSize = Math.max(64, spaceSize / 64)
  const columns = Math.max(1, Math.ceil(spaceSize / cellSize))
  const rows = Math.max(1, Math.ceil(spaceSize / cellSize))
  const cellCount = columns * rows
  const counts = new Int32Array(cellCount)
  const clampCellX = (value: number): number => Math.min(columns - 1, Math.max(0, Math.floor(value / cellSize)))
  const clampCellY = (value: number): number => Math.min(rows - 1, Math.max(0, Math.floor(value / cellSize)))
  const visitLinkCells = (sx: number, sy: number, tx: number, ty: number, visitor: (cell: number) => void): void => {
    const startCx = clampCellX(sx)
    const startCy = clampCellY(sy)
    const endCx = clampCellX(tx)
    const endCy = clampCellY(ty)
    const steps = Math.max(1, Math.abs(endCx - startCx), Math.abs(endCy - startCy))
    let previousCell = -1
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const cx = clampCellX(sx + (tx - sx) * t)
      const cy = clampCellY(sy + (ty - sy) * t)
      const cell = cy * columns + cx
      if (cell === previousCell) continue
      visitor(cell)
      previousCell = cell
    }
  }

  for (let i = 0; i < linkCount; i += 1) {
    const source = links[i * 2]
    const target = links[i * 2 + 1]
    if (source === undefined || target === undefined) continue
    const sx = positions[source * 2]
    const sy = positions[source * 2 + 1]
    const tx = positions[target * 2]
    const ty = positions[target * 2 + 1]
    if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue
    visitLinkSegments(sx, sy, tx, ty, i, (ax, ay, bx, by) => {
      visitLinkCells(ax, ay, bx, by, (cell) => { counts[cell] = (counts[cell] ?? 0) + 1 })
    })
  }

  const cellOffsets = new Int32Array(cellCount + 1)
  let totalEntries = 0
  for (let cell = 0; cell < cellCount; cell += 1) {
    cellOffsets[cell] = totalEntries
    totalEntries += counts[cell] ?? 0
  }
  cellOffsets[cellCount] = totalEntries

  const cellEntries = new Int32Array(totalEntries)
  const cursors = new Int32Array(cellOffsets)
  for (let i = 0; i < linkCount; i += 1) {
    const source = links[i * 2]
    const target = links[i * 2 + 1]
    if (source === undefined || target === undefined) continue
    const sx = positions[source * 2]
    const sy = positions[source * 2 + 1]
    const tx = positions[target * 2]
    const ty = positions[target * 2 + 1]
    if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) continue
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue
    visitLinkSegments(sx, sy, tx, ty, i, (ax, ay, bx, by) => {
      visitLinkCells(ax, ay, bx, by, (cell) => {
        const offset = cursors[cell] ?? 0
        cellEntries[offset] = i
        cursors[cell] = offset + 1
      })
    })
  }

  return {
    positions,
    links,
    cellSize,
    columns,
    rows,
    cellOffsets,
    cellEntries,
    visitMarks: new Uint32Array(linkCount),
    visitToken: 1,
  }
}
