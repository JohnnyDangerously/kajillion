import type { Framebuffer, Texture } from '@luma.gl/core'

export type LevelTarget = {
  texture: Texture;
  fbo: Framebuffer;
}

export type CalculateLevelsUniformStoreShape = {
  calculateLevelsUniforms: {
    pointsTextureSize: number;
    levelTextureSize: number;
    cellSize: number;
  };
}

export type ForceUniformStoreShape = {
  forceUniforms: {
    level: number;
    levels: number;
    levelTextureSize: number;
    alpha: number;
    repulsion: number;
    spaceSize: number;
    theta: number;
  };
}

export type ForceCenterUniformStoreShape = {
  forceCenterUniforms: {
    levelTextureSize: number;
    alpha: number;
    repulsion: number;
  };
}

export type ForceComputeUniformStoreShape = {
  forceComputeUniforms: {
    levels: number;
    alpha: number;
    repulsion: number;
    spaceSize: number;
    theta: number;
    pointsTextureSize: number;
  };
}
