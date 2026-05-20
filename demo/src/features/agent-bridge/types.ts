import type {
  NodeFilterOptions,
  NodeFocusOptions,
  VisualLabControlPlane,
} from '../../visual-lab-control-plane'

export interface AgentGraphNode {
  id?: string | number;
  label?: string;
  x?: number;
  y?: number;
}

export interface AgentGraphEdge {
  source: string | number;
  target: string | number;
}

export interface AgentGraphPayload {
  nodeCount?: number;
  edgeCount?: number;
  positions?: number[];
  links?: number[];
  nodes?: AgentGraphNode[];
  edges?: AgentGraphEdge[];
}

export type AgentCommand =
  | { type: 'loadGraph'; graph: AgentGraphPayload; options?: { title?: string; graphId?: string; fit?: boolean; workMode?: boolean } }
  | { type: 'appendEdges'; links: number[] }
  | { type: 'focusNode'; index: number; options?: NodeFocusOptions & { async?: boolean } }
  | { type: 'filterNodes'; pointIndices: number[]; options?: NodeFilterOptions }
  | { type: 'clearInteraction' }
  | { type: 'setVisibleEdgeKinds'; visibleKinds: Array<'observed' | 'second_degree' | 'predicted'> }
  | { type: 'secondDegreeProjection'; options?: Parameters<VisualLabControlPlane['runSecondDegreeProjection']>[0] }

export interface AgentCommandEnvelope {
  id: number;
  command: AgentCommand;
}
