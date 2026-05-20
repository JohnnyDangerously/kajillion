export type WorkModeZoomStageId = 'galaxy' | 'cluster' | 'single-cluster' | 'work' | 'detail'

export interface WorkModeZoomStage {
  id: WorkModeZoomStageId;
  label: string;
  distance: number;
}

export const WORK_MODE_ZOOM_STAGES: Record<WorkModeZoomStageId, WorkModeZoomStage> = {
  galaxy: { id: 'galaxy', label: 'Galaxy', distance: 100 },
  cluster: { id: 'cluster', label: 'Cluster discovery', distance: 75 },
  'single-cluster': { id: 'single-cluster', label: 'Single cluster', distance: 50 },
  work: { id: 'work', label: 'Work mode', distance: 25 },
  detail: { id: 'detail', label: 'Detail work', distance: 1 },
}

export const WORK_MODE_ZOOM_STAGE_ORDER: WorkModeZoomStageId[] = [
  'galaxy',
  'cluster',
  'single-cluster',
  'work',
  'detail',
]

export const WORK_MODE_ZOOM_STAGE_DURATIONS: Record<WorkModeZoomStageId, number> = {
  galaxy: 520,
  cluster: 460,
  'single-cluster': 420,
  work: 380,
  detail: 320,
}

export function resolveWorkModeZoomStage (distance: number): WorkModeZoomStage {
  if (distance >= 87.5) return WORK_MODE_ZOOM_STAGES.galaxy
  if (distance >= 62.5) return WORK_MODE_ZOOM_STAGES.cluster
  if (distance >= 37.5) return WORK_MODE_ZOOM_STAGES['single-cluster']
  if (distance > 13) return WORK_MODE_ZOOM_STAGES.work
  return WORK_MODE_ZOOM_STAGES.detail
}

export function clampWorkModeZoomDistance (distance: number): number {
  if (!Number.isFinite(distance)) return WORK_MODE_ZOOM_STAGES.galaxy.distance
  return Math.max(1, Math.min(100, distance))
}
