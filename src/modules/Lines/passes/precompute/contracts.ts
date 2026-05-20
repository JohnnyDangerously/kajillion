import type { BindingDeclaration, VariableShaderType } from '@luma.gl/core'

type UniformTypeMap<T extends Record<string, unknown>> = Record<keyof T, VariableShaderType>

export type PrecomputeLineInstancesUniforms = {
  linkCount: number;
}

export type PrecomputeLineInstancesUniformStoreShape = {
  precomputeLine: PrecomputeLineInstancesUniforms;
}

export const PRECOMPUTE_LINE_INSTANCES_UNIFORM_TYPES: UniformTypeMap<PrecomputeLineInstancesUniforms> = {
  linkCount: 'u32',
}

export const PRECOMPUTE_LINE_INSTANCES_BINDINGS: BindingDeclaration[] = [
  { type: 'uniform', name: 'drawLine', group: 0, location: 0 },
  { type: 'uniform', name: 'precomputeLine', group: 0, location: 1 },
  { type: 'storage', name: 'positions', group: 0, location: 2 },
  { type: 'storage', name: 'pointAArr', group: 0, location: 3 },
  { type: 'storage', name: 'pointBArr', group: 0, location: 4 },
  { type: 'storage', name: 'colorArr', group: 0, location: 5 },
  { type: 'storage', name: 'widthArr', group: 0, location: 6 },
  { type: 'storage', name: 'arrowArr', group: 0, location: 7 },
  { type: 'storage', name: 'linkIndexArr', group: 0, location: 8 },
  { type: 'storage', name: 'instances', group: 0, location: 9 },
]
