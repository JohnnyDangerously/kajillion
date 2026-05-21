import type { VisiblePointTileBudgetLayout } from './contracts'

type VisiblePointTileBudgetConfig = {
  pointTileBudgetSize?: number;
  pointTileBudget?: number;
  pointTileBudgetMaxScale?: number;
}

export function getVisiblePointTileBudgetLayout ({
  config,
  screenSize,
  pixelRatio,
  scale,
}: {
  config: VisiblePointTileBudgetConfig;
  screenSize: [number, number];
  pixelRatio: number;
  scale: number;
}): VisiblePointTileBudgetLayout {
  const tileSize = Math.max(4, Math.floor(config.pointTileBudgetSize || 22))
  const tileColumns = Math.max(1, Math.ceil((screenSize[0] * pixelRatio) / tileSize))
  const tileRows = Math.max(1, Math.ceil((screenSize[1] * pixelRatio) / tileSize))
  const requestedBudget = Math.max(0, Math.min(32, Math.floor(config.pointTileBudget || 0)))
  const maxScale = Math.max(0, config.pointTileBudgetMaxScale || 0)
  const budgetActive = requestedBudget > 0 && (maxScale <= 0 || scale <= maxScale)
  const slots = Math.max(1, budgetActive ? requestedBudget : 1)
  return {
    budget: budgetActive ? requestedBudget : 0,
    tileSize,
    tileColumns,
    tileRows,
    slots,
    capacity: Math.max(1, tileColumns * tileRows * slots),
  }
}
