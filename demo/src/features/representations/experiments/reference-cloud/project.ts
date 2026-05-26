import type { CloudNode } from './types'

export interface ProjectedNode extends CloudNode {
  sx: number;
  sy: number;
  depth: number;
  pr: number;
  vr: number;
  renderAlpha: number;
  renderHidden: boolean;
  renderMode: 'full' | 'texture' | 'hidden';
}

export function projectNode (
  node: CloudNode,
  width: number,
  height: number,
  scale: number,
  panX: number,
  panY: number,
  roll: number,
  yaw: number,
  pitch: number,
): ProjectedNode {
  const cy = Math.cos(yaw); const sy = Math.sin(yaw)
  const cp = Math.cos(pitch); const sp = Math.sin(pitch)
  const cr = Math.cos(roll); const sr = Math.sin(roll)
  const x1 = node.x * cy - node.z * sy
  const z1 = node.x * sy + node.z * cy
  const y2 = node.y * cp - z1 * sp
  const z2 = node.y * sp + z1 * cp
  const xr = x1 * cr - y2 * sr
  const yr = x1 * sr + y2 * cr
  const fov = 2.25
  const perspective = fov / Math.max(1.22, fov - z2 * 0.46)
  const extent = Math.min(width, height) * 0.47 * scale
  return {
    ...node,
    sx: width * 0.5 + xr * perspective * extent + panX,
    sy: height * 0.52 + yr * perspective * extent + panY,
    depth: z2,
    pr: node.radius * perspective * scale,
    vr: node.radius * perspective * scale,
    renderAlpha: 1,
    renderHidden: false,
    renderMode: 'full',
  }
}
