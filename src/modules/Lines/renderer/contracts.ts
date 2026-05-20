import type { Buffer, Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config/schema'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { LineDrawUniformStoreShape } from '@/graph/modules/Lines/passes/draw/contracts'
import type { DrawLineUniformRuntime } from '@/graph/modules/Lines/passes/draw/draw-command-uniforms'
import type { HoveredLineIndexBindingsCache } from '@/graph/modules/Lines/passes/hover/hovered-line-index-pass'
import type { HoveredLineIndexUniformStoreShape } from '@/graph/modules/Lines/passes/hover/contracts'
import type { LineInstancePrecomputePass } from '@/graph/modules/Lines/passes/precompute/line-instance-pass'
import type { FillSampledLinksUniformStoreShape } from '@/graph/modules/Lines/passes/sampling/contracts'
import type { LinkStatusBindingsCache } from '@/graph/modules/Lines/passes/shared/link-status-bindings'
import type { VisibleLineCullingPass } from '@/graph/modules/Lines/passes/visible-culling/visible-line-culling-pass'

export type LinesPointRef = {
  currentPositionTexture: Texture | undefined;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  renderPositionMix: number;
}

export type LinesRendererContext = {
  readonly device: Device;
  readonly config: GraphConfigInterface;
  readonly store: Store;
  readonly data: GraphData;
  readonly points: LinesPointRef | undefined;
  linkIndexFbo: Framebuffer | undefined;
  hoveredLineIndexFbo: Framebuffer | undefined;
  sampledLinksFbo: Framebuffer | undefined;
  linkStatusTexture: Texture | undefined;
  hasArrowedLinks: boolean;
  readonly lineInstancePrecomputePass: LineInstancePrecomputePass;
  readonly visibleLineCullingPass: VisibleLineCullingPass;
  linkStatusTextureSize: number;
  drawCurveCommand: Model | undefined;
  drawCurveInstancedCommand: Model | undefined;
  drawCulledCurveCommand: Model | undefined;
  drawCurveIndexCommand: Model | undefined;
  hoveredLineIndexCommand: Model | undefined;
  readonly drawCurveBindingsCache: LinkStatusBindingsCache;
  readonly drawCurveIndexBindingsCache: LinkStatusBindingsCache;
  readonly hoveredLineBindingsCache: HoveredLineIndexBindingsCache;
  readonly drawLineUniformRuntime: DrawLineUniformRuntime;
  fillSampledLinksFboCommand: Model | undefined;
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  widthBuffer: Buffer | undefined;
  arrowBuffer: Buffer | undefined;
  curveLineGeometry: number[][] | undefined;
  curveLineBuffer: Buffer | undefined;
  linkIndexBuffer: Buffer | undefined;
  quadBuffer: Buffer | undefined;
  linkIndexTexture: Texture | undefined;
  hoveredLineIndexTexture: Texture | undefined;
  fillSampledLinksUniformStore: UniformStore<FillSampledLinksUniformStoreShape> | undefined;
  drawLineUniformStore: UniformStore<LineDrawUniformStoreShape> | undefined;
  hoveredLineIndexUniformStore: UniformStore<HoveredLineIndexUniformStoreShape> | undefined;
  hoveredLineIndexUniformBuffer: Buffer | undefined;
  previousScreenSize: [number, number] | undefined;
  updateLinkIndexFbo: () => void;
  updateSampledLinksGrid: () => void;
  updatePointsBuffer: () => void;
  updateColor: () => void;
  updateWidth: () => void;
  updateArrow: () => void;
  updateLinkStatus: () => void;
  updateCurveLineGeometry: () => void;
}
