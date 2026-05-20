import type { RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { DrawHighlightedUniforms } from '@/graph/modules/Points/passes/draw/contracts'
import {
  fillDrawHighlightedUniformPayload,
  getPointVisualRingSize,
} from '@/graph/modules/Points/passes/draw/lifecycle'

type DrawPointRingsOptions = {
  renderPass: RenderPass;
  data: GraphData;
  config: GraphConfigInterface;
  store: Store;
  drawHighlightedCommand: Model | undefined;
  drawHighlightedUniformStore: UniformStore<DrawHighlightedUniforms> | undefined;
  drawHighlightedUniformPayload: DrawHighlightedUniforms;
  currentPositionTexture: Texture;
  pointStatusTexture: Texture;
}

export function drawPointRings (options: DrawPointRingsOptions): void {
  const {
    renderPass,
    data,
    config,
    store,
    drawHighlightedCommand,
    drawHighlightedUniformStore,
    drawHighlightedUniformPayload,
    currentPositionTexture,
    pointStatusTexture,
  } = options

  if (!drawHighlightedCommand || !drawHighlightedUniformStore) return
  if (currentPositionTexture.destroyed || pointStatusTexture.destroyed) return

  if (config.renderHoveredPointRing && store.hoveredPoint) {
    drawPointRing({
      renderPass,
      data,
      config,
      store,
      drawHighlightedCommand,
      drawHighlightedUniformStore,
      drawHighlightedUniformPayload,
      currentPositionTexture,
      pointStatusTexture,
      pointIndex: store.hoveredPoint.index,
      color: store.hoveredPointRingColor,
    })
  }

  if (store.focusedPoint) {
    drawPointRing({
      renderPass,
      data,
      config,
      store,
      drawHighlightedCommand,
      drawHighlightedUniformStore,
      drawHighlightedUniformPayload,
      currentPositionTexture,
      pointStatusTexture,
      pointIndex: store.focusedPoint.index,
      color: store.focusedPointRingColor,
    })
  }
}

type DrawPointRingOptions = {
  renderPass: RenderPass;
  data: GraphData;
  config: GraphConfigInterface;
  store: Store;
  drawHighlightedCommand: Model;
  drawHighlightedUniformStore: UniformStore<DrawHighlightedUniforms>;
  drawHighlightedUniformPayload: DrawHighlightedUniforms;
  currentPositionTexture: Texture;
  pointStatusTexture: Texture;
  pointIndex: number;
  color: number[];
}

function drawPointRing (options: DrawPointRingOptions): void {
  const {
    renderPass,
    data,
    config,
    store,
    drawHighlightedCommand,
    drawHighlightedUniformStore,
    drawHighlightedUniformPayload,
    currentPositionTexture,
    pointStatusTexture,
    pointIndex,
    color,
  } = options

  fillDrawHighlightedUniformPayload(
    drawHighlightedUniformPayload,
    config,
    store,
    pointIndex,
    getPointVisualRingSize(data, pointIndex),
    color
  )
  drawHighlightedUniformStore.setUniforms(drawHighlightedUniformPayload)
  drawHighlightedCommand.setBindings({
    positionsTexture: currentPositionTexture,
    pointStatus: pointStatusTexture,
  })
  drawHighlightedCommand.draw(renderPass)
}
