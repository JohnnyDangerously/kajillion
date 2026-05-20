import { responsiveCameraEase } from '@/graph/graph/runtime-contracts'
import type { Zoom } from '@/graph/modules/Zoom'

export interface GraphRuntimeViewOwner {
  _isDestroyed: boolean
  zoomInstance: Zoom
  ensureDevice: (callback: () => void) => boolean
  setZoomLevel: (value: number, duration?: number, enableSimulation?: boolean) => void
}

export function setRuntimeViewZoomLevel (
  owner: GraphRuntimeViewOwner,
  value: number,
  duration: number,
  enableSimulation: boolean,
  requeue: () => void,
): void {
  if (owner._isDestroyed) return

  if (owner.ensureDevice(requeue)) return

  owner.zoomInstance.shouldEnableSimulationDuringZoomOverride = enableSimulation
  owner.zoomInstance.setZoomLevel(value, duration, responsiveCameraEase)
}

export function zoomRuntimeView (
  owner: GraphRuntimeViewOwner,
  value: number,
  duration: number,
  enableSimulation: boolean,
): void {
  if (owner._isDestroyed) return
  owner.setZoomLevel(value, duration, enableSimulation)
}

export function setRuntimeViewZoomDistance (
  owner: GraphRuntimeViewOwner,
  value: number,
  duration: number,
  enableSimulation: boolean,
): void {
  if (owner._isDestroyed) return
  owner.setZoomLevel(runtimeViewZoomDistanceToLevel(owner, value), duration, enableSimulation)
}

export function getRuntimeViewZoomLevel (owner: GraphRuntimeViewOwner): number {
  if (owner._isDestroyed) return 0
  return owner.zoomInstance.eventTransform.k
}

export function getRuntimeViewZoomDistance (owner: GraphRuntimeViewOwner): number {
  if (owner._isDestroyed) return 1
  return owner.zoomInstance.getZoomDistance()
}

export function runtimeViewZoomLevelToDistance (owner: GraphRuntimeViewOwner, zoomLevel: number): number {
  if (owner._isDestroyed) return 1
  return owner.zoomInstance.zoomLevelToDistance(zoomLevel)
}

export function runtimeViewZoomDistanceToLevel (owner: GraphRuntimeViewOwner, distance: number): number {
  if (owner._isDestroyed) return 1
  return owner.zoomInstance.zoomDistanceToLevel(distance)
}
