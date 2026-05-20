import { Buffer, Texture } from '@luma.gl/core'
import type { Framebuffer, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import { createIndexesForBuffer } from '@/graph/modules/Shared/buffer'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import type {
  CalculateCentermassUniformStoreShape,
  ForceCenterUniformStoreShape,
} from './contracts'
import {
  createCalculateCentermassCommand,
  createForceCenterCommand,
} from './pass-setup'
import {
  applyForceCenterPass,
  calculateCentermassPass,
} from './run'
import {
  createCalculateCentermassUniformStore,
  createForceCenterUniformStore,
} from './uniforms'

export class ForceCenter extends CoreModule {
  private centermassTexture: Texture | undefined
  private centermassFbo: Framebuffer | undefined
  private pointIndices: Buffer | undefined

  private calculateCentermassCommand: Model | undefined
  private runCommand: Model | undefined

  private forceVertexCoordBuffer: Buffer | undefined

  private calculateUniformStore: UniformStore<CalculateCentermassUniformStoreShape> | undefined

  private forceUniformStore: UniformStore<ForceCenterUniformStoreShape> | undefined

  private previousPointsTextureSize: number | undefined

  public create (): void {
    const { device, store } = this
    const { pointsTextureSize } = store
    if (!pointsTextureSize) return

    this.centermassTexture ||= device.createTexture({
      width: 1,
      height: 1,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
    })
    this.centermassTexture.copyImageData({
      data: new Float32Array(4).fill(0),
      bytesPerRow: getBytesPerRow('rgba32float', 1),
      mipLevel: 0,
      x: 0,
      y: 0,
    })

    this.centermassFbo ||= device.createFramebuffer({
      width: 1,
      height: 1,
      colorAttachments: [this.centermassTexture],
    })

    // Update pointIndices buffer if pointsTextureSize changed
    if (!this.pointIndices || this.previousPointsTextureSize !== store.pointsTextureSize) {
      if (this.pointIndices && !this.pointIndices.destroyed) {
        this.pointIndices.destroy()
      }
      const indexData = createIndexesForBuffer(store.pointsTextureSize)
      this.pointIndices = device.createBuffer({
        data: indexData,
        usage: Buffer.VERTEX | Buffer.COPY_DST,
      })
      this.calculateCentermassCommand?.setAttributes({
        pointIndices: this.pointIndices,
      })
    }

    this.previousPointsTextureSize = pointsTextureSize
  }

  public initPrograms (): void {
    const { device, store, points } = this
    if (!points || !store.pointsTextureSize) return
    if (!this.centermassFbo || this.centermassFbo.destroyed || !this.centermassTexture || this.centermassTexture.destroyed) return

    this.forceVertexCoordBuffer ||= device.createBuffer({
      data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    })

    this.calculateUniformStore ||= createCalculateCentermassUniformStore()

    this.forceUniformStore ||= createForceCenterUniformStore()

    this.calculateCentermassCommand ||= createCalculateCentermassCommand({
      device,
      pointIndices: this.pointIndices,
      uniformStore: this.calculateUniformStore,
    })
    this.calculateCentermassCommand.setVertexCount(this.data.pointsNumber ?? 0)

    this.runCommand ||= createForceCenterCommand({
      device,
      vertexCoordBuffer: this.forceVertexCoordBuffer,
      uniformStore: this.forceUniformStore,
    })
  }

  public run (): void {
    const { device, store, points } = this
    if (!points) return
    if (!this.calculateCentermassCommand || !this.calculateUniformStore || !this.runCommand || !this.forceUniformStore) return
    if (!this.centermassFbo || !this.centermassTexture) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!points.velocityFbo || points.velocityFbo.destroyed) return

    // Skip if sizes changed and create() wasn't called yet
    if (store.pointsTextureSize !== this.previousPointsTextureSize) return

    // Ensure pointIndices is set (Model might exist but attributes not set yet)
    if (!this.pointIndices) return

    calculateCentermassPass({
      device,
      framebuffer: this.centermassFbo,
      pointsTextureSize: store.pointsTextureSize ?? 0,
      positionsTexture: points.previousPositionTexture,
      uniformStore: this.calculateUniformStore,
      command: this.calculateCentermassCommand,
    })

    applyForceCenterPass({
      device,
      framebuffer: points.velocityFbo,
      positionsTexture: points.previousPositionTexture,
      centermassTexture: this.centermassTexture,
      centerForce: this.config.simulationCenter,
      alpha: store.alpha,
      uniformStore: this.forceUniformStore,
      command: this.runCommand,
    })
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
    this.calculateCentermassCommand?.destroy()
    this.calculateCentermassCommand = undefined
    this.runCommand?.destroy()
    this.runCommand = undefined

    // 2. Destroy Framebuffers (before textures they reference)
    if (this.centermassFbo && !this.centermassFbo.destroyed) {
      this.centermassFbo.destroy()
    }
    this.centermassFbo = undefined

    // 3. Destroy Textures
    if (this.centermassTexture && !this.centermassTexture.destroyed) {
      this.centermassTexture.destroy()
    }
    this.centermassTexture = undefined

    // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
    this.calculateUniformStore?.destroy()
    this.calculateUniformStore = undefined
    this.forceUniformStore?.destroy()
    this.forceUniformStore = undefined

    // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
    if (this.pointIndices && !this.pointIndices.destroyed) {
      this.pointIndices.destroy()
    }
    this.pointIndices = undefined
    if (this.forceVertexCoordBuffer && !this.forceVertexCoordBuffer.destroyed) {
      this.forceVertexCoordBuffer.destroy()
    }
    this.forceVertexCoordBuffer = undefined

    this.previousPointsTextureSize = undefined
  }
}
