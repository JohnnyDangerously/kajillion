import { Buffer, type Device } from '@luma.gl/core'

export interface LineDrawAttributeBuffers {
  pointABuffer: Buffer;
  pointBBuffer: Buffer;
  colorBuffer: Buffer;
  widthBuffer: Buffer;
  arrowBuffer: Buffer;
  linkIndexBuffer: Buffer;
}

interface EnsureLineDrawAttributeBuffersOptions {
  device: Device;
  linksNumber: number;
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  widthBuffer: Buffer | undefined;
  arrowBuffer: Buffer | undefined;
  linkIndexBuffer: Buffer | undefined;
}

export function getLineAttributeBufferUsage (device: Device): number {
  const webgpuStorage = device.info?.type === 'webgpu' ? Buffer.STORAGE : 0
  return Buffer.VERTEX | Buffer.COPY_DST | webgpuStorage
}

export function ensureLineDrawAttributeBuffers (
  options: EnsureLineDrawAttributeBuffersOptions
): LineDrawAttributeBuffers {
  const usage = getLineAttributeBufferUsage(options.device)
  return {
    pointABuffer: options.pointABuffer ?? createFloatBuffer(options.device, options.linksNumber * 2, usage),
    pointBBuffer: options.pointBBuffer ?? createFloatBuffer(options.device, options.linksNumber * 2, usage),
    colorBuffer: options.colorBuffer ?? createFloatBuffer(options.device, options.linksNumber * 4, usage),
    widthBuffer: options.widthBuffer ?? createFloatBuffer(options.device, options.linksNumber, usage),
    arrowBuffer: options.arrowBuffer ?? createFloatBuffer(options.device, options.linksNumber, usage),
    linkIndexBuffer: options.linkIndexBuffer ?? createFloatBuffer(options.device, options.linksNumber, usage),
  }
}

export function createLineDrawAttributes (
  curveLineBuffer: Buffer | undefined,
  attributes: LineDrawAttributeBuffers
): Record<string, Buffer> {
  return {
    ...curveLineBuffer && { position: curveLineBuffer },
    pointA: attributes.pointABuffer,
    pointB: attributes.pointBBuffer,
    color: attributes.colorBuffer,
    width: attributes.widthBuffer,
    arrow: attributes.arrowBuffer,
    linkIndices: attributes.linkIndexBuffer,
  }
}

export function createCurvePositionAttributes (curveLineBuffer: Buffer | undefined): Record<string, Buffer> {
  return {
    ...curveLineBuffer && { position: curveLineBuffer },
  }
}

function createFloatBuffer (device: Device, length: number, usage: number): Buffer {
  return device.createBuffer({
    data: new Float32Array(length),
    usage,
  })
}
