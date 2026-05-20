import type { GraphConfigInterface } from '@/graph/config'

type BufferLayoutEntry = {
  name: string;
  format: 'float32x2' | 'float32x4' | 'float32';
  stepMode?: 'instance';
}

export function createLineDrawBufferLayout (): BufferLayoutEntry[] {
  return [
    { name: 'position', format: 'float32x2' },
    { name: 'pointA', format: 'float32x2', stepMode: 'instance' },
    { name: 'pointB', format: 'float32x2', stepMode: 'instance' },
    { name: 'color', format: 'float32x4', stepMode: 'instance' },
    { name: 'width', format: 'float32', stepMode: 'instance' },
    { name: 'arrow', format: 'float32', stepMode: 'instance' },
    { name: 'linkIndices', format: 'float32', stepMode: 'instance' },
  ]
}

export function createCurvePositionBufferLayout (): BufferLayoutEntry[] {
  return [
    { name: 'position', format: 'float32x2' },
  ]
}

export function createQuadBufferLayout (): BufferLayoutEntry[] {
  return [
    { name: 'vertexCoord', format: 'float32x2' },
  ]
}

export function createSampledLinksBufferLayout (): BufferLayoutEntry[] {
  return [
    { name: 'pointA', format: 'float32x2' },
    { name: 'pointB', format: 'float32x2' },
    { name: 'linkIndices', format: 'float32' },
  ]
}

export function createVisibleLinkDrawParameters (config: GraphConfigInterface): Record<string, unknown> {
  return {
    cullMode: 'back',
    blend: true,
    blendColorOperation: 'add',
    blendColorSrcFactor: 'one',
    blendColorDstFactor: config.linkBlendMode === 'add' ? 'one' : 'one-minus-src-alpha',
    blendAlphaOperation: 'add',
    blendAlphaSrcFactor: 'one',
    blendAlphaDstFactor: config.linkBlendMode === 'add' ? 'one' : 'one-minus-src-alpha',
    depthWriteEnabled: false,
    sampleCount: config.msaa,
  }
}

export function createLinkIndexDrawParameters (): Record<string, unknown> {
  return {
    cullMode: 'back',
    blend: false,
    depthWriteEnabled: false,
  }
}
