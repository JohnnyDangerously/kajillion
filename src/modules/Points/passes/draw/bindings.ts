import type { Buffer, Texture } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { PointDrawBackend } from '@/graph/modules/Points/passes/draw/lifecycle'
import { shouldRefreshPointDrawBindings } from '@/graph/modules/Points/passes/draw/lifecycle'

export type PointDrawBindingCache = {
  backend: string | undefined;
  position: Buffer | Texture | undefined;
  previousPosition: Buffer | undefined;
  pointStatus: Texture | undefined;
  pointStatusBuffer: Buffer | undefined;
  imageAtlas: Texture | undefined;
  imageAtlasCoords: Texture | undefined;
}

type RefreshPointDrawBindingsOptions = {
  backend: PointDrawBackend;
  drawCommand: Model;
  position: Buffer | Texture;
  previousPosition: Buffer | undefined;
  pointStatusTexture: Texture;
  pointStatusBuffer: Buffer | undefined;
  imageAtlasTexture: Texture;
  imageAtlasCoordsTexture: Texture;
  drawBindings: PointDrawBindingCache;
}

export function refreshPointDrawBindings (
  options: RefreshPointDrawBindingsOptions
): PointDrawBindingCache {
  const {
    backend,
    drawCommand,
    position,
    previousPosition,
    pointStatusTexture,
    pointStatusBuffer,
    imageAtlasTexture,
    imageAtlasCoordsTexture,
    drawBindings,
  } = options

  if (!shouldRefreshPointDrawBindings(
    drawBindings.backend,
    drawBindings.position,
    drawBindings.previousPosition,
    drawBindings.pointStatus,
    drawBindings.pointStatusBuffer,
    drawBindings.imageAtlas,
    drawBindings.imageAtlasCoords,
    backend,
    position,
    previousPosition,
    pointStatusTexture,
    pointStatusBuffer,
    imageAtlasTexture,
    imageAtlasCoordsTexture
  )) {
    return drawBindings
  }

  if (backend === 'webgpu') {
    if (!previousPosition || !pointStatusBuffer) return drawBindings
    drawCommand.setBindings({
      positions: position as Buffer,
      previousPositions: previousPosition,
      pointStatusBuf: pointStatusBuffer,
      pointStatus: pointStatusTexture,
      imageAtlasTexture,
      imageAtlasCoords: imageAtlasCoordsTexture,
    })
  } else {
    drawCommand.setBindings({
      positionsTexture: position as Texture,
      pointStatus: pointStatusTexture,
      imageAtlasTexture,
      imageAtlasCoords: imageAtlasCoordsTexture,
    })
  }

  return {
    backend,
    position,
    previousPosition,
    pointStatus: pointStatusTexture,
    pointStatusBuffer,
    imageAtlas: imageAtlasTexture,
    imageAtlasCoords: imageAtlasCoordsTexture,
  }
}
