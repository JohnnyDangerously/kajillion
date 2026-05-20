import type { VariableShaderType } from '@luma.gl/core'
import type { Mat4Array } from '@/graph/modules/Store'

type UniformTypeMap<T extends Record<string, unknown>> = Record<keyof T, VariableShaderType>

export type FillSampledLinksUniforms = {
  pointsTextureSize: number;
  transformationMatrix: Mat4Array;
  spaceSize: number;
  screenSize: [number, number];
  curvedWeight: number;
  curvedLinkControlPointDistance: number;
  curvedLinkSegments: number;
}

export type FillSampledLinksUniformStoreShape = {
  fillSampledLinksUniforms: FillSampledLinksUniforms;
}

export const FILL_SAMPLED_LINKS_UNIFORM_TYPES: UniformTypeMap<FillSampledLinksUniforms> = {
  pointsTextureSize: 'f32',
  transformationMatrix: 'mat4x4<f32>',
  spaceSize: 'f32',
  screenSize: 'vec2<f32>',
  curvedWeight: 'f32',
  curvedLinkControlPointDistance: 'f32',
  curvedLinkSegments: 'f32',
}
