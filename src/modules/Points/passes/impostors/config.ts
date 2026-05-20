type TileImpostorConfig = {
  impostorTileSize?: number;
  impostorMicroSplats?: number;
  impostorAnchorsPerTile?: number;
  renderLodMode?: string;
}

export function getTileImpostorSize (config: TileImpostorConfig): number {
  return Math.max(2, Math.round(config.impostorTileSize || 7))
}

export function getTileImpostorMicroSplats (config: TileImpostorConfig): number {
  return Math.max(1, Math.round(config.impostorMicroSplats || 6))
}

export function getHybridAnchorsPerTile (config: TileImpostorConfig): number {
  return Math.max(1, Math.round(config.impostorAnchorsPerTile || 5))
}

export function getTileBuildSampleRate (config: TileImpostorConfig, scale: number): number {
  if (config.renderLodMode === 'exact') return 1
  if (scale <= 0.16) return 0.25
  if (scale <= 0.24) return 0.33
  if (scale <= 0.34) return 0.50
  if (scale <= 0.46) return 0.67
  return 1
}

export function getTileBuildSampleWeight (sampleRate: number): number {
  return Math.max(1, Math.round(1 / sampleRate))
}
