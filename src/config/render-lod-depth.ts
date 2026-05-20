import {
  renderDepthCueDefaultConfigValues,
  type RenderDepthCueConfig,
} from './render-lod-depth-cue'
import {
  renderLodImpostorDefaultConfigValues,
  type RenderLodImpostorConfig,
} from './render-lod-depth-impostor'
import {
  renderLinkLodDefaultConfigValues,
  renderPointLodDefaultConfigValues,
  type RenderLodSamplingConfig,
} from './render-lod-depth-lod'
import {
  renderLodRenderDefaultConfigValues,
  type RenderLodRenderConfig,
} from './render-lod-depth-render'

export type { RenderLodMode } from './render-lod-depth-render'

export interface RenderLodDepthConfig
  extends
    RenderLodRenderConfig,
    RenderLodImpostorConfig,
    RenderLodSamplingConfig,
    RenderDepthCueConfig {}

export const renderLodDepthDefaultConfigValues = {
  ...renderLodRenderDefaultConfigValues,
  ...renderLodImpostorDefaultConfigValues,
  ...renderPointLodDefaultConfigValues,
  ...renderDepthCueDefaultConfigValues,
  ...renderLinkLodDefaultConfigValues,
} satisfies RenderLodDepthConfig
