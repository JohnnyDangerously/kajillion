import type { Buffer, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type {
  CompactedAnchorUniforms,
  HybridAnchorUniforms,
  TileRenderUniforms,
} from '@/graph/modules/Points/passes/impostors/contracts'
import type { HybridAnchorBuildPipelineState } from '@/graph/modules/Points/passes/impostors/pipelines/hybridBuild'
import type { TileImpostorBuildPipelineState } from '@/graph/modules/Points/passes/impostors/pipelines/tileBuild'

export type ImpostorBuildParameters = {
  tileSize: number;
  tileBuildSampleRate: number;
  tileBuildSampleWeight: number;
  hybridAnchorsPerTile: number;
}

export type RenderImpostorDensityState = {
  colorBuffer: Buffer | undefined;
  sizeBuffer: Buffer | undefined;
  tileAtomicBuffer: Buffer | undefined;
  tileResolvedBuffer: Buffer | undefined;
  tileColumns: number;
  tileRows: number;
  tileCount: number;
  impostorBuildSignature: string;
  hybridAnchorCountBuffer: Buffer | undefined;
  hybridAnchorPositionBuffer: Buffer | undefined;
  hybridAnchorColorBuffer: Buffer | undefined;
  hybridAnchorIndirectBuffer: Buffer | undefined;
  hybridAnchorCapacity: number;
  tileBuildPipelines: TileImpostorBuildPipelineState;
  hybridAnchorBuildPipelines: HybridAnchorBuildPipelineState;
}

export type RenderImpostorDensityResult = {
  rendered: boolean;
  state: RenderImpostorDensityState;
}

export type DrawImpostorCompositeState = {
  drawQuadVertexBuffer: Buffer | undefined;
  tileImpostorCommand: Model | undefined;
  tileRenderUniformStore: UniformStore<TileRenderUniforms> | undefined;
}

export type DrawImpostorCompositeResult = {
  drew: boolean;
  state: DrawImpostorCompositeState;
}

export type DrawImpostorExactOverlayState = {
  colorBuffer: Buffer | undefined;
  drawQuadVertexBuffer: Buffer | undefined;
  hybridAnchorCommand: Model | undefined;
  hybridAnchorUniformStore: UniformStore<HybridAnchorUniforms> | undefined;
  compactedAnchorCommand: Model | undefined;
  compactedAnchorUniformStore: UniformStore<CompactedAnchorUniforms> | undefined;
}

export type DrawImpostorExactOverlayResult = {
  drew: boolean;
  state: DrawImpostorExactOverlayState;
}
