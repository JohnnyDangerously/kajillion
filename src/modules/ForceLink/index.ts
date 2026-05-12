import { Buffer, Texture, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import { forceFrag } from '@/graph/modules/ForceLink/force-spring'
import { forceSpringWgsl } from '@/graph/modules/ForceLink/force-spring.wgsl'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

export enum LinkDirection {
  OUTGOING = 'outgoing',
  INCOMING = 'incoming'
}

export class ForceLink extends CoreModule {
  private linkFirstIndicesAndAmount: Float32Array = new Float32Array()
  private indices: Float32Array = new Float32Array()
  private maxPointDegree = 0
  private previousMaxPointDegree: number | undefined
  private previousPointsTextureSize: number | undefined
  private previousLinksTextureSize: number | undefined

  private runCommand: Model | undefined
  private vertexCoordBuffer: Buffer | undefined
  private uniformStore: UniformStore<{
    forceLinkUniforms: {
      linkSpring: number;
      linkDistance: number;
      linkDistRandomVariationRange: [number, number];
      pointsTextureSize: number;
      linksTextureSize: number;
      alpha: number;
    };
  }> | undefined

  private linkFirstIndicesAndAmountTexture: Texture | undefined
  private indicesTexture: Texture | undefined
  private biasAndStrengthTexture: Texture | undefined
  private randomDistanceTexture: Texture | undefined

  public create (direction: LinkDirection): void {
    const { device, store: { pointsTextureSize, linksTextureSize }, data } = this
    if (!pointsTextureSize || !linksTextureSize) return

    this.linkFirstIndicesAndAmount = new Float32Array(pointsTextureSize * pointsTextureSize * 4)
    // Packed per-link bundle (one texture replaces the previous 3 separate
    // textures of indices / bias-strength / random-distance). Layout:
    //   .r = connectedPointIndex % pointsTextureSize  (texel x)
    //   .g = floor(connectedPointIndex / pointsTextureSize)  (texel y)
    //   .b = bias * strength  (pre-multiplied; the shader's per-link force
    //         scales by exactly this product, so combining saves one mul/iter)
    //   .a = randomDist ∈ [0, 1]
    // This collapses 3 textureSampleLevel calls per link iteration into 1
    // (~50% reduction in link-path texture bandwidth) and removes 2 sampler
    // bindings from the pipeline layout.
    const linkBundleState = new Float32Array(linksTextureSize * linksTextureSize * 4)

    const grouped = direction === LinkDirection.INCOMING ? data.sourceIndexToTargetIndices : data.targetIndexToSourceIndices
    this.maxPointDegree = 0
    let linkIndex = 0
    grouped?.forEach((connectedPointIndices, pointIndex) => {
      if (connectedPointIndices) {
        this.linkFirstIndicesAndAmount[pointIndex * 4 + 0] = linkIndex % linksTextureSize
        this.linkFirstIndicesAndAmount[pointIndex * 4 + 1] = Math.floor(linkIndex / linksTextureSize)
        this.linkFirstIndicesAndAmount[pointIndex * 4 + 2] = connectedPointIndices.length ?? 0

        connectedPointIndices.forEach(([connectedPointIndex, initialLinkIndex]) => {
          linkBundleState[linkIndex * 4 + 0] = connectedPointIndex % pointsTextureSize
          linkBundleState[linkIndex * 4 + 1] = Math.floor(connectedPointIndex / pointsTextureSize)
          const degree = data.degree?.[connectedPointIndex] ?? 0
          const connectedDegree = data.degree?.[pointIndex] ?? 0
          const degreeSum = degree + connectedDegree
          const bias = degreeSum !== 0 ? degree / degreeSum : 0.5
          const minDegree = Math.min(degree, connectedDegree)
          let strength = data.linkStrength?.[initialLinkIndex] ?? (1 / Math.max(minDegree, 1))
          strength = Math.sqrt(strength)
          linkBundleState[linkIndex * 4 + 2] = bias * strength
          linkBundleState[linkIndex * 4 + 3] = this.store.getRandomFloat(0, 1)

          linkIndex += 1
        })

        this.maxPointDegree = Math.max(this.maxPointDegree, connectedPointIndices.length ?? 0)
      }
    })
    // Keep `indices` populated for any external code reading it (legacy
    // shape). Allocate a thin alias backed by the same bundle data isn't
    // safe — just reuse the packed bundle's xy as the public `indices`.
    this.indices = linkBundleState

    // Recreate textures if sizes changed
    const recreatePointTextures =
      !this.linkFirstIndicesAndAmountTexture ||
      this.linkFirstIndicesAndAmountTexture.width !== pointsTextureSize ||
      this.linkFirstIndicesAndAmountTexture.height !== pointsTextureSize

    const recreateLinkTextures =
      !this.indicesTexture ||
      this.indicesTexture.width !== linksTextureSize ||
      this.indicesTexture.height !== linksTextureSize

    if (recreatePointTextures) {
      if (this.linkFirstIndicesAndAmountTexture && !this.linkFirstIndicesAndAmountTexture.destroyed) {
        this.linkFirstIndicesAndAmountTexture.destroy()
      }
      this.linkFirstIndicesAndAmountTexture = device.createTexture({
        width: pointsTextureSize,
        height: pointsTextureSize,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.COPY_DST,
      })
    }
    this.linkFirstIndicesAndAmountTexture!.copyImageData({
      data: this.linkFirstIndicesAndAmount,
      bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
      mipLevel: 0,
      x: 0,
      y: 0,
    })

    if (recreateLinkTextures) {
      if (this.indicesTexture && !this.indicesTexture.destroyed) this.indicesTexture.destroy()
      if (this.biasAndStrengthTexture && !this.biasAndStrengthTexture.destroyed) this.biasAndStrengthTexture.destroy()
      if (this.randomDistanceTexture && !this.randomDistanceTexture.destroyed) this.randomDistanceTexture.destroy()

      // Single packed bundle replaces three textures. We keep the field
      // names on the class so destroy() etc. still references them — but
      // only allocate `indicesTexture` and alias the others as the same
      // GPU resource for binding the previously-3-binding shader sites.
      this.indicesTexture = device.createTexture({
        width: linksTextureSize,
        height: linksTextureSize,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.COPY_DST,
      })
      this.biasAndStrengthTexture = this.indicesTexture
      this.randomDistanceTexture = this.indicesTexture
    }

    this.indicesTexture!.copyImageData({
      data: linkBundleState,
      bytesPerRow: getBytesPerRow('rgba32float', linksTextureSize),
      mipLevel: 0,
      x: 0,
      y: 0,
    })

    // Force shader rebuild if degree changed
    if (this.previousMaxPointDegree !== undefined && this.previousMaxPointDegree !== this.maxPointDegree) {
      this.runCommand?.destroy()
      this.runCommand = undefined
    }

    this.previousMaxPointDegree = this.maxPointDegree
    this.previousPointsTextureSize = pointsTextureSize
    this.previousLinksTextureSize = linksTextureSize
  }

  public initPrograms (): void {
    const { device, store, points } = this
    if (!points || !store.pointsTextureSize || !store.linksTextureSize) return
    if (!this.linkFirstIndicesAndAmountTexture || !this.indicesTexture || !this.biasAndStrengthTexture || !this.randomDistanceTexture) return

    this.vertexCoordBuffer ||= device.createBuffer({
      data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    })

    this.uniformStore ||= new UniformStore({
      forceLinkUniforms: {
        uniformTypes: {
          linkSpring: 'f32',
          linkDistance: 'f32',
          linkDistRandomVariationRange: 'vec2<f32>',
          pointsTextureSize: 'f32',
          linksTextureSize: 'f32',
          alpha: 'f32',
        },
      },
    })

    this.runCommand ||= new Model(device, {
      source: forceSpringWgsl(this.maxPointDegree),
      fs: forceFrag(this.maxPointDegree),
      vs: updateVert,
      topology: 'triangle-strip',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: 4,
      attributes: {
        vertexCoord: this.vertexCoordBuffer,
      },
      bufferLayout: [
        { name: 'vertexCoord', format: 'float32x2' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        // Create uniform buffer binding
        // Update it later by calling uniformStore.setUniforms()
        forceLinkUniforms: this.uniformStore.getManagedUniformBuffer(device, 'forceLinkUniforms'),
        // All texture bindings will be set dynamically in run() method
      },
      parameters: {
        depthWriteEnabled: false,
      },
    })
  }

  public run (): void {
    const { device, store, points } = this
    if (!points) return
    if (!this.runCommand || !this.uniformStore) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!this.linkFirstIndicesAndAmountTexture || !this.indicesTexture || !this.biasAndStrengthTexture || !this.randomDistanceTexture) return
    if (!points.velocityFbo || points.velocityFbo.destroyed) return

    // Skip if sizes changed and create() wasn't called again
    if (
      store.pointsTextureSize !== this.previousPointsTextureSize ||
      store.linksTextureSize !== this.previousLinksTextureSize
    ) {
      return
    }

    this.uniformStore.setUniforms({
      forceLinkUniforms: {
        linkSpring: this.config.simulationLinkSpring,
        linkDistance: this.config.simulationLinkDistance,
        linkDistRandomVariationRange: ensureVec2(this.config.simulationLinkDistRandomVariationRange, [0, 0]),
        pointsTextureSize: store.pointsTextureSize,
        linksTextureSize: store.linksTextureSize,
        alpha: store.alpha,
      },
    })

    this.runCommand.setBindings({
      positionsTexture: points.previousPositionTexture,
      linkInfoTexture: this.linkFirstIndicesAndAmountTexture,
      linkBundleTexture: this.indicesTexture,
    })

    const pass = device.beginRenderPass({
      framebuffer: points.velocityFbo,
      clearColor: [0, 0, 0, 0],
    })
    this.runCommand.draw(pass)
    pass.end()
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
    this.runCommand?.destroy()
    this.runCommand = undefined

    // 2. Destroy Framebuffers (before textures they reference)
    // ForceLink has no framebuffers

    // 3. Destroy Textures. After the link-bundle packing landed,
    // biasAndStrengthTexture and randomDistanceTexture alias the same
    // GPU resource as indicesTexture. Destroy once via indicesTexture
    // and null the aliases to avoid a double-free.
    if (this.linkFirstIndicesAndAmountTexture && !this.linkFirstIndicesAndAmountTexture.destroyed) {
      this.linkFirstIndicesAndAmountTexture.destroy()
    }
    this.linkFirstIndicesAndAmountTexture = undefined
    if (this.indicesTexture && !this.indicesTexture.destroyed) {
      this.indicesTexture.destroy()
    }
    this.indicesTexture = undefined
    this.biasAndStrengthTexture = undefined
    this.randomDistanceTexture = undefined

    // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
    this.uniformStore?.destroy()
    this.uniformStore = undefined

    // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
    if (this.vertexCoordBuffer && !this.vertexCoordBuffer.destroyed) {
      this.vertexCoordBuffer.destroy()
    }
    this.vertexCoordBuffer = undefined
  }
}
