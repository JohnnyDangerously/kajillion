export interface StarfieldData {
  count: number;
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
}

export interface StarPoint {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: readonly [number, number, number];
}

export function packStarfieldData (points: readonly StarPoint[]): StarfieldData {
  const count = points.length
  const positions = new Float32Array(count * 2)
  const sizes = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const alphas = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const s = points[i]!
    positions[i * 2] = s.x
    positions[(i * 2) + 1] = s.y
    sizes[i] = s.size
    alphas[i] = s.alpha
    colors[i * 3] = s.color[0]
    colors[(i * 3) + 1] = s.color[1]
    colors[(i * 3) + 2] = s.color[2]
  }
  return { count, positions, sizes, colors, alphas }
}
