import type { Buffer, Device, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config'
import { conicParametricCurveModule } from '@/graph/modules/Lines/conic-curve-module'
import { drawCulledCurveLinesWgsl } from '@/graph/modules/Lines/draw-culled-curve-lines.wgsl'
import { drawCurveLineInstancedWgslSource } from '@/graph/modules/Lines/draw-curve-line-instanced.wgsl'
import { drawCurveLineWgslSource } from '@/graph/modules/Lines/draw-curve-line.wgsl'
import drawLineFrag from '@/graph/modules/Lines/draw-curve-line.frag?raw'
import drawLineVert from '@/graph/modules/Lines/draw-curve-line.vert?raw'
import { drawStraightLineWgslSource } from '@/graph/modules/Lines/draw-straight-line.wgsl'
import type { LineDrawUniformStoreShape } from './contracts'
import {
  createCurvePositionBufferLayout,
  createLineDrawBufferLayout,
  createLinkIndexDrawParameters,
  createVisibleLinkDrawParameters,
} from './model-options'
import {
  createCurvePositionAttributes,
  createLineDrawAttributes,
  ensureLineDrawAttributeBuffers,
} from './program-attributes'
import type { LineDrawAttributeBuffers } from './program-attributes'

export { getLineAttributeBufferUsage } from './program-attributes'
export type { LineDrawAttributeBuffers } from './program-attributes'

export interface LineDrawProgramState extends LineDrawAttributeBuffers {
  drawCurveCommand: Model | undefined;
  drawCurveInstancedCommand: Model | undefined;
  drawCulledCurveCommand: Model | undefined;
  drawCurveIndexCommand: Model | undefined;
}

interface EnsureLineDrawProgramsOptions {
  device: Device;
  config: GraphConfigInterface;
  linksNumber: number;
  curveLineGeometry: number[][] | undefined;
  curveLineBuffer: Buffer | undefined;
  uniformStore: UniformStore<LineDrawUniformStoreShape>;
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  widthBuffer: Buffer | undefined;
  arrowBuffer: Buffer | undefined;
  linkIndexBuffer: Buffer | undefined;
  drawCurveCommand: Model | undefined;
  drawCurveInstancedCommand: Model | undefined;
  drawCulledCurveCommand: Model | undefined;
  drawCurveIndexCommand: Model | undefined;
  getLineInstanceBuffer: (linksNumber: number) => Buffer;
}

export function ensureLineDrawPrograms (options: EnsureLineDrawProgramsOptions): LineDrawProgramState {
  const {
    device,
    config,
    linksNumber,
    curveLineGeometry,
    curveLineBuffer,
    uniformStore,
    getLineInstanceBuffer,
  } = options
  const attributes = ensureLineDrawAttributeBuffers(options)
  const lineWgsl = config.curvedLinks ? drawCurveLineWgslSource() : drawStraightLineWgslSource()
  const lineModules = config.curvedLinks ? [conicParametricCurveModule] : []
  const uniformBindings = {
    drawLineUniforms: uniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
    drawLineFragmentUniforms: uniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
  }

  const drawCurveCommand = options.drawCurveCommand ?? new Model(device, {
    source: lineWgsl,
    vs: drawLineVert,
    fs: drawLineFrag,
    modules: lineModules,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['bgra8unorm'],
    vertexCount: curveLineGeometry?.length ?? 0,
    attributes: createLineDrawAttributes(curveLineBuffer, attributes),
    bufferLayout: createLineDrawBufferLayout(),
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: uniformBindings,
    parameters: createVisibleLinkDrawParameters(config),
  })

  let drawCurveInstancedCommand = options.drawCurveInstancedCommand
  if (device.info?.type === 'webgpu' && config.curvedLinks) {
    const lineInstanceBuffer = getLineInstanceBuffer(linksNumber)
    drawCurveInstancedCommand ||= new Model(device, {
      source: drawCurveLineInstancedWgslSource(),
      topology: 'triangle-strip',
      colorAttachmentFormats: ['bgra8unorm'],
      vertexCount: curveLineGeometry?.length ?? 0,
      attributes: createCurvePositionAttributes(curveLineBuffer),
      bufferLayout: createCurvePositionBufferLayout(),
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        ...uniformBindings,
        instances: lineInstanceBuffer,
      },
      parameters: createVisibleLinkDrawParameters(config),
    })
  }

  let drawCulledCurveCommand = options.drawCulledCurveCommand
  if (device.info?.type === 'webgpu') {
    drawCulledCurveCommand ||= new Model(device, {
      source: drawCulledCurveLinesWgsl(),
      topology: 'triangle-strip',
      colorAttachmentFormats: ['bgra8unorm'],
      vertexCount: curveLineGeometry?.length ?? 0,
      instanceCount: 0,
      attributes: createCurvePositionAttributes(curveLineBuffer),
      bufferLayout: createCurvePositionBufferLayout(),
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: uniformBindings,
      parameters: createVisibleLinkDrawParameters(config),
    })
  }

  const drawCurveIndexCommand = options.drawCurveIndexCommand ?? new Model(device, {
    vs: drawLineVert,
    source: lineWgsl,
    fs: drawLineFrag,
    modules: lineModules,
    topology: 'triangle-strip',
    colorAttachmentFormats: ['rgba32float'],
    vertexCount: curveLineGeometry?.length ?? 0,
    attributes: createLineDrawAttributes(curveLineBuffer, attributes),
    bufferLayout: createLineDrawBufferLayout(),
    defines: {
      USE_UNIFORM_BUFFERS: true,
    },
    bindings: uniformBindings,
    parameters: createLinkIndexDrawParameters(),
  })

  return {
    ...attributes,
    drawCurveCommand,
    drawCurveInstancedCommand,
    drawCulledCurveCommand,
    drawCurveIndexCommand,
  }
}
