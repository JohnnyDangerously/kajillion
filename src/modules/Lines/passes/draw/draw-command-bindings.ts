import type { Buffer, Device, Texture } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import {
  bindPositionAndLinkStatusIfNeeded,
  type LinkStatusBindingsCache,
} from '@/graph/modules/Lines/passes/shared/link-status-bindings'

interface BindDrawCurveCommandOptions {
  device: Device;
  model: Model | undefined;
  cache: LinkStatusBindingsCache;
  currentPositionTexture: Texture;
  positionStorageBuffer: Buffer | undefined;
  previousPositionStorageBuffer: Buffer | undefined;
  linkStatusTexture: Texture;
}

export function bindDrawCurveCommandIfNeeded (
  options: BindDrawCurveCommandOptions
): boolean {
  return bindPositionAndLinkStatusIfNeeded(options)
}

export function bindDrawCurveIndexCommandIfNeeded (
  options: BindDrawCurveCommandOptions
): boolean {
  return bindPositionAndLinkStatusIfNeeded(options)
}
