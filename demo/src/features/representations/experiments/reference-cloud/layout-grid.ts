export interface PackedCircle {
  x: number;
  y: number;
  r: number;
}

export class PackGrid {
  private readonly cells = new Map<string, PackedCircle[]>()

  constructor (private readonly cell: number) {}

  canPlace (circle: PackedCircle): boolean {
    for (const other of this.near(circle)) {
      if (Math.hypot(circle.x - other.x, circle.y - other.y) < circle.r + other.r) return false
    }
    return true
  }

  add (circle: PackedCircle): void {
    const key = this.key(circle.x, circle.y)
    const list = this.cells.get(key) ?? []
    list.push(circle)
    this.cells.set(key, list)
  }

  private * near (circle: PackedCircle): Generator<PackedCircle> {
    const gx = Math.floor(circle.x / this.cell)
    const gy = Math.floor(circle.y / this.cell)
    for (let y = gy - 2; y <= gy + 2; y += 1) {
      for (let x = gx - 2; x <= gx + 2; x += 1) {
        const list = this.cells.get(`${x}:${y}`)
        if (!list) continue
        for (const other of list) yield other
      }
    }
  }

  private key (x: number, y: number): string {
    return `${Math.floor(x / this.cell)}:${Math.floor(y / this.cell)}`
  }
}
