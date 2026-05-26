import { state } from './cache'

export interface FaceLabelInput {
  idx: number;
  x: number;
  y: number;
}

export function buildFaceLabels (
  faces: FaceLabelInput[],
): Array<{ worldX: number; worldY: number; name: string }> {
  return faces.map(face => {
    let name = state.names?.[face.idx] ?? ''
    if (!name && state.atlas) {
      const slot = state.atlas.imageIndices[face.idx]
      if (slot !== undefined && !Number.isNaN(slot)) {
        name = state.atlas.manifest.names[slot] ?? ''
      }
    }
    return { worldX: face.x, worldY: face.y, name }
  })
}

export function fitFacesAfterDelay (
  graph: { setZoomTransformByPointPositions: (...args: [Float32Array, number, undefined, number, boolean]) => void },
  faces: FaceLabelInput[],
  isCurrent: () => boolean,
  padding: number,
  onFit: () => void,
): void {
  window.setTimeout(() => {
    if (!isCurrent()) return
    const xs = faces.map(f => f.x)
    const ys = faces.map(f => f.y)
    const minX = Math.min(...xs); const maxX = Math.max(...xs)
    const minY = Math.min(...ys); const maxY = Math.max(...ys)
    const box = new Float32Array([minX, minY, maxX, maxY])
    graph.setZoomTransformByPointPositions(box, 500, undefined, padding, false)
    onFit()
  }, 650)
}
