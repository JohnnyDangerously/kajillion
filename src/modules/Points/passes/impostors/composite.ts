import type { Buffer, Device, RenderPass } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import { ensureTileImpostorRenderCommand } from '@/graph/modules/Points/passes/impostors/tileDraw'
import { isLiveBuffer } from '@/graph/modules/Points/passes/impostors/helpers'
import type {
  DrawImpostorCompositeResult,
  DrawImpostorCompositeState,
} from '@/graph/modules/Points/passes/impostors/types'

export function drawImpostorComposite (options: {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  state: DrawImpostorCompositeState;
  tileResolvedBuffer: Buffer | undefined;
  tileColumns: number;
  tileRows: number;
  tileCount: number;
  tileSize: number;
  tileImpostorMicroSplats: number;
  effectivePixelRatio: number;
  renderPass: RenderPass;
}): DrawImpostorCompositeResult {
  const state = { ...options.state }
  if (options.device.info?.type !== 'webgpu') return { drew: false, state }
  if (!isLiveBuffer(options.tileResolvedBuffer) || options.tileCount === 0) return { drew: false, state }
  if (options.config.impostorTileOpacity <= 0 || options.config.impostorCompositeStrength <= 0) {
    return { drew: true, state }
  }

  state.drawQuadVertexBuffer ||= createFullscreenQuadBuffer(options.device)
  const renderState = ensureTileImpostorRenderCommand({
    device: options.device,
    command: state.tileImpostorCommand,
    uniformStore: state.tileRenderUniformStore,
    quadVertexBuffer: state.drawQuadVertexBuffer,
    screenSize: options.store.screenSize,
    ratio: options.effectivePixelRatio,
    tileColumns: options.tileColumns,
    tileRows: options.tileRows,
    tileSize: options.tileSize,
    tileCount: options.tileCount,
    opacity: options.config.impostorTileOpacity,
    strength: options.config.impostorCompositeStrength,
    microSplats: options.tileImpostorMicroSplats,
    sparseTileThreshold: options.config.impostorSparseTileThreshold,
    massRadiusScale: options.config.impostorMassRadiusScale,
    massThreshold: options.config.impostorMassThreshold,
    massMaxAlpha: options.config.impostorMassMaxAlpha,
    massColorBoost: options.config.impostorMassColorBoost,
    massExtrusion: options.config.impostorMassExtrusion,
    sampleCount: options.config.msaa,
  })
  state.tileRenderUniformStore = renderState.uniformStore
  state.tileImpostorCommand = renderState.command
  if (!state.tileImpostorCommand || !state.tileRenderUniformStore) return { drew: false, state }

  const microSplats = 1
  state.tileImpostorCommand.setInstanceCount(options.tileCount)
  state.tileRenderUniformStore.setUniforms({
    tileRenderUniforms: {
      screenSize: ensureVec2(options.store.screenSize, [0, 0]),
      ratio: options.effectivePixelRatio,
      tileColumns: options.tileColumns,
      tileRows: options.tileRows,
      tileSize: options.tileSize,
      opacity: options.config.impostorTileOpacity,
      strength: options.config.impostorCompositeStrength,
      microSplats,
      sparseTileThreshold: options.config.impostorSparseTileThreshold,
      massRadiusScale: options.config.impostorMassRadiusScale,
      massThreshold: options.config.impostorMassThreshold,
      massMaxAlpha: options.config.impostorMassMaxAlpha,
      massColorBoost: options.config.impostorMassColorBoost,
      massExtrusion: options.config.impostorMassExtrusion,
    },
  })
  state.tileImpostorCommand.setBindings({
    resolvedTiles: options.tileResolvedBuffer,
  })
  state.tileImpostorCommand.draw(options.renderPass)
  return { drew: true, state }
}
