export interface GlyphCircle {
  x: number;
  y: number;
  fillR: number;
  outerR: number;
  cluster: number;
}

export class GlyphOccupancyMask {
  private readonly cells: Uint8Array
  private readonly circleGrid = new Map<string, GlyphCircle[]>()
  private readonly cols: number
  private readonly rows: number

  constructor (width: number, height: number, private readonly cell: number) {
    this.cols = Math.ceil(width / cell)
    this.rows = Math.ceil(height / cell)
    this.cells = new Uint8Array(this.cols * this.rows)
  }

  wouldCreateOcclusion (candidate: GlyphCircle): boolean {
    for (const accepted of this.near(candidate)) if (createsVisibleOcclusion(candidate, accepted)) return true
    return false
  }

  mark (circle: GlyphCircle): void {
    for (const key of this.gridKeys(circle)) {
      const list = this.circleGrid.get(key) ?? []
      list.push(circle)
      this.circleGrid.set(key, list)
    }
    for (const index of this.indices(circle.x, circle.y, circle.fillR)) this.cells[index] = 1
  }

  occupiedPercent (): number {
    let occupied = 0
    for (const cell of this.cells) occupied += cell
    return occupied / Math.max(1, this.cells.length)
  }

  private * near (circle: GlyphCircle): Generator<GlyphCircle> {
    for (const key of this.gridKeys(circle)) {
      const list = this.circleGrid.get(key)
      if (!list) continue
      for (const other of list) yield other
    }
  }

  private * gridKeys (circle: GlyphCircle): Generator<string> {
    const r = circle.outerR + 8
    for (let y = Math.floor((circle.y - r) / this.cell); y <= Math.floor((circle.y + r) / this.cell); y += 1) {
      for (let x = Math.floor((circle.x - r) / this.cell); x <= Math.floor((circle.x + r) / this.cell); x += 1) yield `${x}:${y}`
    }
  }

  private * indices (x: number, y: number, r: number): Generator<number> {
    const minX = Math.max(0, Math.floor((x - r) / this.cell))
    const maxX = Math.min(this.cols - 1, Math.floor((x + r) / this.cell))
    const minY = Math.max(0, Math.floor((y - r) / this.cell))
    const maxY = Math.min(this.rows - 1, Math.floor((y + r) / this.cell))
    for (let yy = minY; yy <= maxY; yy += 1) for (let xx = minX; xx <= maxX; xx += 1) if (insideCell(x, y, r, this.cell, xx, yy)) yield yy * this.cols + xx
  }
}

function createsVisibleOcclusion (candidate: GlyphCircle, accepted: GlyphCircle): boolean {
  const d = Math.hypot(candidate.x - accepted.x, candidate.y - accepted.y)
  const required = candidate.cluster === accepted.cluster
    ? sameClusterDistance(candidate, accepted)
    : candidate.outerR + accepted.outerR + 4.2
  return d < required
}

function sameClusterDistance (a: GlyphCircle, b: GlyphCircle): number {
  const ringTouch = a.outerR + b.outerR
  return ringTouch + (Math.min(a.outerR, b.outerR) < 2 ? 0.06 : 0.18)
}

function insideCell (x: number, y: number, r: number, cell: number, xx: number, yy: number): boolean {
  return Math.hypot((xx + 0.5) * cell - x, (yy + 0.5) * cell - y) <= r + cell * 0.35
}
