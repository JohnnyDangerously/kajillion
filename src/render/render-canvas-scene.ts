import { Device, Framebuffer, type RenderPass } from '@luma.gl/core'

import { type ITimerQueryPool } from '@/graph/perf'
import { type Lines } from '@/graph/modules/Lines'
import { type Points } from '@/graph/modules/Points'
import { type ResolvedRenderPolicy } from '@/graph/render/resolveAdaptiveRenderPolicy'
import { beginMsaaCanvasPass } from '@/graph/render/msaa-canvas-pass'
import { MsaaTarget } from '@/graph/render/msaa-target'

export interface RenderCanvasScenePreparedState {
  isWebGPU: boolean;
  msaaActive: boolean;
  shouldDrawLinks: boolean;
  lineCullingReady: boolean;
  linePrecomputeReady: boolean;
  shouldRenderPointImpostors: boolean;
  pointImpostorsReady: boolean;
  pointCullingReady: boolean;
}

export interface RenderCanvasSceneOptions {
  device: Device;
  canvasFramebuffer: Framebuffer | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
  msaaTarget: MsaaTarget | undefined;
  backgroundColor: [number, number, number, number];
  shouldDrawLinks: boolean;
  isWebGPU: boolean;
  msaaSamples: number;
  renderPolicy: ResolvedRenderPolicy;
  positionEpoch: number;
  impostorExactOverlay: boolean;
  lines: Lines | undefined;
  points: Points | undefined;
  onPrepared?: (state: RenderCanvasScenePreparedState) => void;
}

export interface RenderCanvasSceneResult {
  msaaTarget: MsaaTarget | undefined;
}

export function renderCanvasScene (
  options: RenderCanvasSceneOptions
): RenderCanvasSceneResult {
  const {
    device,
    canvasFramebuffer,
    timerQueryPool,
    backgroundColor,
    shouldDrawLinks,
    isWebGPU,
    renderPolicy,
    positionEpoch,
    impostorExactOverlay,
    lines,
    points,
  } = options

  const msaaActive = isWebGPU && options.msaaSamples > 1
  const shouldRenderPointImpostors = renderPolicy.pointMode === 'impostor'
  let lineCullingReady = false
  if (shouldDrawLinks && renderPolicy.useLinkGpuCull) {
    lineCullingReady = lines?.prepareGpuCulledDraw(timerQueryPool, true) ?? false
  }
  let linePrecomputeReady = false
  if (shouldDrawLinks && !lineCullingReady) {
    linePrecomputeReady = lines?.prepareDirectDraw() ?? false
  }
  let pointImpostorsReady = false
  if (shouldRenderPointImpostors) {
    pointImpostorsReady = points?.renderImpostorDensity(timerQueryPool, positionEpoch) ?? false
  }
  let pointCullingReady = false
  if (!pointImpostorsReady && renderPolicy.usePointGpuCull) {
    pointCullingReady = points?.prepareGpuCulledDraw(timerQueryPool, true) ?? false
  }

  options.onPrepared?.({
    isWebGPU,
    msaaActive,
    shouldDrawLinks,
    lineCullingReady,
    linePrecomputeReady,
    shouldRenderPointImpostors,
    pointImpostorsReady,
    pointCullingReady,
  })

  if (msaaActive) {
    // MSAA canvas content must share one pass so the single resolve preserves
    // the composed output for links and points.
    timerQueryPool?.begin('render.canvas')
    const msaaPassResult = beginMsaaCanvasPass({
      device,
      canvasFramebuffer,
      msaaTarget: options.msaaTarget,
      timerQueryPool,
      firstPass: true,
      backgroundColor,
    })
    const pass = msaaPassResult.pass
    drawSceneContent({
      pass,
      shouldDrawLinks,
      lineCullingReady,
      pointImpostorsReady,
      pointCullingReady,
      impostorExactOverlay,
      lines,
      points,
    })
    pass.end()
    timerQueryPool?.end()
    return { msaaTarget: msaaPassResult.msaaTarget }
  }

  // Non-MSAA keeps lines and points in separate passes so WebGPU timestamp
  // writes can be attributed independently. Only the first pass clears.
  let firstPass = true
  const startPass = (): RenderPass => {
    const pass = device.beginRenderPass({
      framebuffer: canvasFramebuffer,
      clearColor: firstPass ? backgroundColor : false,
      clearDepth: firstPass ? 1 : false,
      clearStencil: firstPass ? 0 : false,
    })
    firstPass = false
    return pass
  }

  if (shouldDrawLinks) {
    timerQueryPool?.begin('render.lines')
    const linesPass = startPass()
    lines?.draw(linesPass, lineCullingReady)
    linesPass.end()
    timerQueryPool?.end()
  }

  timerQueryPool?.begin('render.points')
  const pointsPass = startPass()
  drawPoints({
    pass: pointsPass,
    pointImpostorsReady,
    pointCullingReady,
    impostorExactOverlay,
    points,
  })
  pointsPass.end()
  timerQueryPool?.end()

  return { msaaTarget: options.msaaTarget }
}

interface DrawSceneContentOptions {
  pass: RenderPass;
  shouldDrawLinks: boolean;
  lineCullingReady: boolean;
  pointImpostorsReady: boolean;
  pointCullingReady: boolean;
  impostorExactOverlay: boolean;
  lines: Lines | undefined;
  points: Points | undefined;
}

function drawSceneContent (options: DrawSceneContentOptions): void {
  if (options.shouldDrawLinks) options.lines?.draw(options.pass, options.lineCullingReady)
  drawPoints(options)
}

interface DrawPointsOptions {
  pass: RenderPass;
  pointImpostorsReady: boolean;
  pointCullingReady: boolean;
  impostorExactOverlay: boolean;
  points: Points | undefined;
}

function drawPoints (options: DrawPointsOptions): void {
  const { pass, pointImpostorsReady, pointCullingReady, impostorExactOverlay, points } = options
  if (pointImpostorsReady && points?.drawImpostorComposite(pass)) {
    if (impostorExactOverlay) points?.drawImpostorExactOverlay(pass)
  } else {
    points?.draw(pass, pointCullingReady)
  }
}
