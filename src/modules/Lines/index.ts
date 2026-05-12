import { ComputePipeline, Framebuffer, Buffer, Shader, Texture, UniformStore, RenderPass } from '@luma.gl/core'
import type { Binding, BindingDeclaration } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'
import type { Mat4Array } from '@/graph/modules/Store'
import { conicParametricCurveModule } from '@/graph/modules/Lines/conic-curve-module'
import drawLineFrag from '@/graph/modules/Lines/draw-curve-line.frag?raw'
import drawLineVert from '@/graph/modules/Lines/draw-curve-line.vert?raw'
import drawLineWgsl from '@/graph/modules/Lines/draw-curve-line.wgsl?raw'
import { drawCurveLineInstancedWgslSource } from '@/graph/modules/Lines/draw-curve-line-instanced.wgsl'
import { precomputeLineInstancesWgsl } from '@/graph/modules/Lines/precompute-line-instances.compute.wgsl'
import fillGridWithSampledLinksFrag from '@/graph/modules/Lines/fill-sampled-links.frag?raw'
import fillGridWithSampledLinksVert from '@/graph/modules/Lines/fill-sampled-links.vert?raw'
import fillGridWithSampledLinksWgsl from '@/graph/modules/Lines/fill-sampled-links.wgsl?raw'
import hoveredLineIndexFrag from '@/graph/modules/Lines/hovered-line-index.frag?raw'
import hoveredLineIndexVert from '@/graph/modules/Lines/hovered-line-index.vert?raw'
import hoveredLineIndexWgsl from '@/graph/modules/Lines/hovered-line-index.wgsl?raw'
import { defaultConfigValues } from '@/graph/variables'
import { getCurveLineGeometry } from '@/graph/modules/Lines/geometry'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { ensureVec2, ensureVec4 } from '@/graph/modules/Shared/uniform-utils'
import { readPixels } from '@/graph/helper'

export class Lines extends CoreModule {
  public linkIndexFbo: Framebuffer | undefined
  public hoveredLineIndexFbo: Framebuffer | undefined
  public sampledLinksFbo: Framebuffer | undefined
  public linkStatusTexture: Texture | undefined
  private linkStatusTextureSize = 0
  private drawCurveCommand: Model | undefined
  // WebGPU-only: thin-vertex-shader render Model paired with the per-instance
  // compute pre-pass. Same draw target as drawCurveCommand but bypasses the
  // 4× redundant instance-uniform work that the legacy vertex shader does on
  // every quad corner. Picking pass (drawCurveIndexCommand) keeps the legacy
  // shader since it runs per hover event, not per frame.
  private drawCurveCommandInstanced: Model | undefined
  // Compute pipeline that fills `lineInstanceBuffer` once per frame with all
  // per-link state the visible vertex shader needs. 9 storage bindings + 1
  // uniform — luma 9.2.6's compute path works at this scale (force-spring
  // proves 5 bindings, line-precompute is the same template with more).
  private precomputeShader: Shader | undefined
  private precomputePipeline: ComputePipeline | undefined
  // Output of the precompute pass: packed array<LineInstance>, 112 bytes per
  // link (7 vec4). Bound as read-only storage in the visible vertex shader.
  private lineInstanceBuffer: Buffer | undefined
  private lineInstanceBufferLinksNumber = 0
  private drawCurveIndexCommand: Model | undefined
  private hoveredLineIndexCommand: Model | undefined
  private fillSampledLinksFboCommand: Model | undefined
  private pointABuffer: Buffer | undefined
  private pointBBuffer: Buffer | undefined
  private colorBuffer: Buffer | undefined
  private widthBuffer: Buffer | undefined
  private arrowBuffer: Buffer | undefined
  private curveLineGeometry: number[][] | undefined
  private curveLineBuffer: Buffer | undefined
  private linkIndexBuffer: Buffer | undefined
  private quadBuffer: Buffer | undefined
  private linkIndexTexture: Texture | undefined
  private hoveredLineIndexTexture: Texture | undefined
  private fillSampledLinksUniformStore: UniformStore<{
    fillSampledLinksUniforms: {
      pointsTextureSize: number;
      transformationMatrix: Mat4Array;
      spaceSize: number;
      screenSize: [number, number];
      curvedWeight: number;
      curvedLinkControlPointDistance: number;
      curvedLinkSegments: number;
    };
  }> | undefined

  // Uniform stores for scalar uniforms
  private drawLineUniformStore: UniformStore<{
    drawLineUniforms: {
      transformationMatrix: Mat4Array;
      pointsTextureSize: number;
      widthScale: number;
      linkArrowsSizeScale: number;
      spaceSize: number;
      screenSize: [number, number];
      linkVisibilityDistanceRange: [number, number];
      linkVisibilityMinTransparency: number;
      linkOpacity: number;
      greyoutOpacity: number;
      curvedWeight: number;
      curvedLinkControlPointDistance: number;
      curvedLinkSegments: number;
      scaleLinksOnZoom: number;
      maxPointSize: number;
      renderMode: number;
      hoveredLinkIndex: number;
      hoveredLinkColor: [number, number, number, number];
      hoveredLinkWidthIncrease: number;
      isLinkHighlightingActive: number;
      linkStatusTextureSize: number;
      focusedLinkIndex: number;
      focusedLinkWidthIncrease: number;
      linkMinPixelLength: number;
    };
    drawLineFragmentUniforms: {
      renderMode: number;
    };
  }> | undefined

  private hoveredLineIndexUniformStore: UniformStore<{
    hoveredLineIndexUniforms: {
      mousePosition: [number, number];
      screenSize: [number, number];
    };
  }> | undefined

  // Track previous screen size to detect changes
  private previousScreenSize: [number, number] | undefined

  public initPrograms (): void {
    const { device, config, store, data } = this

    this.updateLinkIndexFbo()

    // Initialize the hovered line index FBO
    this.hoveredLineIndexTexture ||= device.createTexture({
      width: 1,
      height: 1,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      data: new Float32Array(4).fill(0),
    })
    this.hoveredLineIndexFbo ||= device.createFramebuffer({
      width: 1,
      height: 1,
      colorAttachments: [this.hoveredLineIndexTexture],
    })

    // Ensure geometry buffer exists (create empty if needed)
    if (!this.curveLineGeometry) {
      this.updateCurveLineGeometry()
    }

    // Ensure all attribute buffers exist (create empty if needed) so Model has all attributes
    const linksNumber = this.data.linksNumber ?? 0
    this.pointABuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber * 2),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.pointBBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber * 2),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.colorBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber * 4),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.widthBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.arrowBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.linkIndexBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })

    // Create UniformStore for drawLine uniforms
    this.drawLineUniformStore ||= new UniformStore({
      drawLineUniforms: {
        uniformTypes: {
          transformationMatrix: 'mat4x4<f32>',
          pointsTextureSize: 'f32',
          widthScale: 'f32',
          linkArrowsSizeScale: 'f32',
          spaceSize: 'f32',
          screenSize: 'vec2<f32>',
          linkVisibilityDistanceRange: 'vec2<f32>',
          linkVisibilityMinTransparency: 'f32',
          linkOpacity: 'f32',
          greyoutOpacity: 'f32',
          curvedWeight: 'f32',
          curvedLinkControlPointDistance: 'f32',
          curvedLinkSegments: 'f32',
          scaleLinksOnZoom: 'f32',
          maxPointSize: 'f32',
          renderMode: 'f32',
          hoveredLinkIndex: 'f32',
          hoveredLinkColor: 'vec4<f32>',
          hoveredLinkWidthIncrease: 'f32',
          isLinkHighlightingActive: 'f32',
          linkStatusTextureSize: 'f32',
          focusedLinkIndex: 'f32',
          focusedLinkWidthIncrease: 'f32',
          linkMinPixelLength: 'f32',
        },
        defaultUniforms: {
          transformationMatrix: store.transformationMatrix4x4,
          pointsTextureSize: store.pointsTextureSize,
          widthScale: config.linkWidthScale,
          linkArrowsSizeScale: config.linkArrowsSizeScale,
          spaceSize: store.adjustedSpaceSize,
          screenSize: ensureVec2(store.screenSize, [0, 0]),
          linkVisibilityDistanceRange: ensureVec2(config.linkVisibilityDistanceRange, [0, 0]),
          linkVisibilityMinTransparency: config.linkVisibilityMinTransparency,
          linkOpacity: config.linkOpacity,
          greyoutOpacity: config.linkGreyoutOpacity,
          curvedWeight: config.curvedLinkWeight,
          curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
          curvedLinkSegments: config.curvedLinks ? config.curvedLinkSegments : 1,
          scaleLinksOnZoom: config.scaleLinksOnZoom ? 1 : 0,
          maxPointSize: store.maxPointSize,
          renderMode: 0.0,
          hoveredLinkIndex: store.hoveredLinkIndex ?? -1,
          hoveredLinkColor: ensureVec4(store.hoveredLinkColor, [-1, -1, -1, -1]),
          hoveredLinkWidthIncrease: config.hoveredLinkWidthIncrease,
          isLinkHighlightingActive: 0,
          linkStatusTextureSize: 0,
          focusedLinkIndex: config.focusedLinkIndex ?? -1,
          focusedLinkWidthIncrease: config.focusedLinkWidthIncrease,
          linkMinPixelLength: config.linkMinPixelLength,
        },
      },
      drawLineFragmentUniforms: {
        uniformTypes: {
          renderMode: 'f32',
        },
        defaultUniforms: {
          renderMode: 0.0,
        },
      },
    })

    this.drawCurveCommand ||= new Model(device, {
      source: drawLineWgsl,
      vs: drawLineVert,
      fs: drawLineFrag,
      modules: [conicParametricCurveModule],
      topology: 'triangle-strip',
      colorAttachmentFormats: ['bgra8unorm'],
      vertexCount: this.curveLineGeometry?.length ?? 0,
      attributes: {
        ...this.curveLineBuffer && { position: this.curveLineBuffer },
        ...this.pointABuffer && { pointA: this.pointABuffer },
        ...this.pointBBuffer && { pointB: this.pointBBuffer },
        ...this.colorBuffer && { color: this.colorBuffer },
        ...this.widthBuffer && { width: this.widthBuffer },
        ...this.arrowBuffer && { arrow: this.arrowBuffer },
        ...this.linkIndexBuffer && { linkIndices: this.linkIndexBuffer },
      },
      bufferLayout: [
        { name: 'position', format: 'float32x2' },
        { name: 'pointA', format: 'float32x2', stepMode: 'instance' },
        { name: 'pointB', format: 'float32x2', stepMode: 'instance' },
        { name: 'color', format: 'float32x4', stepMode: 'instance' },
        { name: 'width', format: 'float32', stepMode: 'instance' },
        { name: 'arrow', format: 'float32', stepMode: 'instance' },
        { name: 'linkIndices', format: 'float32', stepMode: 'instance' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        // Create uniform buffer binding
        // Update it later by calling uniformStore.setUniforms()
        drawLineUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
        drawLineFragmentUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
        // All texture bindings will be set dynamically in draw() method
      },
      /**
         * Blending behavior for link index rendering (renderMode: 1.0 - hover detection):
         *
         * When rendering link indices to the framebuffer, we use full opacity (1.0).
         * This means:
         * - The source color completely overwrites the destination
         * - No blending occurs - it's like drawing with a permanent marker
         * - This preserves the exact index values we need for picking/selection
         */
      parameters: {
        cullMode: 'back',
        // Premultiplied alpha when linkBlendMode is 'normal'; user-selected
        // additive when 'add'. The fragment shader outputs vec4(rgb * a, a)
        // in both modes (one-shot canonical).
        blend: true,
        blendColorOperation: 'add',
        blendColorSrcFactor: 'one',
        blendColorDstFactor: config.linkBlendMode === 'add' ? 'one' : 'one-minus-src-alpha',
        blendAlphaOperation: 'add',
        blendAlphaSrcFactor: 'one',
        blendAlphaDstFactor: config.linkBlendMode === 'add' ? 'one' : 'one-minus-src-alpha',
        depthWriteEnabled: false,
        // Match the canvas pass's sample count (1 or 4 when MSAA on).
        sampleCount: config.msaa,
      },
    })

    // Picking pass needs OPAQUE writes to the link-index framebuffer regardless of
    // the user-configured linkBlendMode. Additive blending here would sum link indices
    // across overlapping links and produce garbage IDs on hover/click. We use a separate
    // Model with `blend: false` so this stays correct when the visible pass uses 'add'.
    this.drawCurveIndexCommand ||= new Model(device, {
      vs: drawLineVert,
      source: drawLineWgsl,
      fs: drawLineFrag,
      modules: [conicParametricCurveModule],
      topology: 'triangle-strip',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: this.curveLineGeometry?.length ?? 0,
      attributes: {
        ...this.curveLineBuffer && { position: this.curveLineBuffer },
        ...this.pointABuffer && { pointA: this.pointABuffer },
        ...this.pointBBuffer && { pointB: this.pointBBuffer },
        ...this.colorBuffer && { color: this.colorBuffer },
        ...this.widthBuffer && { width: this.widthBuffer },
        ...this.arrowBuffer && { arrow: this.arrowBuffer },
        ...this.linkIndexBuffer && { linkIndices: this.linkIndexBuffer },
      },
      bufferLayout: [
        { name: 'position', format: 'float32x2' },
        { name: 'pointA', format: 'float32x2', stepMode: 'instance' },
        { name: 'pointB', format: 'float32x2', stepMode: 'instance' },
        { name: 'color', format: 'float32x4', stepMode: 'instance' },
        { name: 'width', format: 'float32', stepMode: 'instance' },
        { name: 'arrow', format: 'float32', stepMode: 'instance' },
        { name: 'linkIndices', format: 'float32', stepMode: 'instance' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        drawLineUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
        drawLineFragmentUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
      },
      parameters: {
        cullMode: 'back',
        blend: false,
        depthWriteEnabled: false,
      },
    })

    // Initialize quad buffer for full-screen rendering
    this.quadBuffer ||= device.createBuffer({
      data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
    })

    // WebGPU-only: per-instance compute pre-pass + thin-vertex render path.
    // Constructed alongside the legacy fragment-path Models so the picking
    // pass and WebGL2 fallback are unaffected.
    if (device.info?.type === 'webgpu') {
      this.ensureLineInstanceBuffer()
      this.initPrecomputePipeline()
      this.initDrawCurveInstancedModel()
    }

    this.hoveredLineIndexUniformStore ||= new UniformStore({
      hoveredLineIndexUniforms: {
        uniformTypes: {
          mousePosition: 'vec2<f32>',
          screenSize: 'vec2<f32>',
        },
        defaultUniforms: {
          mousePosition: ensureVec2(store.screenMousePosition, [0, 0]),
          screenSize: ensureVec2(store.screenSize, [0, 0]),
        },
      },
    })

    this.hoveredLineIndexCommand ||= new Model(device, {
      source: hoveredLineIndexWgsl,
      vs: hoveredLineIndexVert,
      fs: hoveredLineIndexFrag,
      topology: 'triangle-strip',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: 4,
      attributes: {
        vertexCoord: this.quadBuffer,
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
        hoveredLineIndexUniforms: this.hoveredLineIndexUniformStore.getManagedUniformBuffer(device, 'hoveredLineIndexUniforms'),
        // All texture bindings will be set dynamically in findHoveredLine() method
      },
    })

    // Sampled links (for getSampledLinks / getSampledLinkPositionsMap)
    this.fillSampledLinksUniformStore ||= new UniformStore({
      fillSampledLinksUniforms: {
        uniformTypes: {
          pointsTextureSize: 'f32',
          transformationMatrix: 'mat4x4<f32>',
          spaceSize: 'f32',
          screenSize: 'vec2<f32>',
          curvedWeight: 'f32',
          curvedLinkControlPointDistance: 'f32',
          curvedLinkSegments: 'f32',
        },
        defaultUniforms: {
          pointsTextureSize: store.pointsTextureSize ?? 0,
          transformationMatrix: store.transformationMatrix4x4,
          spaceSize: store.adjustedSpaceSize,
          screenSize: ensureVec2(store.screenSize, [0, 0]),
          curvedWeight: config.curvedLinkWeight,
          curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
          curvedLinkSegments: config.curvedLinks ? config.curvedLinkSegments : 1,
        },
      },
    })

    this.fillSampledLinksFboCommand ||= new Model(device, {
      source: fillGridWithSampledLinksWgsl,
      fs: fillGridWithSampledLinksFrag,
      vs: fillGridWithSampledLinksVert,
      modules: [conicParametricCurveModule],
      topology: 'point-list',
      colorAttachmentFormats: ['rgba32float'],
      vertexCount: data.linksNumber ?? 0,
      attributes: {
        ...(this.pointABuffer && { pointA: this.pointABuffer }),
        ...(this.pointBBuffer && { pointB: this.pointBBuffer }),
        ...(this.linkIndexBuffer && { linkIndices: this.linkIndexBuffer }),
      },
      bufferLayout: [
        { name: 'pointA', format: 'float32x2' },
        { name: 'pointB', format: 'float32x2' },
        { name: 'linkIndices', format: 'float32' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        fillSampledLinksUniforms: this.fillSampledLinksUniformStore.getManagedUniformBuffer(device, 'fillSampledLinksUniforms'),
      },
      parameters: {
        depthWriteEnabled: false,
        blend: false,
      },
    })

    this.updateSampledLinksGrid()
    this.updateLinkStatus()
  }

  public draw (renderPass: RenderPass): void {
    const { points } = this
    if (!points) return
    if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return
    if (!this.pointABuffer || !this.pointBBuffer) this.updatePointsBuffer()
    if (!this.colorBuffer) this.updateColor()
    if (!this.widthBuffer) this.updateWidth()
    if (!this.arrowBuffer) this.updateArrow()
    if (!this.curveLineGeometry) this.updateCurveLineGeometry()
    if (!this.drawCurveCommand || !this.drawLineUniformStore || !this.linkStatusTexture) return

    this.updateDrawLineUniforms()

    // WebGPU visible-pass: use the thin-vertex instanced Model, which reads
    // precomputed per-instance state from `lineInstanceBuffer` instead of
    // re-running the 16+ instance-uniform ops on every quad corner. The
    // pre-pass that fills `lineInstanceBuffer` must have already been
    // dispatched this frame via `Lines.precompute()` — called from
    // renderFrame before the canvas render pass opens.
    if (this.drawCurveCommandInstanced && this.lineInstanceBuffer) {
      this.drawCurveCommandInstanced.setBindings({
        instances: this.lineInstanceBuffer,
      })
      this.drawCurveCommandInstanced.setInstanceCount(this.data.linksNumber ?? 0)
      this.drawCurveCommandInstanced.draw(renderPass)
      return
    }

    // Legacy fragment path (WebGL2 fallback + any frame before the compute
    // pipeline is ready). WebGPU reads positions via the points module's
    // storage-buffer mirror; WebGL2 reads from the texture.
    this.drawCurveCommand.setBindings({
      ...(points.positionStorageBuffer && { positions: points.positionStorageBuffer }),
      positionsTexture: points.currentPositionTexture,
      linkStatus: this.linkStatusTexture,
    })

    // Update instance count
    this.drawCurveCommand.setInstanceCount(this.data.linksNumber ?? 0)

    // Render normal links
    this.drawCurveCommand.draw(renderPass)
  }

  /**
   * Dispatch the per-link compute pre-pass that fills `lineInstanceBuffer`.
   * Must be called before `draw()` each frame, OUTSIDE any active render
   * pass (compute and render passes can't be nested in WebGPU).
   *
   * No-op on WebGL2 or before the compute pipeline is initialized.
   */
  public precompute (): void {
    if (!this.precomputePipeline) return
    // Lazy-create the instance buffer here so size changes (linksNumber
    // changing across frames) are handled without needing every update*()
    // method to know about the compute path.
    this.ensureLineInstanceBuffer()
    // The compute pass reads from the same managed uniform buffer that the
    // visible vertex shader does, so the per-frame uniforms must be written
    // BEFORE the compute dispatch encodes its commands.
    this.updateDrawLineUniforms()
    this.runPrecompute()
  }

  public updateLinkIndexFbo (): void {
    const { device, store } = this

    // Only create and update the link index FBO if link hovering is enabled
    if (!this.store.isLinkHoveringEnabled) return

    const screenSize = store.screenSize ?? [0, 0]
    const screenWidth = screenSize[0]
    const screenHeight = screenSize[1]

    // Avoid invalid uploads when size is zero
    if (!screenWidth || !screenHeight) return

    // Check if screen size changed
    const screenSizeChanged =
      this.previousScreenSize?.[0] !== screenWidth ||
      this.previousScreenSize?.[1] !== screenHeight

    if (!this.linkIndexTexture || screenSizeChanged) {
      // Destroy old framebuffer and texture if they exist
      if (this.linkIndexFbo && !this.linkIndexFbo.destroyed) {
        this.linkIndexFbo.destroy()
      }
      if (this.linkIndexTexture && !this.linkIndexTexture.destroyed) {
        this.linkIndexTexture.destroy()
      }

      // Create new texture
      this.linkIndexTexture = device.createTexture({
        width: screenWidth,
        height: screenHeight,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      })
      this.linkIndexTexture.copyImageData({
        data: new Float32Array(screenWidth * screenHeight * 4).fill(0),
        bytesPerRow: getBytesPerRow('rgba32float', screenWidth),
        mipLevel: 0,
        x: 0,
        y: 0,
      })

      // Create new framebuffer
      this.linkIndexFbo = device.createFramebuffer({
        width: screenWidth,
        height: screenHeight,
        colorAttachments: [this.linkIndexTexture],
      })

      this.previousScreenSize = [screenWidth, screenHeight]
    }
  }

  public updateSampledLinksGrid (): void {
    const { store: { screenSize }, config: { linkSamplingDistance }, device } = this
    let dist = linkSamplingDistance ?? Math.min(...screenSize) / 2
    if (dist === 0) dist = defaultConfigValues.linkSamplingDistance
    const w = Math.ceil(screenSize[0] / dist)
    const h = Math.ceil(screenSize[1] / dist)
    if (w === 0 || h === 0) return

    if (!this.sampledLinksFbo || this.sampledLinksFbo.width !== w || this.sampledLinksFbo.height !== h) {
      if (this.sampledLinksFbo && !this.sampledLinksFbo.destroyed) {
        this.sampledLinksFbo.destroy()
      }
      this.sampledLinksFbo = device.createFramebuffer({
        width: w,
        height: h,
        colorAttachments: ['rgba32float'],
      })
    }
  }

  public updatePointsBuffer (): void {
    const { device, data, store } = this
    if (data.linksNumber === undefined || data.links === undefined) return
    if (!store.pointsTextureSize) return // Guard against 0/undefined

    // Create separate buffers for pointA and pointB
    const pointAData = new Float32Array(data.linksNumber * 2)
    const pointBData = new Float32Array(data.linksNumber * 2)

    for (let i = 0; i < data.linksNumber; i++) {
      const fromIndex = data.links[i * 2] as number
      const toIndex = data.links[i * 2 + 1] as number
      const fromX = fromIndex % store.pointsTextureSize
      const fromY = Math.floor(fromIndex / store.pointsTextureSize)
      const toX = toIndex % store.pointsTextureSize
      const toY = Math.floor(toIndex / store.pointsTextureSize)

      pointAData[i * 2] = fromX
      pointAData[i * 2 + 1] = fromY
      pointBData[i * 2] = toX
      pointBData[i * 2 + 1] = toY
    }

    // Check if buffer needs to be resized (buffers can't be resized, need to recreate)
    const currentSize = (this.pointABuffer?.byteLength ?? 0) / (Float32Array.BYTES_PER_ELEMENT * 2)
    if (!this.pointABuffer || currentSize !== data.linksNumber) {
      if (this.pointABuffer && !this.pointABuffer.destroyed) {
        this.pointABuffer.destroy()
      }
      this.pointABuffer = device.createBuffer({
        data: pointAData,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
      // Note: Model attributes are set at creation time, so if Model exists and buffer is recreated,
      // the Model will need to be recreated too. For now, we ensure buffers exist before initPrograms.
    } else {
      this.pointABuffer.write(pointAData)
    }

    if (!this.pointBBuffer || currentSize !== data.linksNumber) {
      if (this.pointBBuffer && !this.pointBBuffer.destroyed) {
        this.pointBBuffer.destroy()
      }
      this.pointBBuffer = device.createBuffer({
        data: pointBData,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      this.pointBBuffer.write(pointBData)
    }

    const linkIndices = new Float32Array(data.linksNumber)
    for (let i = 0; i < data.linksNumber; i++) {
      linkIndices[i] = i
    }
    if (!this.linkIndexBuffer || currentSize !== data.linksNumber) {
      if (this.linkIndexBuffer && !this.linkIndexBuffer.destroyed) {
        this.linkIndexBuffer.destroy()
      }
      this.linkIndexBuffer = device.createBuffer({
        data: linkIndices,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      this.linkIndexBuffer.write(linkIndices)
    }
    if (this.drawCurveCommand) {
      this.drawCurveCommand.setAttributes({
        pointA: this.pointABuffer,
        pointB: this.pointBBuffer,
        linkIndices: this.linkIndexBuffer,
      })
    }
    this.drawCurveIndexCommand?.setAttributes({
      pointA: this.pointABuffer,
      pointB: this.pointBBuffer,
      linkIndices: this.linkIndexBuffer,
    })
    if (this.fillSampledLinksFboCommand) {
      this.fillSampledLinksFboCommand.setAttributes({
        pointA: this.pointABuffer,
        pointB: this.pointBBuffer,
        linkIndices: this.linkIndexBuffer,
      })
    }

    this.updateSampledLinksGrid()
    if (this.config.highlightedLinkIndices !== undefined) this.updateLinkStatus()
  }

  public updateColor (): void {
    const { device, data } = this
    const linksNumber = data.linksNumber ?? 0
    const colorData = data.linkColors ?? new Float32Array(linksNumber * 4).fill(0)

    if (!this.colorBuffer) {
      this.colorBuffer = device.createBuffer({
        data: colorData,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      // Check if buffer needs to be resized
      const currentSize = (this.colorBuffer.byteLength ?? 0) / (Float32Array.BYTES_PER_ELEMENT * 4)
      if (currentSize !== linksNumber) {
        if (this.colorBuffer && !this.colorBuffer.destroyed) {
          this.colorBuffer.destroy()
        }
        this.colorBuffer = device.createBuffer({
          data: colorData,
          usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
        })
      } else {
        this.colorBuffer.write(colorData)
      }
    }
    if (this.drawCurveCommand) {
      this.drawCurveCommand.setAttributes({
        color: this.colorBuffer,
      })
    }
    this.drawCurveIndexCommand?.setAttributes({
      color: this.colorBuffer,
    })
  }

  public updateWidth (): void {
    const { device, data } = this
    const linksNumber = data.linksNumber ?? 0
    const widthData = data.linkWidths ?? new Float32Array(linksNumber).fill(0)

    if (!this.widthBuffer) {
      this.widthBuffer = device.createBuffer({
        data: widthData,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      // Check if buffer needs to be resized
      const currentSize = (this.widthBuffer.byteLength ?? 0) / Float32Array.BYTES_PER_ELEMENT
      if (currentSize !== linksNumber) {
        if (this.widthBuffer && !this.widthBuffer.destroyed) {
          this.widthBuffer.destroy()
        }
        this.widthBuffer = device.createBuffer({
          data: widthData,
          usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
        })
      } else {
        this.widthBuffer.write(widthData)
      }
    }
    if (this.drawCurveCommand) {
      this.drawCurveCommand.setAttributes({
        width: this.widthBuffer,
      })
    }
    this.drawCurveIndexCommand?.setAttributes({
      width: this.widthBuffer,
    })
  }

  public updateArrow (): void {
    const { device, data } = this
    // linkArrows is number[] not Float32Array, so we need to convert it
    // Ensure we have the right size even if linkArrows is undefined
    const linksNumber = data.linksNumber ?? 0
    const arrowData = data.linkArrows
      ? new Float32Array(data.linkArrows)
      : new Float32Array(linksNumber).fill(0)

    if (!this.arrowBuffer) {
      this.arrowBuffer = device.createBuffer({
        data: arrowData,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      // Check if buffer needs to be resized
      const currentSize = (this.arrowBuffer.byteLength ?? 0) / Float32Array.BYTES_PER_ELEMENT
      if (currentSize !== linksNumber) {
        if (this.arrowBuffer && !this.arrowBuffer.destroyed) {
          this.arrowBuffer.destroy()
        }
        this.arrowBuffer = device.createBuffer({
          data: arrowData,
          usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
        })
      } else {
        this.arrowBuffer.write(arrowData)
      }
    }
    if (this.drawCurveCommand) {
      this.drawCurveCommand.setAttributes({
        arrow: this.arrowBuffer,
      })
    }
    this.drawCurveIndexCommand?.setAttributes({
      arrow: this.arrowBuffer,
    })
  }

  public updateLinkStatus (): void {
    const { device, config, data } = this
    const linksNumber = data.linksNumber ?? 0

    // No links yet — ensure a placeholder texture exists so luma.gl always has
    // a valid binding for the linkStatus sampler (it silently skips the draw
    // call if any declared sampler is unbound).
    if (!linksNumber) {
      if (!this.linkStatusTexture) this.ensureLinkStatusPlaceholder()
      return
    }

    const { highlightedLinkIndices } = config

    // Highlighting cleared — keep the existing texture to avoid GPU alloc churn,
    // but set the size to 0 so the shader knows not to sample it
    // (the isLinkHighlightingActive uniform is set to 0 when highlighting is off).
    // If no texture exists yet (first call), create a 1×1 placeholder.
    if (highlightedLinkIndices === undefined) {
      if (!this.linkStatusTexture) this.ensureLinkStatusPlaceholder()
      this.linkStatusTextureSize = 0
      return
    }

    // Calculate texture size (square texture large enough for all links)
    const textureSize = Math.ceil(Math.sqrt(linksNumber))
    this.linkStatusTextureSize = textureSize

    const state = new Float32Array(textureSize * textureSize * 4)

    // Mark all links as greyed out (R=1)
    for (let i = 0; i < linksNumber; i++) {
      state[i * 4] = 1
    }
    // Un-grey highlighted links
    for (const idx of highlightedLinkIndices) {
      if (idx >= 0 && idx < linksNumber) {
        state[idx * 4] = 0
      }
    }

    const copyData = {
      data: state,
      bytesPerRow: getBytesPerRow('rgba32float', textureSize),
      mipLevel: 0,
      x: 0,
      y: 0,
    }

    if (!this.linkStatusTexture || this.linkStatusTexture.width !== textureSize || this.linkStatusTexture.height !== textureSize) {
      if (this.linkStatusTexture && !this.linkStatusTexture.destroyed) {
        this.linkStatusTexture.destroy()
      }
      this.linkStatusTexture = device.createTexture({
        width: textureSize,
        height: textureSize,
        format: 'rgba32float',
        usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      })
      this.linkStatusTexture.copyImageData(copyData)
    } else {
      this.linkStatusTexture.copyImageData(copyData)
    }
  }

  public updateCurveLineGeometry (): void {
    const { device, config: { curvedLinks, curvedLinkSegments } } = this
    this.curveLineGeometry = getCurveLineGeometry(curvedLinks ? curvedLinkSegments : 1)

    // Flatten the 2D array to 1D
    const flatGeometry = new Float32Array(this.curveLineGeometry.length * 2)
    for (let i = 0; i < this.curveLineGeometry.length; i++) {
      flatGeometry[i * 2] = this.curveLineGeometry[i]![0]!
      flatGeometry[i * 2 + 1] = this.curveLineGeometry[i]![1]!
    }

    if (!this.curveLineBuffer || this.curveLineBuffer.byteLength !== flatGeometry.byteLength) {
      if (this.curveLineBuffer && !this.curveLineBuffer.destroyed) {
        this.curveLineBuffer.destroy()
      }
      this.curveLineBuffer = device.createBuffer({
        data: flatGeometry,
        usage: Buffer.VERTEX | Buffer.STORAGE | Buffer.COPY_DST,
      })
    } else {
      this.curveLineBuffer.write(flatGeometry)
    }

    // Update vertex count in model if it exists
    if (this.drawCurveCommand) {
      this.drawCurveCommand.setAttributes({
        position: this.curveLineBuffer,
      })
      this.drawCurveCommand.setVertexCount(this.curveLineGeometry.length)
    }
    if (this.drawCurveIndexCommand) {
      this.drawCurveIndexCommand.setAttributes({
        position: this.curveLineBuffer,
      })
      this.drawCurveIndexCommand.setVertexCount(this.curveLineGeometry.length)
    }
  }

  public getSampledLinkPositionsMap (): Map<number, [number, number, number]> {
    const positions = new Map<number, [number, number, number]>()
    if (!this.sampledLinksFbo || this.sampledLinksFbo.destroyed) return positions
    const points = this.points
    if (!points?.currentPositionTexture || points.currentPositionTexture.destroyed) return positions

    if (this.fillSampledLinksFboCommand && this.fillSampledLinksUniformStore && this.sampledLinksFbo) {
      this.fillSampledLinksFboCommand.setVertexCount(this.data.linksNumber ?? 0)
      this.fillSampledLinksUniformStore.setUniforms({
        fillSampledLinksUniforms: {
          pointsTextureSize: this.store.pointsTextureSize ?? 0,
          transformationMatrix: this.store.transformationMatrix4x4,
          spaceSize: this.store.adjustedSpaceSize,
          screenSize: ensureVec2(this.store.screenSize, [0, 0]),
          curvedWeight: this.config.curvedLinkWeight,
          curvedLinkControlPointDistance: this.config.curvedLinkControlPointDistance,
          curvedLinkSegments: this.config.curvedLinks ? this.config.curvedLinkSegments : 1,
        },
      })
      this.fillSampledLinksFboCommand.setBindings({
        positionsTexture: points.currentPositionTexture,
      })

      const fillPass = this.device.beginRenderPass({
        framebuffer: this.sampledLinksFbo,
        clearColor: [-1, -1, -1, -1],
      })
      this.fillSampledLinksFboCommand.draw(fillPass)
      fillPass.end()
    }

    const pixels = readPixels(this.device, this.sampledLinksFbo)
    for (let i = 0; i < pixels.length / 4; i++) {
      const index = pixels[i * 4]
      const x = pixels[i * 4 + 1]
      const y = pixels[i * 4 + 2]
      const angle = pixels[i * 4 + 3]

      if (index !== undefined && index >= 0 && x !== undefined && y !== undefined && angle !== undefined) {
        positions.set(Math.round(index), [x, y, angle])
      }
    }
    return positions
  }

  public getSampledLinks (): { indices: number[]; positions: number[]; angles: number[] } {
    const indices: number[] = []
    const positions: number[] = []
    const angles: number[] = []
    if (!this.sampledLinksFbo || this.sampledLinksFbo.destroyed) return { indices, positions, angles }
    const points = this.points
    if (!points?.currentPositionTexture || points.currentPositionTexture.destroyed) return { indices, positions, angles }

    if (this.fillSampledLinksFboCommand && this.fillSampledLinksUniformStore && this.sampledLinksFbo) {
      this.fillSampledLinksFboCommand.setVertexCount(this.data.linksNumber ?? 0)
      this.fillSampledLinksUniformStore.setUniforms({
        fillSampledLinksUniforms: {
          pointsTextureSize: this.store.pointsTextureSize ?? 0,
          transformationMatrix: this.store.transformationMatrix4x4,
          spaceSize: this.store.adjustedSpaceSize,
          screenSize: ensureVec2(this.store.screenSize, [0, 0]),
          curvedWeight: this.config.curvedLinkWeight,
          curvedLinkControlPointDistance: this.config.curvedLinkControlPointDistance,
          curvedLinkSegments: this.config.curvedLinks ? this.config.curvedLinkSegments : 1,
        },
      })
      this.fillSampledLinksFboCommand.setBindings({
        positionsTexture: points.currentPositionTexture,
      })

      const fillPass = this.device.beginRenderPass({
        framebuffer: this.sampledLinksFbo,
        clearColor: [-1, -1, -1, -1],
      })
      this.fillSampledLinksFboCommand.draw(fillPass)
      fillPass.end()
    }

    const pixels = readPixels(this.device, this.sampledLinksFbo)
    for (let i = 0; i < pixels.length / 4; i++) {
      const index = pixels[i * 4]
      const x = pixels[i * 4 + 1]
      const y = pixels[i * 4 + 2]
      const angle = pixels[i * 4 + 3]

      if (index !== undefined && index >= 0 && x !== undefined && y !== undefined && angle !== undefined) {
        indices.push(Math.round(index))
        positions.push(x, y)
        angles.push(angle)
      }
    }
    return { indices, positions, angles }
  }

  public findHoveredLine (): void {
    const { config, points, store } = this
    if (!points) return
    if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return
    if (!this.data.linksNumber || !this.store.isLinkHoveringEnabled) return
    if (!this.linkIndexFbo || !this.drawCurveCommand || !this.drawCurveIndexCommand || !this.drawLineUniformStore || !this.linkStatusTexture) return
    if (!this.linkIndexTexture || this.linkIndexTexture.destroyed) return

    const hasHighlighting = config.highlightedLinkIndices !== undefined

    // Update uniforms for index rendering
    this.drawLineUniformStore.setUniforms({
      drawLineUniforms: {
        transformationMatrix: store.transformationMatrix4x4,
        pointsTextureSize: store.pointsTextureSize,
        widthScale: config.linkWidthScale,
        linkArrowsSizeScale: config.linkArrowsSizeScale,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, [0, 0]),
        linkVisibilityDistanceRange: ensureVec2(config.linkVisibilityDistanceRange, [0, 0]),
        linkVisibilityMinTransparency: config.linkVisibilityMinTransparency,
        linkOpacity: config.linkOpacity,
        greyoutOpacity: config.linkGreyoutOpacity,
        curvedWeight: config.curvedLinkWeight,
        curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
        curvedLinkSegments: config.curvedLinks ? config.curvedLinkSegments : 1,
        scaleLinksOnZoom: config.scaleLinksOnZoom ? 1 : 0,
        maxPointSize: store.maxPointSize,
        renderMode: 1.0, // Index rendering for picking
        hoveredLinkIndex: store.hoveredLinkIndex ?? -1,
        hoveredLinkColor: ensureVec4(store.hoveredLinkColor, [-1, -1, -1, -1]),
        hoveredLinkWidthIncrease: config.hoveredLinkWidthIncrease,
        isLinkHighlightingActive: hasHighlighting ? 1 : 0,
        linkStatusTextureSize: this.linkStatusTextureSize,
        focusedLinkIndex: config.focusedLinkIndex ?? -1,
        focusedLinkWidthIncrease: config.focusedLinkWidthIncrease,
        linkMinPixelLength: config.linkMinPixelLength,
      },
      drawLineFragmentUniforms: {
        renderMode: 1.0, // Index rendering for picking
      },
    })

    // Update texture bindings dynamically — uniforms are shared, but we draw via
    // the index-specific Model which has blend: false so picking IDs aren't
    // corrupted by linkBlendMode='add'.
    this.drawCurveIndexCommand.setBindings({
      positionsTexture: points.currentPositionTexture,
      linkStatus: this.linkStatusTexture,
    })

    this.drawCurveIndexCommand.setInstanceCount(this.data.linksNumber ?? 0)

    // Render to index buffer for picking/hover detection
    const indexPass = this.device.beginRenderPass({
      framebuffer: this.linkIndexFbo,
      // Clear framebuffer to transparent black (luma.gl default would be opaque black)
      clearColor: [0, 0, 0, 0],
    })
    this.drawCurveIndexCommand.draw(indexPass)
    indexPass.end()

    if (this.hoveredLineIndexCommand && this.hoveredLineIndexFbo && this.hoveredLineIndexUniformStore) {
      this.hoveredLineIndexUniformStore.setUniforms({
        hoveredLineIndexUniforms: {
          mousePosition: ensureVec2(store.screenMousePosition, [0, 0]),
          screenSize: ensureVec2(store.screenSize, [0, 0]),
        },
      })

      // Update texture bindings dynamically
      this.hoveredLineIndexCommand.setBindings({
        linkIndexTexture: this.linkIndexTexture,
      })

      const hoverPass = this.device.beginRenderPass({
        framebuffer: this.hoveredLineIndexFbo,
      })
      this.hoveredLineIndexCommand.draw(hoverPass)
      hoverPass.end()
    }
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    // 1. Destroy Models FIRST (they destroy _gpuGeometry if exists, and _uniformStore)
    this.drawCurveCommand?.destroy()
    this.drawCurveIndexCommand?.destroy()
    this.drawCurveCommand = undefined
    this.drawCurveCommandInstanced?.destroy()
    this.drawCurveCommandInstanced = undefined
    this.precomputePipeline?.destroy()
    this.precomputePipeline = undefined
    this.precomputeShader?.destroy()
    this.precomputeShader = undefined
    this.hoveredLineIndexCommand?.destroy()
    this.hoveredLineIndexCommand = undefined
    this.fillSampledLinksFboCommand?.destroy()
    this.fillSampledLinksFboCommand = undefined

    // 2. Destroy Framebuffers (before textures they reference)
    if (this.linkIndexFbo && !this.linkIndexFbo.destroyed) {
      this.linkIndexFbo.destroy()
    }
    this.linkIndexFbo = undefined
    if (this.sampledLinksFbo && !this.sampledLinksFbo.destroyed) {
      this.sampledLinksFbo.destroy()
    }
    this.sampledLinksFbo = undefined
    if (this.hoveredLineIndexFbo && !this.hoveredLineIndexFbo.destroyed) {
      this.hoveredLineIndexFbo.destroy()
    }
    this.hoveredLineIndexFbo = undefined

    // 3. Destroy Textures
    if (this.linkIndexTexture && !this.linkIndexTexture.destroyed) {
      this.linkIndexTexture.destroy()
    }
    this.linkIndexTexture = undefined
    if (this.hoveredLineIndexTexture && !this.hoveredLineIndexTexture.destroyed) {
      this.hoveredLineIndexTexture.destroy()
    }
    this.hoveredLineIndexTexture = undefined
    if (this.linkStatusTexture && !this.linkStatusTexture.destroyed) {
      this.linkStatusTexture.destroy()
    }
    this.linkStatusTexture = undefined

    // 4. Destroy UniformStores (Models already destroyed their managed uniform buffers)
    this.drawLineUniformStore?.destroy()
    this.drawLineUniformStore = undefined
    this.hoveredLineIndexUniformStore?.destroy()
    this.hoveredLineIndexUniformStore = undefined
    this.fillSampledLinksUniformStore?.destroy()
    this.fillSampledLinksUniformStore = undefined

    // 5. Destroy Buffers (passed via attributes - NOT owned by Models, must destroy manually)
    if (this.pointABuffer && !this.pointABuffer.destroyed) {
      this.pointABuffer.destroy()
    }
    this.pointABuffer = undefined
    if (this.pointBBuffer && !this.pointBBuffer.destroyed) {
      this.pointBBuffer.destroy()
    }
    this.pointBBuffer = undefined
    if (this.colorBuffer && !this.colorBuffer.destroyed) {
      this.colorBuffer.destroy()
    }
    this.colorBuffer = undefined
    if (this.widthBuffer && !this.widthBuffer.destroyed) {
      this.widthBuffer.destroy()
    }
    this.widthBuffer = undefined
    if (this.arrowBuffer && !this.arrowBuffer.destroyed) {
      this.arrowBuffer.destroy()
    }
    this.arrowBuffer = undefined
    if (this.curveLineBuffer && !this.curveLineBuffer.destroyed) {
      this.curveLineBuffer.destroy()
    }
    this.curveLineBuffer = undefined
    if (this.linkIndexBuffer && !this.linkIndexBuffer.destroyed) {
      this.linkIndexBuffer.destroy()
    }
    this.linkIndexBuffer = undefined
    if (this.quadBuffer && !this.quadBuffer.destroyed) {
      this.quadBuffer.destroy()
    }
    this.quadBuffer = undefined
    if (this.lineInstanceBuffer && !this.lineInstanceBuffer.destroyed) {
      this.lineInstanceBuffer.destroy()
    }
    this.lineInstanceBuffer = undefined
    this.lineInstanceBufferLinksNumber = 0
  }

  // Creates a 1×1 placeholder texture for the linkStatus sampler if none exists.
  // luma.gl silently skips the draw call when any declared sampler is unbound,
  // so this ensures a valid binding is always available. The shader won't sample
  // the placeholder — the isLinkHighlightingActive uniform guards that branch.
  /**
   * Ensure `lineInstanceBuffer` is sized for the current linksNumber.
   * Per-link record is 112 bytes (7 vec4<f32>). Recreated when linksNumber
   * grows past the current allocation (we don't shrink).
   */
  private ensureLineInstanceBuffer (): void {
    const { device } = this
    const linksNumber = this.data.linksNumber ?? 0
    if (linksNumber <= 0) return
    if (this.lineInstanceBuffer && this.lineInstanceBufferLinksNumber === linksNumber) return
    if (this.lineInstanceBuffer && !this.lineInstanceBuffer.destroyed) {
      this.lineInstanceBuffer.destroy()
    }
    // 112 = 7 vec4<f32> × 4 floats × 4 bytes — must match the WGSL struct
    // in precompute-line-instances.compute.wgsl.ts. If you change the struct,
    // change this constant.
    const bytesPerInstance = 112
    this.lineInstanceBuffer = device.createBuffer({
      byteLength: linksNumber * bytesPerInstance,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    })
    this.lineInstanceBufferLinksNumber = linksNumber
  }

  private initPrecomputePipeline (): void {
    const { device } = this
    if (this.precomputePipeline) return
    if (!this.drawLineUniformStore) return

    this.precomputeShader = device.createShader({
      stage: 'compute',
      source: precomputeLineInstancesWgsl(),
    })

    // Bind-group layout: 1 uniform + 7 read-only storage buffers (per-instance
    // attributes + positions) + 1 read_write storage output. luma 9.2.6's
    // getShaderLayoutFromWGSL doesn't walk compute entries, so the name→
    // location mapping is hand-rolled (same as force-spring.compute path).
    const bindings: BindingDeclaration[] = [
      { type: 'uniform', name: 'drawLine', group: 0, location: 0 },
      { type: 'read-only-storage', name: 'positions', group: 0, location: 1 },
      { type: 'read-only-storage', name: 'pointAArr', group: 0, location: 2 },
      { type: 'read-only-storage', name: 'pointBArr', group: 0, location: 3 },
      { type: 'read-only-storage', name: 'colorArr', group: 0, location: 4 },
      { type: 'read-only-storage', name: 'widthArr', group: 0, location: 5 },
      { type: 'read-only-storage', name: 'arrowArr', group: 0, location: 6 },
      { type: 'read-only-storage', name: 'linkIndexArr', group: 0, location: 7 },
      { type: 'storage', name: 'instances', group: 0, location: 8 },
    ]

    this.precomputePipeline = device.createComputePipeline({
      shader: this.precomputeShader,
      entryPoint: 'computeMain',
      shaderLayout: { bindings },
    })
  }

  private initDrawCurveInstancedModel (): void {
    const { device, config } = this
    if (this.drawCurveCommandInstanced) return
    if (!this.drawLineUniformStore) return

    // Thin vertex shader: reads precomputed per-instance state from the
    // `instances` storage buffer, evaluates only the actually-per-vertex
    // conic Bezier math, transforms to clip space. The 4× redundant
    // instance-uniform work that the legacy shader does on each quad corner
    // is moved into the per-link compute pre-pass.
    this.drawCurveCommandInstanced = new Model(device, {
      source: drawCurveLineInstancedWgslSource(),
      topology: 'triangle-strip',
      colorAttachmentFormats: ['bgra8unorm'],
      vertexCount: this.curveLineGeometry?.length ?? 0,
      attributes: {
        ...this.curveLineBuffer && { position: this.curveLineBuffer },
      },
      bufferLayout: [
        { name: 'position', format: 'float32x2' },
      ],
      defines: {
        USE_UNIFORM_BUFFERS: true,
      },
      bindings: {
        drawLine: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
        drawLineFragment: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
      },
      parameters: {
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
      },
    })
  }

  /**
   * Dispatch the per-link compute pre-pass that fills `lineInstanceBuffer`
   * with all the state the visible vertex shader needs. One thread per link,
   * 64-wide workgroups. Called once per frame just before the canvas pass.
   */
  private runPrecompute (): void {
    const { device, points } = this
    if (!this.precomputePipeline || !this.lineInstanceBuffer) return
    if (!this.drawLineUniformStore) return
    if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return
    if (!this.pointABuffer || !this.pointBBuffer) return
    if (!this.colorBuffer || !this.widthBuffer) return
    if (!this.arrowBuffer || !this.linkIndexBuffer) return

    const linksNumber = this.data.linksNumber ?? 0
    if (linksNumber <= 0) return

    const bindings: Record<string, Binding> = {
      drawLine: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
      positions: points.positionStorageBuffer,
      pointAArr: this.pointABuffer,
      pointBArr: this.pointBBuffer,
      colorArr: this.colorBuffer,
      widthArr: this.widthBuffer,
      arrowArr: this.arrowBuffer,
      linkIndexArr: this.linkIndexBuffer,
      instances: this.lineInstanceBuffer,
    }
    this.precomputePipeline.setBindings(bindings)

    const workgroups = Math.ceil(linksNumber / 64)
    const pass = device.beginComputePass({ id: 'lines.precompute' })
    pass.setPipeline(this.precomputePipeline)
    pass.dispatch(workgroups, 1, 1)
    pass.end()
  }

  /**
   * Write the per-frame uniforms that both the compute pre-pass and the
   * visible vertex shader need. Idempotent — calling twice per frame just
   * rewrites the same managed uniform buffer with the same values. Called
   * from `precompute()` (so the compute pass sees current state) and from
   * `draw()` (so the WebGL2 path still works without a separate pre-call).
   */
  private updateDrawLineUniforms (): void {
    const { config, store } = this
    if (!this.drawLineUniformStore) return

    const hasHighlighting = config.highlightedLinkIndices !== undefined
    this.drawLineUniformStore.setUniforms({
      drawLineUniforms: {
        transformationMatrix: store.transformationMatrix4x4,
        pointsTextureSize: store.pointsTextureSize,
        widthScale: config.linkWidthScale,
        linkArrowsSizeScale: config.linkArrowsSizeScale,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, [0, 0]),
        linkVisibilityDistanceRange: ensureVec2(config.linkVisibilityDistanceRange, [0, 0]),
        linkVisibilityMinTransparency: config.linkVisibilityMinTransparency,
        linkOpacity: config.linkOpacity,
        greyoutOpacity: config.linkGreyoutOpacity,
        curvedWeight: config.curvedLinkWeight,
        curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
        curvedLinkSegments: config.curvedLinks ? config.curvedLinkSegments : 1,
        scaleLinksOnZoom: config.scaleLinksOnZoom ? 1 : 0,
        maxPointSize: store.maxPointSize,
        renderMode: 0.0,
        hoveredLinkIndex: store.hoveredLinkIndex ?? -1,
        hoveredLinkColor: ensureVec4(store.hoveredLinkColor, [-1, -1, -1, -1]),
        hoveredLinkWidthIncrease: config.hoveredLinkWidthIncrease,
        isLinkHighlightingActive: hasHighlighting ? 1 : 0,
        linkStatusTextureSize: this.linkStatusTextureSize,
        focusedLinkIndex: config.focusedLinkIndex ?? -1,
        focusedLinkWidthIncrease: config.focusedLinkWidthIncrease,
        linkMinPixelLength: config.linkMinPixelLength,
      },
      drawLineFragmentUniforms: {
        renderMode: 0.0,
      },
    })
  }

  private ensureLinkStatusPlaceholder (): void {
    if (this.linkStatusTexture && !this.linkStatusTexture.destroyed) return
    this.linkStatusTexture = this.device.createTexture({
      width: 1,
      height: 1,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      data: new Float32Array(4).fill(0),
    })
    this.linkStatusTextureSize = 0
  }
}
