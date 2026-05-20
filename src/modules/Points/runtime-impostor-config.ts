import {
  getHybridAnchorsPerTile,
  getTileBuildSampleRate,
  getTileBuildSampleWeight,
  getTileImpostorMicroSplats,
  getTileImpostorSize,
} from '@/graph/modules/Points/passes/impostors/config'

type PointsRuntime = any

function runtime (points: unknown): PointsRuntime {
  return points as PointsRuntime
}

export function getRuntimeTileImpostorSize (points: unknown): number {
  return getTileImpostorSize(runtime(points).config)
}

export function getRuntimeTileImpostorMicroSplats (points: unknown): number {
  return getTileImpostorMicroSplats(runtime(points).config)
}

export function getRuntimeHybridAnchorsPerTile (points: unknown): number {
  return getHybridAnchorsPerTile(runtime(points).config)
}

export function getRuntimeTileBuildSampleRate (points: unknown): number {
  const p = runtime(points)
  const scale = Math.abs(p.store.transformationMatrix4x4[0] ?? 1)
  return getTileBuildSampleRate(p.config, scale)
}

export function getRuntimeTileBuildSampleWeight (points: unknown): number {
  return getTileBuildSampleWeight(getRuntimeTileBuildSampleRate(points))
}
