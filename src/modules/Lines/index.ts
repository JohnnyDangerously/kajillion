import { Framebuffer, Buffer, ComputePipeline, type BindingDeclaration, Shader, Texture, UniformStore, RenderPass } from '@luma.gl/core'
import { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'
import type { Mat4Array } from '@/graph/modules/Store'
import { conicParametricCurveModule } from '@/graph/modules/Lines/conic-curve-module'
import drawLineFrag from '@/graph/modules/Lines/draw-curve-line.frag?raw'
import drawLineVert from '@/graph/modules/Lines/draw-curve-line.vert?raw'
import drawLineWgsl from '@/graph/modules/Lines/draw-curve-line.wgsl?raw'
import drawStraightLineWgsl from '@/graph/modules/Lines/draw-straight-line.wgsl?raw'
import { clearVisibleLinesComputeWgsl } from '@/graph/modules/Lines/clear-visible-lines.compute.wgsl'
import { cullVisibleLinesComputeWgsl } from '@/graph/modules/Lines/cull-visible-lines.compute.wgsl'
import { drawCulledCurveLinesWgsl } from '@/graph/modules/Lines/draw-culled-curve-lines.wgsl'
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

type LineDrawUniforms = {
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
  linkBundlingStrength: number;
  linkBundlingCellSize: number;
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
  linkLodStrength: number;
  linkLodZoomRange: [number, number];
  linkLodMinSampleRate: number;
  linkLodWidthCompensation: number;
  linkLodOpacityCompensation: number;
  renderPositionMix: number;
}

type LineDrawFragmentUniforms = {
  renderMode: number;
  hasArrowedLinks: number;
}

const IDENTITY_MAT4: Mat4Array = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const ZERO_VEC2: [number, number] = [0, 0]
const DISABLED_COLOR_VEC4: [number, number, number, number] = [-1, -1, -1, -1]
const DEFAULT_LINK_LOD_ZOOM_RANGE: [number, number] = [0.10, 0.60]

interface WebGpuBufferAccess {
  handle?: GPUBuffer;
}

interface WebGpuRenderPassAccess {
  handle?: GPURenderPassEncoder;
}

interface IndirectRenderPipelineAccess {
  handle?: GPURenderPipeline;
  setBindings: (bindings: Record<string, unknown>, options?: { disableWarnings?: boolean }) => void;
  _getBindGroup?: () => GPUBindGroup | null;
}

interface IndirectModelAccess {
  predraw: () => void;
  pipeline: IndirectRenderPipelineAccess;
  vertexArray: {
    bindBeforeRender: (renderPass: RenderPass) => void;
    unbindAfterRender: (renderPass: RenderPass) => void;
  };
  _areBindingsLoading?: () => unknown;
  _getBindings?: () => Record<string, unknown>;
  _updatePipeline?: () => IndirectRenderPipelineAccess;
}

export class Lines extends CoreModule {
  public linkIndexFbo: Framebuffer | undefined
  public hoveredLineIndexFbo: Framebuffer | undefined
  public sampledLinksFbo: Framebuffer | undefined
  public linkStatusTexture: Texture | undefined
  // Cached at updateArrow() time. Lets the line fragment shader skip the
  // arrow-AA branch entirely when no link in the dataset is arrowed.
  public hasArrowedLinks = false
  private linkStatusTextureSize = 0
  private drawCurveCommand: Model | undefined
  private drawCulledCurveCommand: Model | undefined
  private drawCurveIndexCommand: Model | undefined
  private hoveredLineIndexCommand: Model | undefined
  private drawCurveBindingsBackend: string | undefined
  private drawCurveBindingsPosition: Buffer | Texture | undefined
  private drawCurveBindingsPreviousPosition: Buffer | undefined
  private drawCurveBindingsLinkStatus: Texture | undefined
  private isCulledLineDrawPrepared = false
  private visibleLineIndexBuffer: Buffer | undefined
  private visibleLineIndirectBuffer: Buffer | undefined
  private activeLineMaskBuffer: Buffer | undefined
  private activeLineMaskCapacity = 0
  private visibleLineCapacity = 0
  private clearVisibleLinesShader: Shader | undefined

  private clearVisibleLinesPipeline: ComputePipeline | undefined

  private clearVisibleLinesUniformStore: UniformStore<{
    clearLineUniforms: {
      vertexCount: number;
    };
  }> | undefined

  private clearVisibleLinesUniformBuffer: Buffer | undefined

  private cullVisibleLinesShader: Shader | undefined

  private cullVisibleLinesPipeline: ComputePipeline | undefined

  private cullVisibleLinesUniformStore: UniformStore<{
    cullLineUniforms: {
      transformationMatrix: Mat4Array;
      linkCount: number;
      pointsTextureSize: number;
      spaceSize: number;
      screenSize: [number, number];
      curvedLinkControlPointDistance: number;
    };
  }> | undefined

  private cullVisibleLinesUniformBuffer: Buffer | undefined

  private drawCurveIndexBindingsBackend: string | undefined
  private drawCurveIndexBindingsPosition: Buffer | Texture | undefined
  private drawCurveIndexBindingsPreviousPosition: Buffer | undefined
  private drawCurveIndexBindingsLinkStatus: Texture | undefined
  private hoveredLineBindingsName: string | undefined
  private hoveredLineBindingsUniformBuffer: Buffer | undefined
  private hoveredLineBindingsIndexTexture: Texture | undefined
  private readonly drawLineUniformScratch: LineDrawUniforms = {
    transformationMatrix: IDENTITY_MAT4,
    pointsTextureSize: 0,
    widthScale: 1,
    linkArrowsSizeScale: 1,
    spaceSize: 0,
    screenSize: ZERO_VEC2,
    linkVisibilityDistanceRange: ZERO_VEC2,
    linkVisibilityMinTransparency: 0,
    linkOpacity: 1,
    greyoutOpacity: 1,
    curvedWeight: 0,
    curvedLinkControlPointDistance: 0,
    curvedLinkSegments: 1,
    linkBundlingStrength: 0,
    linkBundlingCellSize: 0,
    scaleLinksOnZoom: 0,
    maxPointSize: 0,
    renderMode: 0,
    hoveredLinkIndex: -1,
    hoveredLinkColor: DISABLED_COLOR_VEC4,
    hoveredLinkWidthIncrease: 0,
    isLinkHighlightingActive: 0,
    linkStatusTextureSize: 0,
    focusedLinkIndex: -1,
    focusedLinkWidthIncrease: 0,
    linkMinPixelLength: 0,
    linkLodStrength: 0,
    linkLodZoomRange: DEFAULT_LINK_LOD_ZOOM_RANGE,
    linkLodMinSampleRate: 1,
    linkLodWidthCompensation: 1,
    linkLodOpacityCompensation: 1,
    renderPositionMix: 1,
  }

  private readonly drawLineFragmentUniformScratch: LineDrawFragmentUniforms = {
    renderMode: 0,
    hasArrowedLinks: 0,
  }

  private readonly drawLineUniformPayload = {
    drawLineUniforms: this.drawLineUniformScratch,
    drawLineFragmentUniforms: this.drawLineFragmentUniformScratch,
  }

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
      linkBundlingStrength: number;
      linkBundlingCellSize: number;
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
      linkLodStrength: number;
      linkLodZoomRange: [number, number];
      linkLodMinSampleRate: number;
      linkLodWidthCompensation: number;
      linkLodOpacityCompensation: number;
      renderPositionMix: number;
    };
    drawLineFragmentUniforms: {
      renderMode: number;
      hasArrowedLinks: number;
    };
  }> | undefined

  private hoveredLineIndexUniformStore: UniformStore<{
    hoveredLineIndexUniforms: {
      mousePosition: [number, number];
      screenSize: [number, number];
    };
  }> | undefined

  private hoveredLineIndexUniformBuffer: Buffer | undefined

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
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_SRC | Texture.COPY_DST,
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
      usage: this.getLineAttributeBufferUsage(),
    })
    this.pointBBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber * 2),
      usage: this.getLineAttributeBufferUsage(),
    })
    this.colorBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber * 4),
      usage: this.getLineAttributeBufferUsage(),
    })
    this.widthBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: this.getLineAttributeBufferUsage(),
    })
    this.arrowBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: this.getLineAttributeBufferUsage(),
    })
    this.linkIndexBuffer ||= device.createBuffer({
      data: new Float32Array(linksNumber),
      usage: this.getLineAttributeBufferUsage(),
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
          linkBundlingStrength: 'f32',
          linkBundlingCellSize: 'f32',
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
          linkLodStrength: 'f32',
          linkLodZoomRange: 'vec2<f32>',
          linkLodMinSampleRate: 'f32',
          linkLodWidthCompensation: 'f32',
          linkLodOpacityCompensation: 'f32',
          renderPositionMix: 'f32',
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
          curvedLinkSegments: this.getEffectiveLineSegments(),
          linkBundlingStrength: config.linkBundlingStrength,
          linkBundlingCellSize: config.linkBundlingCellSize,
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
          linkLodStrength: this.getEffectiveLinkLodStrength(),
          linkLodZoomRange: ensureVec2(config.linkLodZoomRange, [0.10, 0.60]),
          linkLodMinSampleRate: config.linkLodMinSampleRate,
          linkLodWidthCompensation: config.linkLodWidthCompensation,
          linkLodOpacityCompensation: config.linkLodOpacityCompensation,
          renderPositionMix: 1,
        },
      },
      drawLineFragmentUniforms: {
        uniformTypes: {
          renderMode: 'f32',
          hasArrowedLinks: 'f32',
        },
        defaultUniforms: {
          renderMode: 0.0,
          hasArrowedLinks: 0,
        },
      },
    })

    const lineWgsl = config.curvedLinks ? drawLineWgsl : drawStraightLineWgsl
    const lineModules = config.curvedLinks ? [conicParametricCurveModule] : []

    this.drawCurveCommand ||= new Model(device, {
      source: lineWgsl,
      vs: drawLineVert,
      fs: drawLineFrag,
      modules: lineModules,
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

    if (device.info?.type === 'webgpu') {
      this.drawCulledCurveCommand ||= new Model(device, {
        source: drawCulledCurveLinesWgsl(),
        topology: 'triangle-strip',
        colorAttachmentFormats: ['bgra8unorm'],
        vertexCount: this.curveLineGeometry?.length ?? 0,
        instanceCount: 0,
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
          drawLineUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineUniforms'),
          drawLineFragmentUniforms: this.drawLineUniformStore.getManagedUniformBuffer(device, 'drawLineFragmentUniforms'),
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

    // Picking pass needs OPAQUE writes to the link-index framebuffer regardless of
    // the user-configured linkBlendMode. Additive blending here would sum link indices
    // across overlapping links and produce garbage IDs on hover/click. We use a separate
    // Model with `blend: false` so this stays correct when the visible pass uses 'add'.
    this.drawCurveIndexCommand ||= new Model(device, {
      vs: drawLineVert,
      source: lineWgsl,
      fs: drawLineFrag,
      modules: lineModules,
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
      usage: Buffer.VERTEX | Buffer.COPY_DST,
    })

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

    const hoveredLineUniformBindingName = device.info?.type === 'webgpu' ? 'hoveredLine' : 'hoveredLineIndexUniforms'
    if (!this.hoveredLineIndexUniformBuffer || this.hoveredLineIndexUniformBuffer.destroyed) {
      this.hoveredLineIndexUniformBuffer = this.hoveredLineIndexUniformStore.getManagedUniformBuffer(device, 'hoveredLineIndexUniforms')
    }
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
        [hoveredLineUniformBindingName]: this.hoveredLineIndexUniformBuffer,
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

  public draw (renderPass: RenderPass, usePreparedCulledDraw = false): void {
    const { config, points } = this
    if (!points) return
    if (!points.currentPositionTexture || points.currentPositionTexture.destroyed) return
    if (!this.pointABuffer || !this.pointBBuffer) this.updatePointsBuffer()
    if (!this.colorBuffer) this.updateColor()
    if (!this.widthBuffer) this.updateWidth()
    if (!this.arrowBuffer) this.updateArrow()
    if (!this.curveLineGeometry) this.updateCurveLineGeometry()
    if (!this.drawCurveCommand || !this.drawLineUniformStore || !this.linkStatusTexture) return

    const hasHighlighting = config.highlightedLinkIndices !== undefined

    this.setDrawLineUniforms(0, this.getEffectiveLinkLodStrength(), hasHighlighting)

    if (usePreparedCulledDraw && this.isCulledLineDrawPrepared && this.drawCulledLinesIndirect(renderPass)) {
      return
    }

    if (!this.bindDrawCurveCommandIfNeeded(points.currentPositionTexture, points.positionStorageBuffer, this.linkStatusTexture)) return

    // Update instance count
    this.drawCurveCommand.setInstanceCount(this.data.linksNumber ?? 0)

    // Render normal links
    this.drawCurveCommand.draw(renderPass)
  }

  public prepareGpuCulledDraw (): boolean {
    this.isCulledLineDrawPrepared = false
    const { config, data, points, store } = this
    if (this.device.info?.type !== 'webgpu') return false
    const hasActiveFilter = config.activeLinkIndices !== undefined
    if (!data.linksNumber || (!hasActiveFilter && data.linksNumber < 10000)) return false
    if (!store.screenSize || store.screenSize[0] === 0 || store.screenSize[1] === 0) return false
    if (!store.pointsTextureSize) return false
    if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return false
    if (!this.pointABuffer || !this.pointBBuffer) this.updatePointsBuffer()
    if (!this.pointABuffer || this.pointABuffer.destroyed) return false
    if (!this.pointBBuffer || this.pointBBuffer.destroyed) return false
    if (!this.curveLineGeometry) this.updateCurveLineGeometry()
    const vertexCount = this.curveLineGeometry?.length ?? 0
    if (vertexCount === 0) return false

    const scale = Math.abs(store.transformationMatrix4x4[0] ?? 1)
    if (!hasActiveFilter && scale < 1.08) return false

    this.ensureVisibleLineBuffers(data.linksNumber)
    this.updateActiveLinkMask()
    this.initVisibleLineCullPipelines()
    if (
      !this.visibleLineIndexBuffer ||
      !this.visibleLineIndirectBuffer ||
      !this.activeLineMaskBuffer ||
      !this.clearVisibleLinesPipeline ||
      !this.cullVisibleLinesPipeline ||
      !this.clearVisibleLinesUniformStore ||
      !this.clearVisibleLinesUniformBuffer ||
      !this.cullVisibleLinesUniformStore ||
      !this.cullVisibleLinesUniformBuffer
    ) {
      return false
    }

    this.clearVisibleLinesUniformStore.setUniforms({
      clearLineUniforms: {
        vertexCount,
      },
    })
    this.clearVisibleLinesPipeline.setBindings({
      clearLineUniforms: this.clearVisibleLinesUniformBuffer,
      indirectArgs: this.visibleLineIndirectBuffer,
    })
    let pass = this.device.beginComputePass({ id: 'lines.visible.clear' })
    pass.setPipeline(this.clearVisibleLinesPipeline)
    pass.dispatch(1, 1, 1)
    pass.end()

    this.cullVisibleLinesUniformStore.setUniforms({
      cullLineUniforms: {
        transformationMatrix: store.transformationMatrix4x4,
        linkCount: data.linksNumber,
        pointsTextureSize: store.pointsTextureSize,
        spaceSize: store.adjustedSpaceSize,
        screenSize: ensureVec2(store.screenSize, ZERO_VEC2),
        curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
      },
    })
    this.cullVisibleLinesPipeline.setBindings({
      cullLineUniforms: this.cullVisibleLinesUniformBuffer,
      positions: points.positionStorageBuffer,
      pointAArr: this.pointABuffer,
      pointBArr: this.pointBBuffer,
      visibleIndices: this.visibleLineIndexBuffer,
      indirectArgs: this.visibleLineIndirectBuffer,
      activeMask: this.activeLineMaskBuffer,
    })
    pass = this.device.beginComputePass({ id: 'lines.visible.cull' })
    pass.setPipeline(this.cullVisibleLinesPipeline)
    pass.dispatch(Math.ceil(data.linksNumber / 64), 1, 1)
    pass.end()

    this.isCulledLineDrawPrepared = true
    return true
  }

  public updateLinkIndexFbo (): void {
    const { device, store } = this

    if (device.info?.type === 'webgpu') return

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
        usage: this.getLineAttributeBufferUsage(),
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
        usage: this.getLineAttributeBufferUsage(),
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
        usage: this.getLineAttributeBufferUsage(),
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
        usage: this.getLineAttributeBufferUsage(),
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
          usage: this.getLineAttributeBufferUsage(),
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
        usage: this.getLineAttributeBufferUsage(),
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
          usage: this.getLineAttributeBufferUsage(),
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
    // Scan once per upload to expose the all-zero (no-arrows) case to the
    // fragment shader as a dead-strippable uniform flag.
    let anyArrow = false
    for (const v of arrowData) {
      if (v !== 0) { anyArrow = true; break }
    }
    this.hasArrowedLinks = anyArrow

    if (!this.arrowBuffer) {
      this.arrowBuffer = device.createBuffer({
        data: arrowData,
        usage: this.getLineAttributeBufferUsage(),
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
          usage: this.getLineAttributeBufferUsage(),
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
    const { device } = this
    this.curveLineGeometry = getCurveLineGeometry(this.getEffectiveLineSegments())

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
        usage: Buffer.VERTEX | Buffer.COPY_DST,
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
    if (this.drawCulledCurveCommand) {
      this.drawCulledCurveCommand.setAttributes({
        position: this.curveLineBuffer,
      })
      this.drawCulledCurveCommand.setVertexCount(this.curveLineGeometry.length)
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
          curvedLinkSegments: this.getEffectiveLineSegments(),
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
          curvedLinkSegments: this.getEffectiveLineSegments(),
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

    this.setDrawLineUniforms(1, 0, hasHighlighting)

    // Update texture bindings dynamically — uniforms are shared, but we draw via
    // the index-specific Model which has blend: false so picking IDs aren't
    // corrupted by linkBlendMode='add'.
    if (!this.bindDrawCurveIndexCommandIfNeeded(points.currentPositionTexture, points.positionStorageBuffer, this.linkStatusTexture)) return

    this.drawCurveIndexCommand.setInstanceCount(this.data.linksNumber ?? 0)

    // Render to index buffer for picking/hover detection
    const indexPass = this.device.beginRenderPass({
      framebuffer: this.linkIndexFbo,
      // Clear framebuffer to transparent black (luma.gl default would be opaque black)
      clearColor: [0, 0, 0, 0],
      parameters: {
        scissorRect: this.getHoverPickScissorRect(),
      },
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
      const hoveredLineUniformBindingName = this.device.info?.type === 'webgpu' ? 'hoveredLine' : 'hoveredLineIndexUniforms'
      if (!this.hoveredLineIndexUniformBuffer || this.hoveredLineIndexUniformBuffer.destroyed) {
        this.hoveredLineIndexUniformBuffer = this.hoveredLineIndexUniformStore.getManagedUniformBuffer(this.device, 'hoveredLineIndexUniforms')
      }
      this.bindHoveredLineCommandIfNeeded(hoveredLineUniformBindingName, this.hoveredLineIndexUniformBuffer, this.linkIndexTexture)

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
    this.drawCulledCurveCommand?.destroy()
    this.drawCurveIndexCommand?.destroy()
    this.drawCurveCommand = undefined
    this.drawCulledCurveCommand = undefined
    this.hoveredLineIndexCommand?.destroy()
    this.hoveredLineIndexCommand = undefined
    this.hoveredLineIndexUniformBuffer = undefined
    this.drawCurveBindingsBackend = undefined
    this.drawCurveBindingsPosition = undefined
    this.drawCurveBindingsPreviousPosition = undefined
    this.drawCurveBindingsLinkStatus = undefined
    this.drawCurveIndexBindingsBackend = undefined
    this.drawCurveIndexBindingsPosition = undefined
    this.drawCurveIndexBindingsPreviousPosition = undefined
    this.drawCurveIndexBindingsLinkStatus = undefined
    this.hoveredLineBindingsName = undefined
    this.hoveredLineBindingsUniformBuffer = undefined
    this.hoveredLineBindingsIndexTexture = undefined
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
    if (this.visibleLineIndexBuffer && !this.visibleLineIndexBuffer.destroyed) {
      this.visibleLineIndexBuffer.destroy()
    }
    this.visibleLineIndexBuffer = undefined
    if (this.visibleLineIndirectBuffer && !this.visibleLineIndirectBuffer.destroyed) {
      this.visibleLineIndirectBuffer.destroy()
    }
    this.visibleLineIndirectBuffer = undefined
    this.visibleLineCapacity = 0
    this.isCulledLineDrawPrepared = false
    if (this.quadBuffer && !this.quadBuffer.destroyed) {
      this.quadBuffer.destroy()
    }
    this.quadBuffer = undefined
  }

  private getEffectiveLineSegments (): number {
    return this.config.curvedLinks || this.config.linkBundlingStrength > 0
      ? this.config.curvedLinkSegments
      : 1
  }

  private getLineAttributeBufferUsage (): number {
    const webgpuStorage = this.device.info?.type === 'webgpu' ? Buffer.STORAGE : 0
    return Buffer.VERTEX | Buffer.COPY_DST | webgpuStorage
  }

  private getEffectiveLinkLodStrength (): number {
    return this.config.renderLodMode === 'exact' ? 0 : this.config.linkLodStrength
  }

  private ensureVisibleLineBuffers (linkCount: number): void {
    if (
      this.visibleLineIndexBuffer &&
      this.visibleLineIndirectBuffer &&
      !this.visibleLineIndexBuffer.destroyed &&
      !this.visibleLineIndirectBuffer.destroyed &&
      this.visibleLineCapacity >= linkCount
    ) {
      return
    }

    if (this.visibleLineIndexBuffer && !this.visibleLineIndexBuffer.destroyed) {
      this.visibleLineIndexBuffer.destroy()
    }
    if (this.visibleLineIndirectBuffer && !this.visibleLineIndirectBuffer.destroyed) {
      this.visibleLineIndirectBuffer.destroy()
    }
    this.visibleLineCapacity = linkCount
    this.visibleLineIndexBuffer = this.device.createBuffer({
      byteLength: linkCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST | Buffer.COPY_SRC,
    })
    this.visibleLineIndirectBuffer = this.device.createBuffer({
      data: new Uint32Array([this.curveLineGeometry?.length ?? 4, 0, 0, 0]),
      usage: Buffer.STORAGE | Buffer.INDIRECT | Buffer.COPY_DST | Buffer.COPY_SRC,
    })
  }

  public updateActiveLinkMask (): void {
    const linkCount = this.data.linksNumber ?? 0
    if (this.device.info?.type !== 'webgpu' || linkCount === 0) return
    const expectedBytes = linkCount * Uint32Array.BYTES_PER_ELEMENT
    if (!this.activeLineMaskBuffer || this.activeLineMaskBuffer.destroyed || this.activeLineMaskCapacity < linkCount) {
      if (this.activeLineMaskBuffer && !this.activeLineMaskBuffer.destroyed) {
        this.activeLineMaskBuffer.destroy()
      }
      this.activeLineMaskBuffer = this.device.createBuffer({
        byteLength: expectedBytes,
        usage: Buffer.STORAGE | Buffer.COPY_DST,
      })
      this.activeLineMaskCapacity = linkCount
    }
    const mask = new Uint32Array(linkCount)
    const activeLinkIndices = this.config.activeLinkIndices
    if (activeLinkIndices === undefined) {
      mask.fill(1)
    } else {
      for (const index of activeLinkIndices) {
        if (index >= 0 && index < linkCount) mask[index] = 1
      }
    }
    this.activeLineMaskBuffer.write(mask)
  }

  private initVisibleLineCullPipelines (): void {
    if (this.device.info?.type !== 'webgpu') return
    this.clearVisibleLinesUniformStore ||= new UniformStore({
      clearLineUniforms: {
        uniformTypes: {
          vertexCount: 'u32',
        },
        defaultUniforms: {
          vertexCount: this.curveLineGeometry?.length ?? 0,
        },
      },
    })
    this.clearVisibleLinesUniformBuffer ||= this.clearVisibleLinesUniformStore.getManagedUniformBuffer(this.device, 'clearLineUniforms')

    this.clearVisibleLinesShader ||= this.device.createShader({
      stage: 'compute',
      source: clearVisibleLinesComputeWgsl(),
    })
    this.clearVisibleLinesPipeline ||= this.device.createComputePipeline({
      shader: this.clearVisibleLinesShader,
      entryPoint: 'computeMain',
      shaderLayout: {
        bindings: [
          { type: 'uniform', name: 'clearLineUniforms', group: 0, location: 0 },
          { type: 'storage', name: 'indirectArgs', group: 0, location: 1 },
        ],
      },
    })

    this.cullVisibleLinesUniformStore ||= new UniformStore({
      cullLineUniforms: {
        uniformTypes: {
          transformationMatrix: 'mat4x4<f32>',
          linkCount: 'u32',
          pointsTextureSize: 'f32',
          spaceSize: 'f32',
          screenSize: 'vec2<f32>',
          curvedLinkControlPointDistance: 'f32',
        },
        defaultUniforms: {
          transformationMatrix: this.store.transformationMatrix4x4,
          linkCount: this.data.linksNumber ?? 0,
          pointsTextureSize: this.store.pointsTextureSize ?? 0,
          spaceSize: this.store.adjustedSpaceSize,
          screenSize: ensureVec2(this.store.screenSize, ZERO_VEC2),
          curvedLinkControlPointDistance: this.config.curvedLinkControlPointDistance,
        },
      },
    })
    this.cullVisibleLinesUniformBuffer ||= this.cullVisibleLinesUniformStore.getManagedUniformBuffer(this.device, 'cullLineUniforms')

    this.cullVisibleLinesShader ||= this.device.createShader({
      stage: 'compute',
      source: cullVisibleLinesComputeWgsl(),
    })
    const bindings: BindingDeclaration[] = [
      { type: 'uniform', name: 'cullLineUniforms', group: 0, location: 0 },
      { type: 'storage', name: 'positions', group: 0, location: 1 },
      { type: 'storage', name: 'pointAArr', group: 0, location: 2 },
      { type: 'storage', name: 'pointBArr', group: 0, location: 3 },
      { type: 'storage', name: 'visibleIndices', group: 0, location: 4 },
      { type: 'storage', name: 'indirectArgs', group: 0, location: 5 },
      { type: 'storage', name: 'activeMask', group: 0, location: 6 },
    ]
    this.cullVisibleLinesPipeline ||= this.device.createComputePipeline({
      shader: this.cullVisibleLinesShader,
      entryPoint: 'computeMain',
      shaderLayout: { bindings },
    })
  }

  private drawCulledLinesIndirect (renderPass: RenderPass): boolean {
    const { points } = this
    if (!this.drawCulledCurveCommand || !this.drawLineUniformStore || !this.linkStatusTexture) return false
    if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return false
    if (!this.pointABuffer || this.pointABuffer.destroyed) return false
    if (!this.pointBBuffer || this.pointBBuffer.destroyed) return false
    if (!this.colorBuffer || this.colorBuffer.destroyed) return false
    if (!this.widthBuffer || this.widthBuffer.destroyed) return false
    if (!this.arrowBuffer || this.arrowBuffer.destroyed) return false
    if (!this.linkIndexBuffer || this.linkIndexBuffer.destroyed) return false
    if (!this.visibleLineIndexBuffer || this.visibleLineIndexBuffer.destroyed) return false
    if (!this.visibleLineIndirectBuffer || this.visibleLineIndirectBuffer.destroyed) return false

    this.drawCulledCurveCommand.setBindings({
      drawLineUniforms: this.drawLineUniformStore.getManagedUniformBuffer(this.device, 'drawLineUniforms'),
      drawLineFragmentUniforms: this.drawLineUniformStore.getManagedUniformBuffer(this.device, 'drawLineFragmentUniforms'),
      positions: points.positionStorageBuffer,
      linkStatus: this.linkStatusTexture,
      pointAArr: this.pointABuffer,
      pointBArr: this.pointBBuffer,
      colorArr: this.colorBuffer,
      widthArr: this.widthBuffer,
      arrowArr: this.arrowBuffer,
      linkIndexArr: this.linkIndexBuffer,
      visibleIndices: this.visibleLineIndexBuffer,
    })
    return this.drawModelIndirect(this.drawCulledCurveCommand, renderPass, this.visibleLineIndirectBuffer)
  }

  private drawModelIndirect (model: Model, renderPass: RenderPass, indirectBuffer: Buffer): boolean {
    const modelAccess = model as unknown as IndirectModelAccess
    const webPass = renderPass as unknown as WebGpuRenderPassAccess
    const webBuffer = indirectBuffer as unknown as WebGpuBufferAccess
    if (!webPass.handle || !webBuffer.handle) return false
    if (modelAccess._areBindingsLoading?.()) return false
    if (!modelAccess._getBindings || !modelAccess._updatePipeline) return false

    modelAccess.predraw()
    modelAccess.pipeline = modelAccess._updatePipeline()
    modelAccess.pipeline.setBindings(modelAccess._getBindings(), { disableWarnings: true })
    if (!modelAccess.pipeline.handle) return false

    webPass.handle.setPipeline(modelAccess.pipeline.handle)
    const bindGroup = modelAccess.pipeline._getBindGroup?.()
    if (bindGroup) webPass.handle.setBindGroup(0, bindGroup)
    modelAccess.vertexArray.bindBeforeRender(renderPass)
    webPass.handle.drawIndirect(webBuffer.handle, 0)
    modelAccess.vertexArray.unbindAfterRender(renderPass)
    return true
  }

  private setDrawLineUniforms (renderMode: number, linkLodStrength: number, hasHighlighting: boolean): void {
    if (!this.drawLineUniformStore) return

    const { config, store } = this
    const drawLineUniforms = this.drawLineUniformScratch
    drawLineUniforms.transformationMatrix = store.transformationMatrix4x4
    drawLineUniforms.pointsTextureSize = store.pointsTextureSize
    drawLineUniforms.widthScale = config.linkWidthScale
    drawLineUniforms.linkArrowsSizeScale = config.linkArrowsSizeScale
    drawLineUniforms.spaceSize = store.adjustedSpaceSize
    drawLineUniforms.screenSize = ensureVec2(store.screenSize, ZERO_VEC2)
    drawLineUniforms.linkVisibilityDistanceRange = ensureVec2(config.linkVisibilityDistanceRange, ZERO_VEC2)
    drawLineUniforms.linkVisibilityMinTransparency = config.linkVisibilityMinTransparency
    drawLineUniforms.linkOpacity = config.linkOpacity
    drawLineUniforms.greyoutOpacity = config.linkGreyoutOpacity
    drawLineUniforms.curvedWeight = config.curvedLinkWeight
    drawLineUniforms.curvedLinkControlPointDistance = config.curvedLinkControlPointDistance
    drawLineUniforms.curvedLinkSegments = this.getEffectiveLineSegments()
    drawLineUniforms.linkBundlingStrength = config.linkBundlingStrength
    drawLineUniforms.linkBundlingCellSize = config.linkBundlingCellSize
    drawLineUniforms.scaleLinksOnZoom = config.scaleLinksOnZoom ? 1 : 0
    drawLineUniforms.maxPointSize = store.maxPointSize
    drawLineUniforms.renderMode = renderMode
    drawLineUniforms.hoveredLinkIndex = store.hoveredLinkIndex ?? -1
    drawLineUniforms.hoveredLinkColor = ensureVec4(store.hoveredLinkColor, DISABLED_COLOR_VEC4)
    drawLineUniforms.hoveredLinkWidthIncrease = config.hoveredLinkWidthIncrease
    drawLineUniforms.isLinkHighlightingActive = hasHighlighting ? 1 : 0
    drawLineUniforms.linkStatusTextureSize = this.linkStatusTextureSize
    drawLineUniforms.focusedLinkIndex = config.focusedLinkIndex ?? -1
    drawLineUniforms.focusedLinkWidthIncrease = config.focusedLinkWidthIncrease
    drawLineUniforms.linkMinPixelLength = config.linkMinPixelLength
    drawLineUniforms.linkLodStrength = linkLodStrength
    drawLineUniforms.linkLodZoomRange = ensureVec2(config.linkLodZoomRange, DEFAULT_LINK_LOD_ZOOM_RANGE)
    drawLineUniforms.linkLodMinSampleRate = config.linkLodMinSampleRate
    drawLineUniforms.linkLodWidthCompensation = config.linkLodWidthCompensation
    drawLineUniforms.linkLodOpacityCompensation = config.linkLodOpacityCompensation
    drawLineUniforms.renderPositionMix = this.device.info?.type === 'webgpu'
      ? (this.points?.renderPositionMix ?? 1)
      : 1

    const fragmentUniforms = this.drawLineFragmentUniformScratch
    fragmentUniforms.renderMode = renderMode
    fragmentUniforms.hasArrowedLinks = this.hasArrowedLinks ? 1 : 0

    this.drawLineUniformStore.setUniforms(this.drawLineUniformPayload)
  }

  private bindDrawCurveCommandIfNeeded (
    currentPositionTexture: Texture,
    positionStorageBuffer: Buffer | undefined,
    linkStatusTexture: Texture
  ): boolean {
    if (!this.drawCurveCommand) return false

    const backend = this.device.info?.type === 'webgpu' ? 'webgpu' : 'webgl'
    const position = backend === 'webgpu' ? positionStorageBuffer : currentPositionTexture
    const previousPosition = backend === 'webgpu' ? this.points?.previousRenderPositionStorageBuffer : undefined
    if (!position || position.destroyed) return false
    if (backend === 'webgpu' && (!previousPosition || previousPosition.destroyed)) return false
    if (
      this.drawCurveBindingsBackend === backend &&
      this.drawCurveBindingsPosition === position &&
      this.drawCurveBindingsPreviousPosition === previousPosition &&
      this.drawCurveBindingsLinkStatus === linkStatusTexture
    ) {
      return true
    }

    if (backend === 'webgpu') {
      this.drawCurveCommand.setBindings({
        positions: position as Buffer,
        previousPositions: previousPosition as Buffer,
        linkStatus: linkStatusTexture,
      })
    } else {
      this.drawCurveCommand.setBindings({
        positionsTexture: position as Texture,
        linkStatus: linkStatusTexture,
      })
    }

    this.drawCurveBindingsBackend = backend
    this.drawCurveBindingsPosition = position
    this.drawCurveBindingsPreviousPosition = previousPosition
    this.drawCurveBindingsLinkStatus = linkStatusTexture
    return true
  }

  private bindDrawCurveIndexCommandIfNeeded (
    currentPositionTexture: Texture,
    positionStorageBuffer: Buffer | undefined,
    linkStatusTexture: Texture
  ): boolean {
    if (!this.drawCurveIndexCommand) return false

    const backend = this.device.info?.type === 'webgpu' ? 'webgpu' : 'webgl'
    const position = backend === 'webgpu' ? positionStorageBuffer : currentPositionTexture
    const previousPosition = backend === 'webgpu' ? this.points?.previousRenderPositionStorageBuffer : undefined
    if (!position || position.destroyed) return false
    if (backend === 'webgpu' && (!previousPosition || previousPosition.destroyed)) return false
    if (
      this.drawCurveIndexBindingsBackend === backend &&
      this.drawCurveIndexBindingsPosition === position &&
      this.drawCurveIndexBindingsPreviousPosition === previousPosition &&
      this.drawCurveIndexBindingsLinkStatus === linkStatusTexture
    ) {
      return true
    }

    if (backend === 'webgpu') {
      this.drawCurveIndexCommand.setBindings({
        positions: position as Buffer,
        previousPositions: previousPosition as Buffer,
        linkStatus: linkStatusTexture,
      })
    } else {
      this.drawCurveIndexCommand.setBindings({
        positionsTexture: position as Texture,
        linkStatus: linkStatusTexture,
      })
    }

    this.drawCurveIndexBindingsBackend = backend
    this.drawCurveIndexBindingsPosition = position
    this.drawCurveIndexBindingsPreviousPosition = previousPosition
    this.drawCurveIndexBindingsLinkStatus = linkStatusTexture
    return true
  }

  private bindHoveredLineCommandIfNeeded (uniformBindingName: string, uniformBuffer: Buffer, linkIndexTexture: Texture): void {
    if (!this.hoveredLineIndexCommand) return
    if (
      this.hoveredLineBindingsName === uniformBindingName &&
      this.hoveredLineBindingsUniformBuffer === uniformBuffer &&
      this.hoveredLineBindingsIndexTexture === linkIndexTexture
    ) {
      return
    }

    this.hoveredLineIndexCommand.setBindings({
      [uniformBindingName]: uniformBuffer,
      linkIndexTexture,
    })
    this.hoveredLineBindingsName = uniformBindingName
    this.hoveredLineBindingsUniformBuffer = uniformBuffer
    this.hoveredLineBindingsIndexTexture = linkIndexTexture
  }

  private getHoverPickScissorRect (padding = 6): [number, number, number, number] | undefined {
    if (this.device.info?.type !== 'webgpu') return undefined

    const screenWidth = Math.max(0, Math.floor(this.store.screenSize[0] ?? 0))
    const screenHeight = Math.max(0, Math.floor(this.store.screenSize[1] ?? 0))
    if (!screenWidth || !screenHeight) return undefined

    const mouseX = this.store.screenMousePosition[0] ?? 0
    const mouseYFromBottom = this.store.screenMousePosition[1] ?? 0
    const mouseY = screenHeight - mouseYFromBottom
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return undefined

    const x = Math.max(0, Math.floor(mouseX) - padding)
    const y = Math.max(0, Math.floor(mouseY) - padding)
    const maxX = Math.min(screenWidth, Math.ceil(mouseX) + padding + 1)
    const maxY = Math.min(screenHeight, Math.ceil(mouseY) + padding + 1)
    return [x, y, Math.max(1, maxX - x), Math.max(1, maxY - y)]
  }

  // Creates a 1×1 placeholder texture for the linkStatus sampler if none exists.
  // luma.gl silently skips the draw call when any declared sampler is unbound,
  // so this ensures a valid binding is always available. The shader won't sample
  // the placeholder — the isLinkHighlightingActive uniform guards that branch.
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
