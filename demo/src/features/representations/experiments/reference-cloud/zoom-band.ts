import type { ProjectedNode } from './project'

export interface ZoomBand {
  id: 'macro' | 'community' | 'cluster' | 'work';
  radiusScale: number;
  minRadius: number;
  maxRadius: number;
  collisionPadding: number;
  edgeOpacity: number;
  ringAlpha: number;
  tinyRingAlpha: number;
}

export function resolveZoomBand (scale: number): ZoomBand {
  if (scale < 0.82) return band('macro', 0.92, 0.72, 9.8, 0.86, 1.10, 0.90, 0.28)
  if (scale < 1.45) return band('community', 1.08, 0.86, 12.2, 1.02, 1.05, 0.96, 0.38)
  if (scale < 2.75) return band('cluster', 1.10, 0.96, 13.4, 1.16, 1.00, 0.97, 0.44)
  return band('work', 1.04, 1.10, 14.4, 1.34, 0.88, 0.97, 0.50)
}

export function applyZoomBandRadii (nodes: ProjectedNode[], band: ZoomBand): void {
  for (const node of nodes) {
    const bridgeBoost = node.bridge ? 1.04 : 1
    const depthBoost = clamp(1 + node.depth * 0.24, 0.82, 1.18)
    node.vr = clamp(node.pr * band.radiusScale * bridgeBoost * depthBoost, band.minRadius, band.maxRadius)
  }
}

export function ringThickness (radius: number): number {
  if (radius < 1.5) return Math.min(0.44, radius * 0.36)
  if (radius < 3) return 0.62 + radius * 0.09
  if (radius < 7) return 0.92 + radius * 0.09
  return Math.min(2.35, 1.28 + radius * 0.09)
}

export function collisionRadius (node: ProjectedNode): number {
  return node.vr + ringThickness(node.vr) + (node.vr > 5 ? 0.65 : 0.22)
}

function band (
  id: ZoomBand['id'],
  radiusScale: number,
  minRadius: number,
  maxRadius: number,
  collisionPadding: number,
  edgeOpacity: number,
  ringAlpha: number,
  tinyRingAlpha: number,
): ZoomBand {
  return { id, radiusScale, minRadius, maxRadius, collisionPadding, edgeOpacity, ringAlpha, tinyRingAlpha }
}

function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
