import { Buffer, ComputePipeline, Framebuffer, Shader, Texture, UniformStore } from '@luma.gl/core'
import type { Binding, BindingDeclaration } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import calculateLevelFrag from '@/graph/modules/ForceManyBody/calculate-level.frag?raw'
import calculateLevelVert from '@/graph/modules/ForceManyBody/calculate-level.vert?raw'
import calculateLevelWgsl from '@/graph/modules/ForceManyBody/calculate-level.wgsl?raw'
import forceFrag from '@/graph/modules/ForceManyBody/force-level.frag?raw'
import forceLevelWgsl from '@/graph/modules/ForceManyBody/force-level.wgsl?raw'
import forceCenterFrag from '@/graph/modules/ForceManyBody/force-centermass.frag?raw'
import forceCentermassWgsl from '@/graph/modules/ForceManyBody/force-centermass.wgsl?raw'
import { forceManyBodyComputeWgsl } from '@/graph/modules/ForceManyBody/force-many-body.compute.wgsl'
import { createIndexesForBuffer } from '@/graph/modules/Shared/buffer'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import updateVert from '@/graph/modules/Shared/quad.vert?raw'

type LevelTarget = {
  texture: Texture;
  fbo: Framebuffer;
}

export class ForceManyBody extends CoreModule {
  private randomValuesTexture: Texture | undefined
  private pointIndices: Buffer | undefined
  private levels = 0
  private levelTargets = new Map<number, LevelTarget>()

  private calculateLevelsCommand: Model | undefined
  private forceCommand: Model | undefined
  private forceFromItsOwnCentermassCommand: Model | undefined

  // WebGPU compute path: replaces drawForces() — one dispatch consolidates
  // the 14 fragment passes (one per Barnes-Hut level) plus the centermass
  // fallback into a single compute pass.
  private forceComputeShader: Shader | undefined
  private forceComputePipeline: ComputePipeline | undefined
  private forceComputeUniformStore: UniformStore<{
    forceComputeUniforms: {
      levels: number;
      alpha: number;
      repulsion: number;
      spaceSize: number;
      theta: number;
      pointsTextureSize: number;
    };
  }> | undefined

  private forceComputeUniformBuffer: Buffer | undefined
  private forceComputeCompiledLevels: number | undefined

  private forceVertexCoordBuffer: Buffer | undefined

  private calculateLevelsUniformStore: UniformStore<{
    calculateLevelsUniforms: {
      pointsTextureSize: number;
      levelTextureSize: number;
      cellSize: number;
    };
  }> | undefined

  private forceUniformStore: UniformStore<{
    forceUniforms: {
      level: number;
      levels: number;
      levelTextureSize: number;
      alpha: number;
      repulsion: number;
      spaceSize: number;
      theta: number;
    };
  }> | undefined

  private forceCenterUniformStore: UniformStore<{
    forceCenterUniforms: {
      levelTextureSize: number;
      alpha: number;
      repulsion: number;
    };
  }> | undefined

  private previousPointsTextureSize: number | undefined
  private previousSpaceSize: number | undefined

  public create (): void {
    const { device, store } = this
    if (!store.pointsTextureSize) return

    this.levels = Math.log2(store.adjustedSpaceSize)

    // Allocate quadtree levels
    for (let level = 0; level < this.levels; level += 1) {
      const levelTextureSize = Math.pow(2, level + 1)
      const existingTarget = this.levelTargets.get(level)

      if (
        existingTarget &&
        existingTarget.texture.width === levelTextureSize &&
        existingTarget.texture.height === levelTextureSize
      ) {
        // Clear existing texture data to zero
        existingTarget.texture.copyImageData({
          data: new Float32Array(levelTextureSize * levelTextureSize * 4).fill(0),
          bytesPerRow: getBytesPerRow('rgba32float', levelTextureSize),
          mipLevel: 0,
          x: 0,
          y: 0,
        })
        continue
      }

      // Destroy old resources if size changed
      if (existingTarget) {
        if (!existingTarget.fbo.destroyed) existingTarget.fbo.destroy()
        if (!existingTarget.texture.destroyed) existingTarget.texture.destroy()
      }

      const texture = device.createTexture({
        width: levelTextureSize,
        height: levelTextureSize,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      })
      texture.copyImageData({
        data: new Float32Array(levelTextureSize * levelTextureSize * 4).fill(0),
        bytesPerRow: getBytesPerRow('rgba32float', levelTextureSize),
        mipLevel: 0,
        x: 0,
        y: 0,
      })
      const fbo = device.createFramebuffer({
        width: levelTextureSize,
        height: levelTextureSize,
        colorAttachments: [texture],
      })
      this.levelTargets.set(level, { texture, fbo })
    }

    // Drop any stale higher-level buffers if space size shrank
    for (const [level, target] of Array.from(this.levelTargets.entries())) {
      if (level >= this.levels) {
        if (!target.fbo.destroyed) target.fbo.destroy()
        if (!target.texture.destroyed) target.texture.destroy()
        this.levelTargets.delete(level)
      }
    }

    // Random jitter texture to prevent sticking
    const totalPixels = store.pointsTextureSize * store.pointsTextureSize
    const randomValuesState = new Float32Array(totalPixels * 4)
    for (let i = 0; i < totalPixels; ++i) {
      randomValuesState[i * 4] = store.getRandomFloat(-1, 1) * 0.00001
      randomValuesState[i * 4 + 1] = store.getRandomFloat(-1, 1) * 0.00001
    }

    const recreateRandomValuesTexture =
      !this.randomValuesTexture ||
      this.randomValuesTexture.destroyed ||
      this.randomValuesTexture.width !== store.pointsTextureSize ||
      this.randomValuesTexture.height !== store.pointsTextureSize

    if (recreateRandomValuesTexture) {
      if (this.randomValuesTexture && !this.randomValuesTexture.destroyed) {
        this.randomValuesTexture.destroy()
      }
      this.randomValuesTexture = device.createTexture({
        width: store.pointsTextureSize,
        height: store.pointsTextureSize,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.COPY_DST,
      })
    }
    this.randomValuesTexture!.copyImageData({
      data: randomValuesState,
      bytesPerRow: getBytesPerRow('rgba32float', store.pointsTextureSize),
      mipLevel: 0,
      x: 0,
      y: 0,
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
      this.calculateLevelsCommand?.setAttributes({
        pointIndices: this.pointIndices,
      })
    }

    // Compute pipeline must be recompiled when levels changes — MAX_LEVELS
    // is baked into the WGSL source, and the bind-group layout has exactly
    // `levels` level-texture slots. Same pattern as force-spring.
    if (this.forceComputeCompiledLevels !== undefined && this.forceComputeCompiledLevels !== this.levels) {
      this.forceComputePipeline?.destroy()
      this.forceComputePipeline = undefined
      this.forceComputeShader?.destroy()
      this.forceComputeShader = undefined
    }

    this.previousPointsTextureSize = store.pointsTextureSize
    this.previousSpaceSize = store.adjustedSpaceSize
  }

  public initPrograms (): void {
    const { device, store, data, points } = this
    if (!data.pointsNumber || !points || !store.pointsTextureSize) return

    // Calculate levels command (point list)
    this.calculateLevelsUniformStore ||= new UniformStore({
      calculateLevelsUniforms: {
        uniformTypes: {
          pointsTextureSize: 'f32',
          levelTextureSize: 'f32',
          cellSize: 'f32',
        },
        defaultUniforms: {
          pointsTextureSize: store.pointsTextureSize,
          levelTextureSize: 0,
          cellSize: 0,
        },
      },
    })

    this.calculateLevelsCommand ||= new Model(device, {
      source: calculateLevelWgsl,
      fs: calculateLevelFrag,
      vs: calculateLevelVert,
      topology: 'point-list',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: data.pointsNumber,
      attributes: {
        ...this.pointIndices && { pointIndices: this.pointIndices },
      },
      bufferLayout: [
        { name: 'pointIndices', format: 'float32x2' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        // Create uniform buffer binding
        // Update it later by calling uniformStore.setUniforms()
        calculateLevelsUniforms: this.calculateLevelsUniformStore.getManagedUniformBuffer(device, 'calculateLevelsUniforms'),
        // All texture bindings will be set dynamically in drawLevels() method
      },
      parameters: {
        blend: true,
        blendColorOperation: 'add',
        blendColorSrcFactor: 'one',
        blendColorDstFactor: 'one',
        blendAlphaOperation: 'add',
        blendAlphaSrcFactor: 'one',
        blendAlphaDstFactor: 'one',
        depthWriteEnabled: false,
      },
    })

    // Force command (fullscreen quad)
    this.forceUniformStore ||= new UniformStore({
      forceUniforms: {
        uniformTypes: {
          level: 'f32',
          levels: 'f32',
          levelTextureSize: 'f32',
          alpha: 'f32',
          repulsion: 'f32',
          spaceSize: 'f32',
          theta: 'f32',
        },
        defaultUniforms: {
          level: 0,
          levels: this.levels,
          levelTextureSize: 0,
          alpha: store.alpha,
          repulsion: this.config.simulationRepulsion,
          spaceSize: store.adjustedSpaceSize,
          theta: this.config.simulationRepulsionTheta,
        },
      },
    })

    this.forceVertexCoordBuffer ||= device.createBuffer({
      data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    })

    this.forceCommand ||= new Model(device, {
      source: forceLevelWgsl,
      fs: forceFrag,
      vs: updateVert,
      topology: 'triangle-strip',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: 4,
      attributes: {
        vertexCoord: this.forceVertexCoordBuffer,
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
        forceUniforms: this.forceUniformStore.getManagedUniformBuffer(device, 'forceUniforms'),
        // All texture bindings will be set dynamically in drawForces() method
      },
      parameters: {
        blend: true,
        blendColorOperation: 'add',
        blendColorSrcFactor: 'one',
        blendColorDstFactor: 'one',
        blendAlphaOperation: 'add',
        blendAlphaSrcFactor: 'one',
        blendAlphaDstFactor: 'one',
        depthWriteEnabled: false,
      },
    })

    // Force-from-centermass command (fullscreen quad)
    this.forceCenterUniformStore ||= new UniformStore({
      forceCenterUniforms: {
        uniformTypes: {
          levelTextureSize: 'f32',
          alpha: 'f32',
          repulsion: 'f32',
        },
        defaultUniforms: {
          levelTextureSize: 0,
          alpha: store.alpha,
          repulsion: this.config.simulationRepulsion,
        },
      },
    })

    this.forceFromItsOwnCentermassCommand ||= new Model(device, {
      source: forceCentermassWgsl,
      fs: forceCenterFrag,
      vs: updateVert,
      topology: 'triangle-strip',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: 4,
      attributes: {
        vertexCoord: this.forceVertexCoordBuffer,
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
        forceCenterUniforms: this.forceCenterUniformStore.getManagedUniformBuffer(device, 'forceCenterUniforms'),
        // All texture bindings will be set dynamically in drawForces() method
      },
      parameters: {
        blend: true,
        blendColorOperation: 'add',
        blendColorSrcFactor: 'one',
        blendColorDstFactor: 'one',
        blendAlphaOperation: 'add',
        blendAlphaSrcFactor: 'one',
        blendAlphaDstFactor: 'one',
        depthWriteEnabled: false,
      },
    })

    if (device.info?.type === 'webgpu') {
      this.initForceComputePipeline()
    }
  }

  public run (): void {
    // Skip if sizes changed and create() wasn't called yet
    if (this.store.pointsTextureSize !== this.previousPointsTextureSize || this.store.adjustedSpaceSize !== this.previousSpaceSize) {
      return
    }
    this.drawLevels()
    // On WebGPU the 14 sequential fragment passes + centermass fallback are
    // consolidated into a single compute dispatch. WebGL2 keeps the fragment
    // path.
    if (this.forceComputePipeline) {
      this.drawForcesCompute()
    } else {
      this.drawForces()
    }
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
    this.calculateLevelsCommand?.destroy()
    this.calculateLevelsCommand = undefined
    this.forceCommand?.destroy()
    this.forceCommand = undefined
    this.forceFromItsOwnCentermassCommand?.destroy()
    this.forceFromItsOwnCentermassCommand = undefined
    this.forceComputePipeline?.destroy()
    this.forceComputePipeline = undefined
    this.forceComputeShader?.destroy()
    this.forceComputeShader = undefined
    this.forceComputeCompiledLevels = undefined

    // 2. Destroy Framebuffers (before textures they reference)
    for (const target of this.levelTargets.values()) {
      if (target.fbo && !target.fbo.destroyed) {
        target.fbo.destroy()
      }
    }

    // 3. Destroy Textures
    if (this.randomValuesTexture && !this.randomValuesTexture.destroyed) {
      this.randomValuesTexture.destroy()
    }
    this.randomValuesTexture = undefined

    for (const target of this.levelTargets.values()) {
      if (target.texture && !target.texture.destroyed) {
        target.texture.destroy()
      }
    }
    this.levelTargets.clear()

    // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
    this.calculateLevelsUniformStore?.destroy()
    this.calculateLevelsUniformStore = undefined
    this.forceUniformStore?.destroy()
    this.forceUniformStore = undefined
    this.forceCenterUniformStore?.destroy()
    this.forceCenterUniformStore = undefined
    this.forceComputeUniformBuffer = undefined
    this.forceComputeUniformStore?.destroy()
    this.forceComputeUniformStore = undefined

    // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
    if (this.pointIndices && !this.pointIndices.destroyed) {
      this.pointIndices.destroy()
    }
    this.pointIndices = undefined
    if (this.forceVertexCoordBuffer && !this.forceVertexCoordBuffer.destroyed) {
      this.forceVertexCoordBuffer.destroy()
    }
    this.forceVertexCoordBuffer = undefined
  }

  private initForceComputePipeline (): void {
    const { device } = this
    if (this.forceComputePipeline) return
    if (this.levels <= 0) return

    this.forceComputeUniformStore ||= new UniformStore({
      forceComputeUniforms: {
        uniformTypes: {
          levels: 'f32',
          alpha: 'f32',
          repulsion: 'f32',
          spaceSize: 'f32',
          theta: 'f32',
          pointsTextureSize: 'f32',
        },
      },
    })

    this.forceComputeUniformBuffer ||= this.forceComputeUniformStore.getManagedUniformBuffer(device, 'forceComputeUniforms')

    this.forceComputeShader = device.createShader({
      stage: 'compute',
      source: forceManyBodyComputeWgsl(this.levels),
    })

    // Build the shader-layout binding list: 4 fixed entries (uniform,
    // positions, randomValues, velocityOut) + N level textures starting at
    // location 4. luma 9.2.6's getShaderLayoutFromWGSL doesn't walk compute
    // entry points, so we have to hand-roll the name→binding mapping.
    const bindings: BindingDeclaration[] = [
      { type: 'uniform', name: 'forceComputeUniforms', group: 0, location: 0 },
      { type: 'texture', name: 'positionsTexture', group: 0, location: 1 },
      { type: 'texture', name: 'randomValues', group: 0, location: 2 },
      { type: 'storage', name: 'velocityOut', group: 0, location: 3 },
    ]
    for (let i = 0; i < this.levels; i += 1) {
      bindings.push({ type: 'texture' as const, name: `levelFbo${i}`, group: 0, location: 4 + i })
    }

    this.forceComputePipeline = device.createComputePipeline({
      shader: this.forceComputeShader,
      entryPoint: 'computeMain',
      shaderLayout: { bindings },
    })

    this.forceComputeCompiledLevels = this.levels
  }

  private drawLevels (): void {
    const { device, store, data, points } = this
    if (!points) return
    if (!this.calculateLevelsCommand || !this.calculateLevelsUniformStore) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!data.pointsNumber) return
    // Ensure pointIndices is set (Model might exist but attributes not set yet)
    if (!this.pointIndices) return

    for (let level = 0; level < this.levels; level += 1) {
      const target = this.levelTargets.get(level)
      if (!target || target.fbo.destroyed || target.texture.destroyed) continue

      const levelTextureSize = Math.pow(2, level + 1)
      const cellSize = store.adjustedSpaceSize / levelTextureSize

      this.calculateLevelsUniformStore.setUniforms({
        calculateLevelsUniforms: {
          pointsTextureSize: store.pointsTextureSize ?? 0,
          levelTextureSize,
          cellSize,
        },
      })

      this.calculateLevelsCommand.setVertexCount(data.pointsNumber)
      // Update texture bindings dynamically
      this.calculateLevelsCommand.setBindings({
        positionsTexture: points.previousPositionTexture,
      })

      const levelPass = device.beginRenderPass({
        framebuffer: target.fbo,
        clearColor: [0, 0, 0, 0],
      })

      this.calculateLevelsCommand.draw(levelPass)

      levelPass.end()
    }
  }

  private drawForces (): void {
    const { device, store, points } = this
    if (!points) return
    if (!this.forceCommand || !this.forceUniformStore) return
    if (!this.forceFromItsOwnCentermassCommand || !this.forceCenterUniformStore) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!this.randomValuesTexture || this.randomValuesTexture.destroyed) return
    if (!points.velocityFbo || points.velocityFbo.destroyed) return

    const drawPass = device.beginRenderPass({
      framebuffer: points.velocityFbo,
      clearColor: [0, 0, 0, 0],
    })

    for (let level = 0; level < this.levels; level += 1) {
      const target = this.levelTargets.get(level)
      if (!target || target.texture.destroyed) continue
      const levelTextureSize = Math.pow(2, level + 1)

      this.forceUniformStore.setUniforms({
        forceUniforms: {
          level,
          levels: this.levels,
          levelTextureSize,
          alpha: store.alpha,
          repulsion: this.config.simulationRepulsion,
          spaceSize: store.adjustedSpaceSize,
          theta: this.config.simulationRepulsionTheta,
        },
      })

      // Update texture bindings dynamically
      this.forceCommand.setBindings({
        positionsTexture: points.previousPositionTexture,
        levelFbo: target.texture,
      })

      this.forceCommand.draw(drawPass)

      // Only the deepest level uses the centermass fallback
      if (level === this.levels - 1) {
        this.forceCenterUniformStore.setUniforms({
          forceCenterUniforms: {
            levelTextureSize,
            alpha: store.alpha,
            repulsion: this.config.simulationRepulsion,
          },
        })

        // Update texture bindings dynamically
        this.forceFromItsOwnCentermassCommand.setBindings({
          positionsTexture: points.previousPositionTexture,
          randomValues: this.randomValuesTexture,
          levelFbo: target.texture,
        })
        this.forceFromItsOwnCentermassCommand.draw(drawPass)
      }
    }

    drawPass.end()
  }

  private drawForcesCompute (): void {
    const { device, store, points } = this
    if (!points) return
    if (!this.forceComputePipeline || !this.forceComputeUniformStore || !this.forceComputeUniformBuffer) return
    if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
    if (!points.velocityTexture || points.velocityTexture.destroyed) return
    if (!this.randomValuesTexture || this.randomValuesTexture.destroyed) return
    if (this.levels <= 0) return

    this.forceComputeUniformStore.setUniforms({
      forceComputeUniforms: {
        levels: this.levels,
        alpha: store.alpha,
        repulsion: this.config.simulationRepulsion,
        spaceSize: store.adjustedSpaceSize,
        theta: this.config.simulationRepulsionTheta,
        pointsTextureSize: store.pointsTextureSize ?? 0,
      },
    })

    // Build the binding map. The shader expects MAX_LEVELS texture slots —
    // we always declare exactly `this.levels` slots (matched by the
    // shaderLayout), so the binding count is exact.
    const bindings: Record<string, Binding> = {
      forceComputeUniforms: this.forceComputeUniformBuffer,
      positionsTexture: points.previousPositionTexture,
      randomValues: this.randomValuesTexture,
      velocityOut: points.velocityTexture,
    }
    for (let i = 0; i < this.levels; i += 1) {
      const target = this.levelTargets.get(i)
      // If a level texture is missing the dispatch can't be valid. Bail —
      // the next frame's drawLevels() will rebuild whatever's stale.
      if (!target || target.texture.destroyed) return
      bindings[`levelFbo${i}`] = target.texture
    }
    this.forceComputePipeline.setBindings(bindings)

    const size = store.pointsTextureSize ?? 0
    if (size === 0) return
    const groups = Math.ceil(size / 8)

    const pass = device.beginComputePass({ id: 'force.many-body.compute' })
    pass.setPipeline(this.forceComputePipeline)
    pass.dispatch(groups, groups, 1)
    pass.end()
  }
}
