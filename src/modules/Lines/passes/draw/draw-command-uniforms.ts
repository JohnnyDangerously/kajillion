import { UniformStore } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import {
  DRAW_LINE_FRAGMENT_UNIFORM_TYPES,
  DRAW_LINE_UNIFORM_TYPES,
  type LineDrawFragmentUniforms,
  type LineDrawUniforms,
  type LineDrawUniformStoreShape,
} from './contracts'
import {
  applyDrawLineUniforms,
  createDrawLineFragmentUniformScratch,
  createDrawLineUniformPayload,
  createDrawLineUniformScratch,
} from './uniform-payload'
import {
  getEffectiveLineSegments,
  getEffectiveLinkLodStrength,
} from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'

export type { LineDrawUniformStoreShape }

export interface DrawLineUniformRuntime {
  drawLineUniformScratch: LineDrawUniforms;
  drawLineFragmentUniformScratch: LineDrawFragmentUniforms;
  drawLineUniformPayload: LineDrawUniformStoreShape;
}

export function createDrawLineUniformRuntime (): DrawLineUniformRuntime {
  const drawLineUniformScratch = createDrawLineUniformScratch()
  const drawLineFragmentUniformScratch = createDrawLineFragmentUniformScratch()
  return {
    drawLineUniformScratch,
    drawLineFragmentUniformScratch,
    drawLineUniformPayload: createDrawLineUniformPayload(
      drawLineUniformScratch,
      drawLineFragmentUniformScratch
    ),
  }
}

export interface CreateDrawLineUniformStoreOptions {
  config: GraphConfigInterface;
  store: Store;
  isWebGpu: boolean;
}

export function createDrawLineUniformStore (
  options: CreateDrawLineUniformStoreOptions
): UniformStore<LineDrawUniformStoreShape> {
  const { config, store, isWebGpu } = options
  const drawLineUniforms = createDrawLineUniformScratch()
  const drawLineFragmentUniforms = createDrawLineFragmentUniformScratch()

  applyDrawLineUniforms(drawLineUniforms, drawLineFragmentUniforms, {
    config,
    store,
    renderMode: 0,
    linkLodStrength: getEffectiveLinkLodStrength(config),
    hasHighlighting: false,
    linkStatusTextureSize: 0,
    effectiveLineSegments: getEffectiveLineSegments(config),
    isWebGpu,
    renderPositionMix: 1,
    hasArrowedLinks: false,
  })

  return new UniformStore({
    drawLineUniforms: {
      uniformTypes: DRAW_LINE_UNIFORM_TYPES,
      defaultUniforms: drawLineUniforms,
    },
    drawLineFragmentUniforms: {
      uniformTypes: DRAW_LINE_FRAGMENT_UNIFORM_TYPES,
      defaultUniforms: drawLineFragmentUniforms,
    },
  })
}

export interface SetDrawLineUniformsOptions {
  uniformStore: UniformStore<LineDrawUniformStoreShape> | undefined;
  runtime: DrawLineUniformRuntime;
  config: GraphConfigInterface;
  store: Store;
  renderMode: number;
  linkLodStrength: number;
  hasHighlighting: boolean;
  linkStatusTextureSize: number;
  effectiveLineSegments: number;
  isWebGpu: boolean;
  renderPositionMix: number;
  hasArrowedLinks: boolean;
}

export function setDrawLineUniforms (options: SetDrawLineUniformsOptions): void {
  const {
    uniformStore,
    runtime,
    config,
    store,
    renderMode,
    linkLodStrength,
    hasHighlighting,
    linkStatusTextureSize,
    effectiveLineSegments,
    isWebGpu,
    renderPositionMix,
    hasArrowedLinks,
  } = options
  if (!uniformStore) return

  applyDrawLineUniforms(runtime.drawLineUniformScratch, runtime.drawLineFragmentUniformScratch, {
    config,
    store,
    renderMode,
    linkLodStrength,
    hasHighlighting,
    linkStatusTextureSize,
    effectiveLineSegments,
    isWebGpu,
    renderPositionMix,
    hasArrowedLinks,
  })
  uniformStore.setUniforms(runtime.drawLineUniformPayload)
}
