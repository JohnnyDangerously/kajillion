import type { RenderPass } from '@luma.gl/core'

export interface WebGpuBufferAccess {
  handle?: GPUBuffer;
}

export interface WebGpuRenderPassAccess {
  handle?: GPURenderPassEncoder;
}

export interface GpuTimerLike {
  begin: (label: string) => void;
  end: () => void;
}

export interface IndirectRenderPipelineAccess {
  handle?: GPURenderPipeline;
  setBindings: (bindings: Record<string, unknown>, options?: { disableWarnings?: boolean }) => void;
  _getBindGroup?: () => GPUBindGroup | null;
}

export interface IndirectModelAccess {
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
