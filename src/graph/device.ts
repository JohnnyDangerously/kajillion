import { luma, type Device } from '@luma.gl/core'
import { webgl2Adapter } from '@luma.gl/webgl'
import type { GraphConfigInterface } from '@/graph/config'

export function validateGraphDevice (device: Device): NonNullable<Device['canvasContext']> {
  const deviceCanvasContext = device.canvasContext
  // Cosmos requires an HTMLCanvasElement canvas context.
  // OffscreenCanvas and compute-only devices are not supported.
  if (deviceCanvasContext === null || deviceCanvasContext.type === 'offscreen-canvas') {
    throw new Error('Device must have an HTMLCanvasElement canvas context. OffscreenCanvas and compute-only devices are not supported.')
  }
  return deviceCanvasContext
}

export async function createGraphDevice (
  canvas: HTMLCanvasElement,
  config: GraphConfigInterface,
  sanitizePixelRatio: (value: number) => number
): Promise<Device> {
  // Truthy check (not `=== true`) so consumers parsing config from URL query strings
  // (where the value is the string 'true') get the expected behavior. Warn on values
  // that look intentional but aren't booleans so misconfig is visible.
  const useWebGPURaw = config.useWebGPU as unknown
  const useWebGPU = useWebGPURaw === true || useWebGPURaw === 'true' || useWebGPURaw === 1
  if (useWebGPURaw !== undefined && useWebGPURaw !== false && useWebGPURaw !== true) {
    console.warn(
      `[kajillion] config.useWebGPU should be a boolean; got ${typeof useWebGPURaw}: ${String(useWebGPURaw)}.` +
      ` Interpreted as ${useWebGPU}.`
    )
  }

  try {
    // Dynamic import keeps the WebGPU adapter out of the default WebGL2 bundle.
    const adapters = useWebGPU
      ? [(await import('@luma.gl/webgpu')).webgpuAdapter]
      : [webgl2Adapter]
    return await luma.createDevice({
      type: useWebGPU ? 'webgpu' : 'webgl',
      adapters,
      createCanvasContext: {
        canvas,
        useDevicePixels: sanitizePixelRatio(config.pixelRatio),
        autoResize: true,
        width: undefined,
        height: undefined,
      },
    })
  } catch (e) {
    if (useWebGPU) {
      // Improve the error so users know why a working WebGL2 setup just stopped
      // working after they flipped the flag. `cause` chained manually for
      // compatibility with the project's lib target.
      const wrapped = new Error(
        'kajillion: WebGPU device requested via config.useWebGPU but creation failed. ' +
        'Browser may not support WebGPU (Firefox: enable dom.webgpu.enabled; Safari: ' +
        'requires 26+ on iOS). Set useWebGPU: false to use the WebGL2 path. ' +
        `Underlying error: ${(e as Error).message}`
      )
      ;(wrapped as Error & { cause?: unknown }).cause = e
      throw wrapped
    }
    throw e
  }
}
