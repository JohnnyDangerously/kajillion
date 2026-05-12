import { Buffer, ComputePipeline, Shader, Texture, UniformStore } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import { forceFrag } from '@/graph/modules/ForceLink/force-spring'
import { forceSpringComputeWgsl } from '@/graph/modules/ForceLink/force-spring.compute.wgsl'
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
  // WebGPU compute path: replaces the fragment-shader runCommand on WebGPU.
  // One thread per point in an 8×8 workgroup, dispatched as ceil(N/8)² over
  // the points texture. The compute shader writes directly into
  // `points.velocityTexture` via a write-only storage-texture view — no
  // rasterizer, no fragment shader, no FBO setup per pass.
  private runComputeShader: Shader | undefined
  private runComputePipeline: ComputePipeline | undefined
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

  private uniformBuffer: Buffer | undefined

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

    // Force shader rebuild if degree changed — MAX_LINKS is baked into the
    // WGSL source via maxPointDegree, so both the fragment Model and the
    // compute pipeline + shader must be recompiled.
    if (this.previousMaxPointDegree !== undefined && this.previousMaxPointDegree !== this.maxPointDegree) {
      this.runCommand?.destroy()
      this.runCommand = undefined
      this.runComputePipeline?.destroy()
      this.runComputePipeline = undefined
      this.runComputeShader?.destroy()
      this.runComputeShader = undefined
    }

    this.previousMaxPointDegree = this.maxPointDegree
    this.previousPointsTextureSize = pointsTextureSize
    this.previousLinksTextureSize = linksTextureSize
  }

  public initPrograms (): void {
    const { device, store, points } = this
    if (!points || !store.pointsTextureSize || !store.linksTextureSize) return
    if (!this.linkFirstIndicesAndAmountTexture || !this.indicesTexture || !this.biasAndStrengthTexture || !this.randomDistanceTexture) return

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

    // Single managed uniform buffer shared by both paths. setUniforms()
    // writes to this buffer via the UniformStore's internal byte-packing —
    // the same write services either the fragment Model or the compute
    // pipeline depending on which is active.
    this.uniformBuffer ||= this.uniformStore.getManagedUniformBuffer(device, 'forceLinkUniforms')

    const isWebGPU = device.info?.type === 'webgpu'

    if (isWebGPU) {
      this.initComputePipeline()
    } else {
      this.initFragmentModel()
    }
  }

  public run (): void {
    const { store, points } = this
    if (!points) return
    if (!this.uniformStore) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!this.linkFirstIndicesAndAmountTexture || !this.indicesTexture || !this.biasAndStrengthTexture || !this.randomDistanceTexture) return

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

    if (this.runComputePipeline) {
      this.runCompute()
    } else if (this.runCommand) {
      this.runFragment()
    }
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    // 1. Destroy Models / ComputePipelines FIRST (they destroy _gpuGeometry
    // if exists, and _uniformStore). Compute pipeline is destroyed via the
    // device's resource tracker; the underlying GPUComputePipeline is GC'd
    // by Dawn once no command buffer references it.
    this.runCommand?.destroy()
    this.runCommand = undefined
    this.runComputePipeline?.destroy()
    this.runComputePipeline = undefined
    this.runComputeShader?.destroy()
    this.runComputeShader = undefined

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

    // 4. Destroy UniformStores. The managed uniform buffer lives inside the
    // UniformStore — destroying the store releases it. On the compute path
    // the Model never owned it, so there's no double-free risk.
    this.uniformBuffer = undefined
    this.uniformStore?.destroy()
    this.uniformStore = undefined

    // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
    if (this.vertexCoordBuffer && !this.vertexCoordBuffer.destroyed) {
      this.vertexCoordBuffer.destroy()
    }
    this.vertexCoordBuffer = undefined
  }

  private initFragmentModel (): void {
    const { device } = this
    this.vertexCoordBuffer ||= device.createBuffer({
      data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
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
        forceLinkUniforms: this.uniformBuffer!,
        // All texture bindings will be set dynamically in run() method
      },
      parameters: {
        depthWriteEnabled: false,
      },
    })
  }

  private initComputePipeline (): void {
    const { device } = this
    if (this.runComputePipeline) return

    // Compile the compute shader (kind: 'compute' so luma.gl puts COMPUTE
    // visibility on the auto-derived bind group layout). The source bakes
    // MAX_LINKS via maxPointDegree, so we must recompile whenever
    // maxPointDegree changes — handled in create() by destroying both the
    // pipeline and the shader.
    this.runComputeShader = device.createShader({
      stage: 'compute',
      source: forceSpringComputeWgsl(this.maxPointDegree),
    })

    // Hand-rolled shader layout. luma.gl 9.2.6's `getShaderLayoutFromWGSL`
    // only walks vertex entry points; compute entries and storage-texture
    // bindings are not extracted, so the compute pipeline can't auto-derive
    // a layout that maps binding names to locations. The actual
    // GPUBindGroupLayout is still auto-derived from the WGSL via
    // `layout: 'auto'` inside WebGPUComputePipeline — this object only tells
    // luma.gl's `getBindGroupEntries()` which @binding(N) each name maps to.
    this.runComputePipeline = device.createComputePipeline({
      shader: this.runComputeShader,
      entryPoint: 'computeMain',
      shaderLayout: {
        bindings: [
          { type: 'uniform', name: 'forceLinkUniforms', group: 0, location: 0 },
          { type: 'texture', name: 'positionsTexture', group: 0, location: 1 },
          { type: 'texture', name: 'linkInfoTexture', group: 0, location: 2 },
          { type: 'texture', name: 'linkBundleTexture', group: 0, location: 3 },
          // Storage texture for write-only velocity output. luma's
          // BindingDeclaration union shares 'storage' across read/write
          // storage buffers and storage textures — `getBindGroupEntries()`
          // only reads `.location` here so the discriminator doesn't matter.
          { type: 'storage', name: 'velocityOut', group: 0, location: 4 },
        ],
      },
    })
  }

  private runFragment (): void {
    const { device, points } = this
    if (!this.runCommand) return
    if (!points?.velocityFbo || points.velocityFbo.destroyed) return
    if (!points.previousPositionTexture || this.linkFirstIndicesAndAmountTexture === undefined || this.indicesTexture === undefined) return

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

  private runCompute (): void {
    const { device, store, points } = this
    if (!this.runComputePipeline || !this.uniformBuffer) return
    if (!points?.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!points?.velocityTexture || points.velocityTexture.destroyed) return
    if (!this.linkFirstIndicesAndAmountTexture || !this.indicesTexture) return

    // Bind the four read inputs + the write-only velocity storage texture.
    // The bind group is rebuilt on each call by the auto-cache inside
    // WebGPUComputePipeline; on WebGPU we patched the analogous bind-group
    // cache for render pipelines (see patches/) but the compute path keeps
    // luma's single-slot cache. That's fine here: ForceLink's bindings only
    // change on size-change (handled by destroying the pipeline) and on
    // direction swap (incoming/outgoing share textures), so a single-slot
    // cache hits every frame after the first.
    this.runComputePipeline.setBindings({
      forceLinkUniforms: this.uniformBuffer,
      positionsTexture: points.previousPositionTexture,
      linkInfoTexture: this.linkFirstIndicesAndAmountTexture,
      linkBundleTexture: this.indicesTexture,
      velocityOut: points.velocityTexture,
    })

    const size = store.pointsTextureSize ?? 0
    if (size === 0) return
    // Workgroup is 8×8. ceil-divide so the trailing strip of texels for
    // non-multiple-of-8 sizes is covered; the shader's `gid >= pointsSize`
    // guard masks out the out-of-bounds threads.
    const groups = Math.ceil(size / 8)

    const pass = device.beginComputePass({ id: 'force.link.compute' })
    pass.setPipeline(this.runComputePipeline)
    pass.dispatch(groups, groups, 1)
    pass.end()
  }
}
