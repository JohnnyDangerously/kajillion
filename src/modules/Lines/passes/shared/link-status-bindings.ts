import { Buffer, Texture, type Device } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'

type LineBackend = 'webgpu' | 'webgl'

export interface LinkStatusBindingsCache {
  backend: LineBackend | undefined;
  position: Buffer | Texture | undefined;
  previousPosition: Buffer | undefined;
  linkStatus: Texture | undefined;
}

export function createLinkStatusBindingsCache (): LinkStatusBindingsCache {
  return {
    backend: undefined,
    position: undefined,
    previousPosition: undefined,
    linkStatus: undefined,
  }
}

export function resetLinkStatusBindingsCache (cache: LinkStatusBindingsCache): void {
  cache.backend = undefined
  cache.position = undefined
  cache.previousPosition = undefined
  cache.linkStatus = undefined
}

export interface BindPositionAndLinkStatusOptions {
  device: Device;
  model: Model | undefined;
  cache: LinkStatusBindingsCache;
  currentPositionTexture: Texture;
  positionStorageBuffer: Buffer | undefined;
  previousPositionStorageBuffer: Buffer | undefined;
  linkStatusTexture: Texture;
}

export function bindPositionAndLinkStatusIfNeeded (
  options: BindPositionAndLinkStatusOptions
): boolean {
  const {
    device,
    model,
    cache,
    currentPositionTexture,
    positionStorageBuffer,
    previousPositionStorageBuffer,
    linkStatusTexture,
  } = options

  if (!model) return false

  const backend: LineBackend = device.info?.type === 'webgpu' ? 'webgpu' : 'webgl'
  const position = backend === 'webgpu' ? positionStorageBuffer : currentPositionTexture
  const previousPosition = backend === 'webgpu' ? previousPositionStorageBuffer : undefined
  if (!position || position.destroyed) return false
  if (backend === 'webgpu' && (!previousPosition || previousPosition.destroyed)) return false

  if (
    cache.backend === backend &&
    cache.position === position &&
    cache.previousPosition === previousPosition &&
    cache.linkStatus === linkStatusTexture
  ) {
    return true
  }

  if (backend === 'webgpu') {
    model.setBindings({
      positions: position as Buffer,
      previousPositions: previousPosition as Buffer,
      linkStatus: linkStatusTexture,
    })
  } else {
    model.setBindings({
      positionsTexture: position as Texture,
      linkStatus: linkStatusTexture,
    })
  }

  cache.backend = backend
  cache.position = position
  cache.previousPosition = previousPosition
  cache.linkStatus = linkStatusTexture
  return true
}
