import { Device, Framebuffer, type RenderPass } from '@luma.gl/core'
import { type ITimerQueryPool } from '@/graph/perf'
import { MsaaTarget, makeMsaaPassWrapper } from './msaa-target'

interface BeginMsaaCanvasPassOptions {
  device: Device;
  canvasFramebuffer: Framebuffer | undefined;
  msaaTarget: MsaaTarget | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
  firstPass: boolean;
  backgroundColor: [number, number, number, number];
}

export interface BeginMsaaCanvasPassResult {
  pass: RenderPass;
  msaaTarget: MsaaTarget | undefined;
}

export function beginMsaaCanvasPass (
  options: BeginMsaaCanvasPassOptions
): BeginMsaaCanvasPassResult {
  const {
    device,
    canvasFramebuffer,
    firstPass,
    backgroundColor,
  } = options

  // The luma Framebuffer's first color attachment wraps a luma Texture around
  // the canvas's current GPUTexture. Reach into it for the raw GPUTextureView
  // we need as the resolve target.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasAttachment = canvasFramebuffer?.colorAttachments?.[0] as any
  const resolveView: GPUTextureView | undefined = canvasAttachment?.handle
  const canvasTextureHandle: GPUTexture | undefined = canvasAttachment?.texture?.handle
  if (!resolveView || !canvasTextureHandle) {
    console.warn('[kajillion] MSAA canvas pass: missing canvas view; falling back to single-sample.')
    return {
      pass: device.beginRenderPass({
        framebuffer: canvasFramebuffer,
        clearColor: firstPass ? backgroundColor : false,
        clearDepth: firstPass ? 1 : false,
        clearStencil: firstPass ? 0 : false,
      }),
      msaaTarget: options.msaaTarget,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gpuDevice = (device as any).handle as GPUDevice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commandEncoder = (device as any).commandEncoder?.handle as GPUCommandEncoder

  const msaaTarget = options.msaaTarget ?? new MsaaTarget({
    device: gpuDevice,
    format: canvasTextureHandle.format,
    sampleCount: 4,
  })
  msaaTarget.ensureSize(canvasTextureHandle.width, canvasTextureHandle.height)

  const colorAttachment = msaaTarget.getColorAttachment(
    resolveView,
    firstPass,
    {
      r: backgroundColor[0],
      g: backgroundColor[1],
      b: backgroundColor[2],
      a: backgroundColor[3],
    }
  )

  const descriptor: GPURenderPassDescriptor = {
    label: 'kajillion-msaa-canvas-pass',
    colorAttachments: [colorAttachment],
  }

  // The timer-query pool injects timestampWrites for normal luma passes. This
  // raw pass bypasses luma, so consume the pending timestamp slot manually.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = options.timerQueryPool as any
  if (pool && typeof pool.consumePendingForRawPass === 'function') {
    pool.consumePendingForRawPass(descriptor)
  }

  const handle = commandEncoder.beginRenderPass(descriptor)
  return {
    pass: makeMsaaPassWrapper(handle) as unknown as RenderPass,
    msaaTarget,
  }
}
