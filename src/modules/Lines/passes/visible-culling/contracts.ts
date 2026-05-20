import type { BindingDeclaration, VariableShaderType } from '@luma.gl/core'
import type { Mat4Array } from '@/graph/modules/Store'

type UniformTypeMap<T extends Record<string, unknown>> = Record<keyof T, VariableShaderType>

export type ClearVisibleLinesUniforms = {
  vertexCount: number;
}

export type ClearVisibleLinesUniformStoreShape = {
  clearLineUniforms: ClearVisibleLinesUniforms;
}

export type CullVisibleLinesUniforms = {
  transformationMatrix: Mat4Array;
  linkCount: number;
  pointsTextureSize: number;
  spaceSize: number;
  screenSize: [number, number];
  curvedLinkControlPointDistance: number;
  renderPositionMix: number;
  linkMinPixelLength: number;
  linkLodStrength: number;
  linkLodZoomRange: [number, number];
  linkLodMinSampleRate: number;
  hoveredLinkIndex: number;
  focusedLinkIndex: number;
}

export type CullVisibleLinesUniformStoreShape = {
  cullLineUniforms: CullVisibleLinesUniforms;
}

export const CLEAR_VISIBLE_LINES_UNIFORM_TYPES: UniformTypeMap<ClearVisibleLinesUniforms> = {
  vertexCount: 'u32',
}

export const CULL_VISIBLE_LINES_UNIFORM_TYPES: UniformTypeMap<CullVisibleLinesUniforms> = {
  transformationMatrix: 'mat4x4<f32>',
  linkCount: 'u32',
  pointsTextureSize: 'f32',
  spaceSize: 'f32',
  screenSize: 'vec2<f32>',
  curvedLinkControlPointDistance: 'f32',
  renderPositionMix: 'f32',
  linkMinPixelLength: 'f32',
  linkLodStrength: 'f32',
  linkLodZoomRange: 'vec2<f32>',
  linkLodMinSampleRate: 'f32',
  hoveredLinkIndex: 'f32',
  focusedLinkIndex: 'f32',
}

export const CLEAR_VISIBLE_LINE_BINDINGS: BindingDeclaration[] = [
  { type: 'uniform', name: 'clearLineUniforms', group: 0, location: 0 },
  { type: 'storage', name: 'indirectArgs', group: 0, location: 1 },
]

export const CULL_VISIBLE_LINE_BINDINGS: BindingDeclaration[] = [
  { type: 'uniform', name: 'cullLineUniforms', group: 0, location: 0 },
  { type: 'storage', name: 'positions', group: 0, location: 1 },
  { type: 'storage', name: 'pointAArr', group: 0, location: 2 },
  { type: 'storage', name: 'pointBArr', group: 0, location: 3 },
  { type: 'storage', name: 'visibleIndices', group: 0, location: 4 },
  { type: 'storage', name: 'indirectArgs', group: 0, location: 5 },
  { type: 'storage', name: 'activeMask', group: 0, location: 6 },
  { type: 'storage', name: 'previousPositions', group: 0, location: 7 },
]
