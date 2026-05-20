import { cullVisiblePointsEntriesWgsl } from './shaders/cull-visible-points/entries'
import { cullVisiblePointsSharedWgsl } from './shaders/cull-visible-points/shared'
import { cullVisiblePointsVisibilityWgsl } from './shaders/cull-visible-points/visibility'

export function cullVisiblePointsComputeWgsl (): string {
  return [
    cullVisiblePointsSharedWgsl,
    cullVisiblePointsVisibilityWgsl,
    cullVisiblePointsEntriesWgsl,
  ].join('\n')
}
