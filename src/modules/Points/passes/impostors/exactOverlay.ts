import type { Buffer, Device, RenderPass } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { createFullscreenQuadBuffer } from '@/graph/modules/Points/passes/resources/lifecycle'
import { drawModelIndirect } from '@/graph/modules/Points/passes/visible-culling/draw'
import {
  ensureCompactedAnchorRenderCommand,
  ensureHybridAnchorRenderCommand,
} from '@/graph/modules/Points/passes/impostors/anchorDraw'
import { isLiveBuffer } from '@/graph/modules/Points/passes/impostors/helpers'
import type {
  DrawImpostorExactOverlayResult,
  DrawImpostorExactOverlayState,
} from '@/graph/modules/Points/passes/impostors/types'

export function drawImpostorExactOverlay (options: {
  device: Device;
  config: GraphConfigInterface;
  data: GraphData;
  store: Store;
  state: DrawImpostorExactOverlayState;
  positionStorageBuffer: Buffer | undefined;
  tileResolvedBuffer: Buffer | undefined;
  tileColumns: number;
  tileRows: number;
  tileCount: number;
  tileSize: number;
  hybridAnchorCountBuffer: Buffer | undefined;
  hybridAnchorPositionBuffer: Buffer | undefined;
  hybridAnchorColorBuffer: Buffer | undefined;
  hybridAnchorIndirectBuffer: Buffer | undefined;
  hybridAnchorCapacity: number;
  effectivePixelRatio: number;
  renderPass: RenderPass;
  ensureColorBuffer: () => Buffer | undefined;
}): DrawImpostorExactOverlayResult {
  const state = { ...options.state }
  if (options.device.info?.type !== 'webgpu') return { drew: false, state }
  if (options.config.impostorStableOverlay) {
    if (!isLiveBuffer(options.positionStorageBuffer)) return { drew: false, state }
    if (!state.colorBuffer) state.colorBuffer = options.ensureColorBuffer()
    if (!state.colorBuffer) return { drew: false, state }
    if (!isLiveBuffer(options.tileResolvedBuffer) || options.tileCount === 0) return { drew: false, state }

    state.drawQuadVertexBuffer ||= createFullscreenQuadBuffer(options.device)
    const renderState = ensureHybridAnchorRenderCommand({
      device: options.device,
      command: state.hybridAnchorCommand,
      uniformStore: state.hybridAnchorUniformStore,
      quadVertexBuffer: state.drawQuadVertexBuffer,
      ratio: options.effectivePixelRatio,
      screenSize: options.store.screenSize,
      pointSizeScale: options.config.pointSizeScale * options.config.impostorExactOverlaySizeScale,
      denseOpacity: options.config.pointOpacity * options.config.impostorExactOverlayOpacity,
      sparseOpacity: options.config.pointOpacity * options.config.impostorSparseAnchorOpacity,
      maxPointSize: options.store.maxPointSize,
      sampleCount: options.config.msaa,
      transformationMatrix: options.store.transformationMatrix4x4,
      spaceSize: options.store.adjustedSpaceSize,
      tileSize: options.tileSize,
      tileColumns: options.tileColumns,
      tileRows: options.tileRows,
      denseSampleRate: options.config.impostorExactOverlaySampleRate,
      sparseTileThreshold: options.config.impostorSparseTileThreshold,
      pointCount: options.data.pointsNumber ?? 0,
    })
    state.hybridAnchorUniformStore = renderState.uniformStore
    state.hybridAnchorCommand = renderState.command
    if (!state.hybridAnchorCommand || !state.hybridAnchorUniformStore) return { drew: false, state }

    state.hybridAnchorCommand.setInstanceCount(options.data.pointsNumber ?? 0)
    state.hybridAnchorUniformStore.setUniforms({
      hybridAnchorUniforms: {
        ratio: options.effectivePixelRatio,
        transformationMatrix: options.store.transformationMatrix4x4,
        spaceSize: options.store.adjustedSpaceSize,
        screenSize: ensureVec2(options.store.screenSize, [0, 0]),
        tileSize: options.tileSize,
        tileColumns: options.tileColumns,
        tileRows: options.tileRows,
        pointSizeScale: options.config.pointSizeScale * options.config.impostorExactOverlaySizeScale,
        denseSampleRate: options.config.impostorExactOverlaySampleRate,
        denseOpacity: options.config.pointOpacity * options.config.impostorExactOverlayOpacity,
        sparseOpacity: options.config.pointOpacity * options.config.impostorSparseAnchorOpacity,
        sparseTileThreshold: options.config.impostorSparseTileThreshold,
        maxPointSize: options.store.maxPointSize,
      },
    })
    state.hybridAnchorCommand.setBindings({
      positions: options.positionStorageBuffer,
      colors: state.colorBuffer,
      resolvedTiles: options.tileResolvedBuffer,
    })
    state.hybridAnchorCommand.draw(options.renderPass)
    return { drew: true, state }
  }

  if (!isLiveBuffer(options.hybridAnchorPositionBuffer)) return { drew: false, state }
  if (!isLiveBuffer(options.hybridAnchorColorBuffer)) return { drew: false, state }
  if (!isLiveBuffer(options.hybridAnchorCountBuffer)) return { drew: false, state }
  if (!isLiveBuffer(options.hybridAnchorIndirectBuffer)) return { drew: false, state }
  if (options.hybridAnchorCapacity === 0) return { drew: false, state }

  state.drawQuadVertexBuffer ||= createFullscreenQuadBuffer(options.device)
  const renderState = ensureCompactedAnchorRenderCommand({
    device: options.device,
    command: state.compactedAnchorCommand,
    uniformStore: state.compactedAnchorUniformStore,
    quadVertexBuffer: state.drawQuadVertexBuffer,
    ratio: options.effectivePixelRatio,
    screenSize: options.store.screenSize,
    pointSizeScale: options.config.pointSizeScale * options.config.impostorExactOverlaySizeScale,
    denseOpacity: options.config.pointOpacity * options.config.impostorExactOverlayOpacity,
    sparseOpacity: options.config.pointOpacity * options.config.impostorSparseAnchorOpacity,
    maxPointSize: options.store.maxPointSize,
    sampleCount: options.config.msaa,
    hybridAnchorCapacity: options.hybridAnchorCapacity,
  })
  state.compactedAnchorUniformStore = renderState.uniformStore
  state.compactedAnchorCommand = renderState.command
  if (!state.compactedAnchorCommand || !state.compactedAnchorUniformStore) return { drew: false, state }

  state.compactedAnchorUniformStore.setUniforms({
    compactedAnchorUniforms: {
      screenSize: ensureVec2(options.store.screenSize, [0, 0]),
      ratio: options.effectivePixelRatio,
      pointSizeScale: options.config.pointSizeScale * options.config.impostorExactOverlaySizeScale,
      denseOpacity: options.config.pointOpacity * options.config.impostorExactOverlayOpacity,
      sparseOpacity: options.config.pointOpacity * options.config.impostorSparseAnchorOpacity,
      maxPointSize: options.store.maxPointSize,
    },
  })
  state.compactedAnchorCommand.setBindings({
    anchorPositions: options.hybridAnchorPositionBuffer,
    anchorColors: options.hybridAnchorColorBuffer,
    visibleAnchorIndices: options.hybridAnchorCountBuffer,
  })
  return {
    drew: drawModelIndirect(state.compactedAnchorCommand, options.renderPass, options.hybridAnchorIndirectBuffer),
    state,
  }
}
