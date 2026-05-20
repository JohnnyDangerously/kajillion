import type { GeneratedGraph } from '../../generate-graph'

export const WORK_NODE_ROOT = 0
export const WORK_NODE_GROUP = 1
export const WORK_NODE_COMPANY = 2
export const WORK_NODE_PERSON = 3

export const WORK_GROUPS = [
  { label: 'Revenue', angle: -2.78, radius: 2320, color: 0 },
  { label: 'Marketing', angle: -1.98, radius: 1880, color: 7 },
  { label: 'Success', angle: -1.12, radius: 2240, color: 1 },
  { label: 'Product', angle: -0.12, radius: 2580, color: 5 },
  { label: 'Operations', angle: 0.82, radius: 2020, color: 2 },
  { label: 'Finance', angle: 1.72, radius: 2360, color: 3 },
  { label: 'Partners', angle: 2.52, radius: 2540, color: 4 },
] as const

export type WorkNodeKind =
  | typeof WORK_NODE_ROOT
  | typeof WORK_NODE_GROUP
  | typeof WORK_NODE_COMPANY
  | typeof WORK_NODE_PERSON

export interface WorkGraphMetadata {
  groupForNode?: Int32Array;
  nodeKind?: Uint8Array;
  nodeScore?: Float32Array;
  nodeCompany?: Int32Array;
  nodeLabels?: string[];
  nodeSubtitles?: string[];
  edgeKind?: Uint8Array;
  edgeWeight?: Float32Array;
  edgeConfidence?: Float32Array;
}

export type WorkGraphData = GeneratedGraph & WorkGraphMetadata
