import type { Graph } from '@kajillion/graph'

/**
 * Apply / clear a highlighted subset on the graph. Cosmos's
 * `highlightedPointIndices` config dims everything else; passing
 * undefined restores the full disc.
 */
export interface HighlightHandle {
  set: (indices: number[] | null) => void;
  clear: () => void;
  current: () => number[] | null;
}

export function createHighlightHandle (graph: Graph): HighlightHandle {
  let cur: number[] | null = null
  return {
    set (indices: number[] | null): void {
      cur = indices && indices.length > 0 ? indices : null
      if (cur) {
        graph.setConfigPartial({
          highlightedPointIndices: cur,
          pointGreyoutOpacity: 0.18,
        })
      } else {
        graph.setConfigPartial({
          highlightedPointIndices: undefined,
          pointGreyoutOpacity: undefined,
        })
      }
      graph.render()
    },
    clear (): void {
      cur = null
      graph.setConfigPartial({
        highlightedPointIndices: undefined,
        pointGreyoutOpacity: undefined,
      })
      graph.render()
    },
    current (): number[] | null {
      return cur
    },
  }
}
