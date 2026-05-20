import type { VariableShaderType } from '@luma.gl/core'

type UniformTypeMap<T extends Record<string, unknown>> = Record<keyof T, VariableShaderType>

export type HoveredLineIndexUniforms = {
  mousePosition: [number, number];
  screenSize: [number, number];
}

export type HoveredLineIndexUniformStoreShape = {
  hoveredLineIndexUniforms: HoveredLineIndexUniforms;
}

export const HOVERED_LINE_INDEX_UNIFORM_TYPES: UniformTypeMap<HoveredLineIndexUniforms> = {
  mousePosition: 'vec2<f32>',
  screenSize: 'vec2<f32>',
}
