// MSAA render target manager for the canvas pass.
//
// luma.gl 9.2.6's RenderPass abstraction does not expose a resolveTarget on
// its color attachments, so 4× MSAA cannot be wired through the normal
// `device.beginRenderPass({framebuffer})` path. This module owns the
// multisample GPUTexture and builds the descriptor used by the hand-rolled
// `commandEncoder.beginRenderPass(descriptor)` in the engine's draw loop.
//
// Sizing: the texture is recreated when the canvas backbuffer dimensions
// change. Both dimensions and the canvas's color format must match the
// resolveTarget exactly or Dawn rejects the pass at submit.
//
// storeOp: 'discard' on the multisample view is the key trick — on TBDR
// (Apple Silicon) the multisample samples live in tile memory and only the
// resolved single-sample copy gets written to main memory, so the cost is
// limited to extra fragment shading work, not extra bandwidth.

interface MsaaTargetProps {
  device: GPUDevice;
  format: GPUTextureFormat;
  sampleCount: 4;
}

export class MsaaTarget {
  private readonly device: GPUDevice
  private readonly format: GPUTextureFormat
  private readonly sampleCount: 4
  private texture: GPUTexture | null = null
  private cachedView: GPUTextureView | null = null
  private width = 0
  private height = 0

  public constructor (props: MsaaTargetProps) {
    this.device = props.device
    this.format = props.format
    this.sampleCount = props.sampleCount
  }

  /**
   * Ensure the multisample texture matches the target dimensions. Recreates
   * the texture (and invalidates the cached view) on a size change. The new
   * view is created lazily on the next `getColorAttachment()` call.
   */
  public ensureSize (width: number, height: number): void {
    if (width === this.width && height === this.height && this.texture) return
    this.destroyTexture()
    this.width = width
    this.height = height
    if (width === 0 || height === 0) return
    this.texture = this.device.createTexture({
      label: 'kajillion-msaa-target',
      size: { width, height, depthOrArrayLayers: 1 },
      sampleCount: this.sampleCount,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  /**
   * Build a GPURenderPassColorAttachment that renders into the multisample
   * texture and resolves to `resolveTarget`. `clearColor` only honored when
   * `clear` is true; otherwise loadOp is 'load' so a prior pass's resolved
   * output composes correctly (kajillion's lines and points each take their
   * own render pass for timestamp-query isolation).
   */
  public getColorAttachment (
    resolveTarget: GPUTextureView,
    clear: boolean,
    clearColor: GPUColor
  ): GPURenderPassColorAttachment {
    if (!this.texture) {
      throw new Error('MsaaTarget.getColorAttachment called before ensureSize')
    }
    this.cachedView ||= this.texture.createView({ label: 'kajillion-msaa-view' })
    return {
      view: this.cachedView,
      resolveTarget,
      loadOp: clear ? 'clear' : 'load',
      // 'discard' on the multisample view: only the resolved single-sample
      // texture is written to main memory. On TBDR the multisample samples
      // never leave tile memory.
      storeOp: 'discard',
      clearValue: clear ? clearColor : undefined,
    }
  }

  public destroy (): void {
    this.destroyTexture()
    this.width = 0
    this.height = 0
  }

  private destroyTexture (): void {
    if (this.texture) {
      this.texture.destroy()
      this.texture = null
    }
    this.cachedView = null
  }
}

/**
 * Minimal RenderPass-like wrapper around a raw GPURenderPassEncoder.
 *
 * luma.gl's `Model.draw(pass)` (and the WebGPURenderPipeline.draw it calls)
 * structurally accesses these on the pass: `.handle` (the encoder),
 * `.pushDebugGroup(label)`, `.popDebugGroup()`, and `.end()`. They never
 * inspect the prototype or check `instanceof`, so a plain object with
 * matching shape is fine for the canvas MSAA path.
 *
 * Why not subclass luma's WebGPURenderPass? Its constructor builds its own
 * descriptor from a luma Framebuffer and calls beginRenderPass for us —
 * exactly what we're trying to avoid so we can supply resolveTarget.
 */
export interface MsaaPassWrapper {
  handle: GPURenderPassEncoder;
  pushDebugGroup: (label: string) => void;
  popDebugGroup: () => void;
  end: () => void;
}

export function makeMsaaPassWrapper (handle: GPURenderPassEncoder): MsaaPassWrapper {
  return {
    handle,
    pushDebugGroup (label: string): void { handle.pushDebugGroup(label) },
    popDebugGroup (): void { handle.popDebugGroup() },
    end (): void { handle.end() },
  }
}
