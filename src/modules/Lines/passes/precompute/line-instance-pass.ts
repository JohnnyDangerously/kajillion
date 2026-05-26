import { Buffer, UniformStore, type ComputePipeline, type Device, type RenderPass, type Shader } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config/schema'
import type { CorePointsRef } from '@/graph/modules/core-module'
import type { GraphData } from '@/graph/modules/GraphData'
import { precomputeLineInstancesWgsl } from '@/graph/modules/Lines/precompute-line-instances.compute.wgsl'
import { LINE_INSTANCE_BYTE_LENGTH } from '@/graph/modules/Lines/passes/shared/constants'
import type { LineDrawUniformStoreShape } from '@/graph/modules/Lines/passes/draw/contracts'
import {
  PRECOMPUTE_LINE_INSTANCES_BINDINGS,
  PRECOMPUTE_LINE_INSTANCES_UNIFORM_TYPES,
  type PrecomputeLineInstancesUniformStoreShape,
} from '@/graph/modules/Lines/passes/precompute/contracts'

export interface LineInstancePrecomputeHost {
  readonly device: Device;
  readonly config: GraphConfigInterface;
  readonly data: GraphData;
  readonly points: CorePointsRef | undefined;
}

export class LineInstancePrecomputePass {
  private lineInstanceBuffer: Buffer | undefined
  private lineInstanceCapacity = 0
  private preparedLinkCount = 0
  private shader: Shader | undefined
  private pipeline: ComputePipeline | undefined
  private uniformStore: UniformStore<PrecomputeLineInstancesUniformStoreShape> | undefined
  private uniformBuffer: Buffer | undefined

  public constructor (private readonly host: LineInstancePrecomputeHost) {}

  public getOrCreateLineInstanceBuffer (linkCount: number, model?: Model): Buffer {
    const capacity = Math.max(1, linkCount)
    if (
      this.lineInstanceBuffer &&
      !this.lineInstanceBuffer.destroyed &&
      this.lineInstanceCapacity === capacity
    ) {
      return this.lineInstanceBuffer
    }

    if (this.lineInstanceBuffer && !this.lineInstanceBuffer.destroyed) {
      this.lineInstanceBuffer.destroy()
    }
    this.lineInstanceCapacity = capacity
    this.lineInstanceBuffer = this.host.device.createBuffer({
      byteLength: capacity * LINE_INSTANCE_BYTE_LENGTH,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    })
    model?.setBindings({
      instances: this.lineInstanceBuffer,
    })
    return this.lineInstanceBuffer
  }

  public resetPrepared (): void {
    this.preparedLinkCount = 0
  }

  public prepare (
    model: Model | undefined,
    drawLineUniformStore: UniformStore<LineDrawUniformStoreShape> | undefined,
    hasHighlighting: boolean,
    pointABuffer: Buffer | undefined,
    pointBBuffer: Buffer | undefined,
    colorBuffer: Buffer | undefined,
    widthBuffer: Buffer | undefined,
    arrowBuffer: Buffer | undefined,
    linkIndexBuffer: Buffer | undefined
  ): boolean {
    this.resetPrepared()
    const { config, data, device, points } = this.host
    const linkCount = data.linksNumber ?? 0
    if (device.info?.type !== 'webgpu') return false
    if (!config.curvedLinks || hasHighlighting) return false
    if (!linkCount || (points?.renderPositionMix ?? 1) < 0.999) return false
    if (!model || !drawLineUniformStore) return false
    if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return false
    if (!pointABuffer || pointABuffer.destroyed) return false
    if (!pointBBuffer || pointBBuffer.destroyed) return false
    if (!colorBuffer || colorBuffer.destroyed) return false
    if (!widthBuffer || widthBuffer.destroyed) return false
    if (!arrowBuffer || arrowBuffer.destroyed) return false
    if (!linkIndexBuffer || linkIndexBuffer.destroyed) return false

    const lineInstanceBuffer = this.getOrCreateLineInstanceBuffer(linkCount, model)
    this.initPipeline()
    if (!this.pipeline || !this.uniformStore || !this.uniformBuffer) return false

    this.uniformStore.setUniforms({
      precomputeLine: {
        linkCount,
      },
    })
    this.pipeline.setBindings({
      drawLine: drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
      precomputeLine: this.uniformBuffer,
      positions: points.positionStorageBuffer,
      pointAArr: pointABuffer,
      pointBArr: pointBBuffer,
      colorArr: colorBuffer,
      widthArr: widthBuffer,
      arrowArr: arrowBuffer,
      linkIndexArr: linkIndexBuffer,
      instances: lineInstanceBuffer,
    })

    const pass = device.beginComputePass({ id: 'lines.instances.precompute' })
    pass.setPipeline(this.pipeline)
    pass.dispatch(Math.ceil(linkCount / 64), 1, 1)
    pass.end()

    model.setBindings({
      drawLineUniforms: drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
      drawLineFragmentUniforms: drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
      instances: lineInstanceBuffer,
    })
    this.preparedLinkCount = linkCount
    return true
  }

  public drawPrepared (renderPass: RenderPass, model: Model | undefined): boolean {
    const linkCount = this.host.data.linksNumber ?? 0
    if (!model || this.preparedLinkCount !== linkCount || linkCount === 0) return false
    model.setInstanceCount(linkCount)
    model.draw(renderPass)
    return true
  }

  public destroy (): void {
    if (this.lineInstanceBuffer && !this.lineInstanceBuffer.destroyed) {
      this.lineInstanceBuffer.destroy()
    }
    this.lineInstanceBuffer = undefined
    this.lineInstanceCapacity = 0
    this.preparedLinkCount = 0
    this.pipeline?.destroy()
    this.pipeline = undefined
    this.shader?.destroy()
    this.shader = undefined
    this.uniformStore?.destroy()
    this.uniformStore = undefined
    this.uniformBuffer = undefined
  }

  private initPipeline (): void {
    const { device, data } = this.host
    if (device.info?.type !== 'webgpu') return

    this.uniformStore ||= new UniformStore({
      precomputeLine: {
        uniformTypes: PRECOMPUTE_LINE_INSTANCES_UNIFORM_TYPES,
        defaultUniforms: {
          linkCount: data.linksNumber ?? 0,
        },
      },
    })
    this.uniformBuffer ||= this.uniformStore.getManagedUniformBuffer(device, 'precomputeLine')
    this.shader ||= device.createShader({
      stage: 'compute',
      source: precomputeLineInstancesWgsl(),
    })
    this.pipeline ||= device.createComputePipeline({
      shader: this.shader,
      entryPoint: 'computeMain',
      shaderLayout: {
        bindings: PRECOMPUTE_LINE_INSTANCES_BINDINGS,
      },
    })
  }
}
