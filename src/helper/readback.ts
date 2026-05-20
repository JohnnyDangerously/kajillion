import { Device, Framebuffer } from '@luma.gl/core'

/**
 * TODO: Migrate from deprecated `readPixelsToArrayWebGL` to CommandEncoder API
 *
 * `readPixelsToArrayWebGL` is deprecated in luma.gl v9. The recommended modern approach is:
 *
 * 1. Create a buffer to hold the pixel data:
 *    const buffer = device.createBuffer({
 *      byteLength: width * height * 4 * 4, // RGBA, 4 bytes per float
 *      usage: Buffer.COPY_DST | Buffer.MAP_READ
 *    });
 *
 * 2. Copy texture/framebuffer to buffer using command encoder:
 *    const commandEncoder = device.createCommandEncoder();
 *    commandEncoder.copyTextureToBuffer({
 *      sourceTexture: fbo, // Can be Texture or Framebuffer
 *      width: sourceWidth ?? fbo.width,
 *      height: sourceHeight ?? fbo.height,
 *      origin: [sourceX, sourceY],
 *      destinationBuffer: buffer
 *    });
 *    const commandBuffer = commandEncoder.finish();
 *    device.submit(commandBuffer);
 *
 * 3. Read the data from the buffer (async):
 *    const pixelData = await buffer.readAsync(); // Returns ArrayBuffer
 *    return new Float32Array(pixelData);
 *
 * Note: The modern approach is asynchronous, so this function signature would need to change
 * to return Promise<Float32Array> or we'd need to handle async at all call sites (18 locations).
 *
 * Migration impact:
 * - This function is used in 18 places across the codebase
 * - All call sites would need to be updated to handle async
 * - Consider batching the migration to avoid inconsistencies
 *
 * Current status: Deprecated but still functional. Keeping for now until full migration can be planned.
 *
 * @note Cosmos currently supports WebGL only; support for other device types will be added later.
 */
export function readPixels (device: Device, fbo: Framebuffer, sourceX = 0, sourceY = 0, sourceWidth?: number, sourceHeight?: number): Float32Array {
  // WebGPU has no sync readback. Callers either have their own WebGPU fallback
  // (e.g. getPointPositions reads cached input data) or degrade gracefully on an
  // empty array. Proper async readback via copyTextureToBuffer is a follow-up.
  if (device.info?.type === 'webgpu') return new Float32Array(0)
  return device.readPixelsToArrayWebGL(fbo, {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  }) as Float32Array
}

/**
 * Reusable async WebGPU readback for tiny rgba32float framebuffer targets.
 *
 * Hover picking reads 1x1/2x2 targets frequently. Reusing the aligned staging
 * buffer avoids GPUBuffer allocation/destruction on every mouse hover cycle.
 */
export class Rgba32FloatFramebufferReadback {
  private readback: GPUBuffer | undefined
  private byteLength = 0
  private isMapped = false

  public async read (
    device: Device,
    fbo: Framebuffer,
    sourceX = 0,
    sourceY = 0,
    sourceWidth = fbo.width,
    sourceHeight = fbo.height
  ): Promise<Float32Array> {
    if (device.info?.type !== 'webgpu') {
      return readPixels(device, fbo, sourceX, sourceY, sourceWidth, sourceHeight)
    }

    const attachment = fbo.colorAttachments?.[0]
    const textureHandle = (attachment?.texture as unknown as { handle?: GPUTexture } | undefined)?.handle
    const gpuDevice = (device as unknown as { handle?: GPUDevice }).handle
    if (!textureHandle || !gpuDevice) return new Float32Array(0)

    const bytesPerPixel = 16
    const packedBytesPerRow = sourceWidth * bytesPerPixel
    const bytesPerRow = Math.ceil(packedBytesPerRow / 256) * 256
    const byteLength = bytesPerRow * sourceHeight
    const readback = this.ensureBuffer(gpuDevice, byteLength)

    const encoder = gpuDevice.createCommandEncoder()
    encoder.copyTextureToBuffer(
      {
        texture: textureHandle,
        origin: { x: sourceX, y: sourceY, z: 0 },
      },
      {
        buffer: readback,
        bytesPerRow,
        rowsPerImage: sourceHeight,
      },
      {
        width: sourceWidth,
        height: sourceHeight,
        depthOrArrayLayers: 1,
      }
    )
    gpuDevice.queue.submit([encoder.finish()])

    try {
      await readback.mapAsync(GPUMapMode.READ, 0, byteLength)
      this.isMapped = true
      const mapped = new Uint8Array(readback.getMappedRange(0, byteLength))
      const result = new Float32Array(sourceWidth * sourceHeight * 4)
      const resultBytes = new Uint8Array(result.buffer)
      for (let row = 0; row < sourceHeight; row += 1) {
        const srcStart = row * bytesPerRow
        const dstStart = row * packedBytesPerRow
        resultBytes.set(mapped.subarray(srcStart, srcStart + packedBytesPerRow), dstStart)
      }
      return result
    } finally {
      if (this.isMapped) {
        readback.unmap()
        this.isMapped = false
      }
    }
  }

  public destroy (): void {
    if (this.isMapped) {
      this.readback?.unmap()
      this.isMapped = false
    }
    this.readback?.destroy()
    this.readback = undefined
    this.byteLength = 0
  }

  private ensureBuffer (gpuDevice: GPUDevice, byteLength: number): GPUBuffer {
    if (!this.readback || this.byteLength < byteLength) {
      this.readback?.destroy()
      this.readback = gpuDevice.createBuffer({
        size: byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })
      this.byteLength = byteLength
    }
    return this.readback
  }
}

/**
 * Async WebGPU readback for small rgba32float framebuffer targets.
 *
 * This is intentionally narrow: use it for picking targets, not screenshots or
 * full-frame readbacks. WebGPU requires bytesPerRow to be 256-byte aligned, so
 * the mapped buffer is repacked to the same tight Float32Array shape that
 * `readPixels()` returns on WebGL.
 */
export async function readRgba32FloatFramebufferAsync (
  device: Device,
  fbo: Framebuffer,
  sourceX = 0,
  sourceY = 0,
  sourceWidth = fbo.width,
  sourceHeight = fbo.height
): Promise<Float32Array> {
  const oneShotReadback = new Rgba32FloatFramebufferReadback()
  try {
    return await oneShotReadback.read(device, fbo, sourceX, sourceY, sourceWidth, sourceHeight)
  } finally {
    oneShotReadback.destroy()
  }
}
