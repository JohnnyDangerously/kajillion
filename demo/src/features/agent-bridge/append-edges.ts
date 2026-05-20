export interface AppendEdgesState {
  links: Float32Array;
  edgeCount: number;
  linkColors?: Float32Array | null;
  linkWidths?: Float32Array | null;
}

export interface AppendEdgesOptions {
  streamedEdgeColor?: readonly [number, number, number, number];
  streamedEdgeWidth?: number;
}

export interface AppendEdgesResult {
  links: Float32Array;
  edgeCount: number;
  linkColors: Float32Array | null;
  linkWidths: Float32Array | null;
  addedEdges: number;
  changed: boolean;
}

const DEFAULT_STREAMED_EDGE_COLOR: readonly [number, number, number, number] = [0.46, 0.62, 0.95, 0.16]
const DEFAULT_STREAMED_EDGE_WIDTH = 0.6

export function appendEdgesToBuffers (
  state: AppendEdgesState,
  pairs: number[],
  options: AppendEdgesOptions = {}
): AppendEdgesResult {
  if (pairs.length === 0 || pairs.length % 2 !== 0) {
    return {
      links: state.links,
      edgeCount: state.edgeCount,
      linkColors: state.linkColors ?? null,
      linkWidths: state.linkWidths ?? null,
      addedEdges: 0,
      changed: false,
    }
  }

  const addedEdges = pairs.length / 2
  const newLinks = new Float32Array(state.links.length + pairs.length)
  newLinks.set(state.links, 0)
  newLinks.set(pairs, state.links.length)

  const color = options.streamedEdgeColor ?? DEFAULT_STREAMED_EDGE_COLOR
  const oldColors = state.linkColors ?? new Float32Array(0)
  const newColors = new Float32Array(oldColors.length + addedEdges * 4)
  newColors.set(oldColors, 0)
  for (let i = 0; i < addedEdges; i += 1) {
    newColors.set(color, oldColors.length + i * 4)
  }

  const oldWidths = state.linkWidths ?? new Float32Array(0)
  const newWidths = new Float32Array(oldWidths.length + addedEdges)
  newWidths.set(oldWidths, 0)
  newWidths.fill(options.streamedEdgeWidth ?? DEFAULT_STREAMED_EDGE_WIDTH, oldWidths.length)

  return {
    links: newLinks,
    edgeCount: newLinks.length / 2,
    linkColors: newColors,
    linkWidths: newWidths,
    addedEdges,
    changed: true,
  }
}
