import { Framebuffer, UniformStore, type Buffer, type Device, type Texture } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import { readPixels } from '@/graph/helper'
import { conicParametricCurveModule } from '@/graph/modules/Lines/conic-curve-module'
import fillGridWithSampledLinksFrag from '@/graph/modules/Lines/fill-sampled-links.frag?raw'
import fillGridWithSampledLinksVert from '@/graph/modules/Lines/fill-sampled-links.vert?raw'
import fillGridWithSampledLinksWgsl from '@/graph/modules/Lines/fill-sampled-links.wgsl?raw'
import { createSampledLinksBufferLayout } from '@/graph/modules/Lines/passes/draw/model-options'
import {
  FILL_SAMPLED_LINKS_UNIFORM_TYPES,
  type FillSampledLinksUniforms,
  type FillSampledLinksUniformStoreShape,
} from '@/graph/modules/Lines/passes/sampling/contracts'
import {
  decodeSampledLinkPixels,
  renderSampledLinksGrid as renderSampledLinksGridPass,
  type SampledLinkRecord,
} from '@/graph/modules/Lines/passes/sampling/read-sampled-links'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { defaultConfigValues } from '@/graph/variables'

export type SampledLinksAttributes = {
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  linkIndexBuffer: Buffer | undefined;
}

export type EnsureSampledLinksFramebufferOptions = {
  device: Device;
  framebuffer: Framebuffer | undefined;
  screenSize: [number, number];
  linkSamplingDistance: number | undefined;
}

export function createSampledLinksUniformStore (
  store: Store,
  config: GraphConfigInterface
): UniformStore<FillSampledLinksUniformStoreShape> {
  return new UniformStore({
    fillSampledLinksUniforms: {
      uniformTypes: FILL_SAMPLED_LINKS_UNIFORM_TYPES,
      defaultUniforms: createSampledLinksUniforms(
        store,
        config,
        config.curvedLinks ? config.curvedLinkSegments : 1
      ),
    },
  })
}

export function createSampledLinksCommand ({
  device,
  uniformStore,
  attributes,
  linksNumber,
}: {
  device: Device;
  uniformStore: UniformStore<FillSampledLinksUniformStoreShape>;
  attributes: SampledLinksAttributes;
  linksNumber: number;
}): Model {
  return new Model(device, {
    source: fillGridWithSampledLinksWgsl,
    fs: fillGridWithSampledLinksFrag,
    vs: fillGridWithSampledLinksVert,
    modules: [conicParametricCurveModule],
    topology: 'point-list',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: linksNumber,
    attributes: createSampledLinksAttributes(attributes),
    bufferLayout: createSampledLinksBufferLayout(),
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: {
      fillSampledLinksUniforms: uniformStore.getManagedUniformBuffer(device, 'fillSampledLinksUniforms'),
    },
    parameters: {
      depthWriteEnabled: false,
      blend: false,
    },
  })
}

export function createSampledLinksAttributes ({
  pointABuffer,
  pointBBuffer,
  linkIndexBuffer,
}: SampledLinksAttributes): Record<string, Buffer> {
  return {
    ...(pointABuffer && { pointA: pointABuffer }),
    ...(pointBBuffer && { pointB: pointBBuffer }),
    ...(linkIndexBuffer && { linkIndices: linkIndexBuffer }),
  }
}

export function ensureSampledLinksFramebuffer ({
  device,
  framebuffer,
  screenSize,
  linkSamplingDistance,
}: EnsureSampledLinksFramebufferOptions): Framebuffer | undefined {
  let dist = linkSamplingDistance ?? Math.min(...screenSize) / 2
  if (dist === 0) dist = defaultConfigValues.linkSamplingDistance
  const width = Math.ceil(screenSize[0] / dist)
  const height = Math.ceil(screenSize[1] / dist)
  if (width === 0 || height === 0) return framebuffer

  if (framebuffer && framebuffer.width === width && framebuffer.height === height) {
    return framebuffer
  }

  if (framebuffer && !framebuffer.destroyed) {
    framebuffer.destroy()
  }
  return device.createFramebuffer({
    width,
    height,
    colorAttachments: ['rgba32float'],
  })
}

export function createSampledLinksUniforms (
  store: Store,
  config: GraphConfigInterface,
  effectiveLineSegments: number
): FillSampledLinksUniforms {
  return {
    pointsTextureSize: store.pointsTextureSize ?? 0,
    transformationMatrix: store.transformationMatrix4x4,
    spaceSize: store.adjustedSpaceSize,
    screenSize: ensureVec2(store.screenSize, [0, 0]),
    curvedWeight: config.curvedLinkWeight,
    curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
    curvedLinkSegments: effectiveLineSegments,
  }
}

export function renderSampledLinksGrid ({
  device,
  framebuffer,
  command,
  uniformStore,
  positionsTexture,
  linksNumber,
  uniforms,
}: {
  device: Device;
  framebuffer: Framebuffer;
  command: Model | undefined;
  uniformStore: UniformStore<FillSampledLinksUniformStoreShape> | undefined;
  positionsTexture: Texture;
  linksNumber: number;
  uniforms: FillSampledLinksUniforms;
}): void {
  renderSampledLinksGridPass({
    device,
    framebuffer,
    command,
    uniformStore,
    positionsTexture,
    linksNumber,
    uniforms,
  })
}

export function readSampledLinkRecords (device: Device, framebuffer: Framebuffer): SampledLinkRecord[] {
  return decodeSampledLinkPixels(readPixels(device, framebuffer))
}
