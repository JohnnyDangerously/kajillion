import type { Graph, GraphConfig } from '@kajillion/graph'
import type { DemoConfig } from '../control-plane/types'
import type { VisualAttributes } from '../ui-state/visual-attributes'

export interface RepresentationVisualData {
  nodeCount: number;
  edgeCount: number;
  positions: Float32Array;
  links: Float32Array;
}

export interface RepresentationInstallContext {
  graph: Graph;
  host: HTMLElement;
  data: RepresentationVisualData;
  config: DemoConfig;
}

/**
 * A self-contained look. Each hook is optional. The runtime calls each in the
 * order: applyGraphConfig → transformPositions (mutates renderData.positions
 * in place or returns a replacement) → transformAttributes (rewrites colors/
 * sizes/shapes after the default attribute builder ran).
 */
export interface RepresentationPreset {
  id: string;
  /**
   * If true, the representation owns the camera and the runtime must skip the
   * work-mode post-init re-fit. The preset's own GraphConfig.fitViewPadding
   * then takes effect.
   */
  ownsCamera?: boolean;
  /** Overlay onto the GraphConfig produced by build-graph-config. */
  applyGraphConfig?: (config: GraphConfig, cfg: DemoConfig) => GraphConfig;
  /** Replace positions with a layout owned by the representation. Return null to keep the input. */
  transformPositions?: (
    data: RepresentationVisualData,
    cfg: DemoConfig
  ) => Float32Array | null;
  /** Overwrite per-node visual attributes after the default pipeline. */
  transformAttributes?: (
    data: RepresentationVisualData,
    attributes: VisualAttributes,
    cfg: DemoConfig
  ) => void;
  /**
   * Called once after the Graph is created and initial attributes applied.
   * Lets the representation mount overlays (canvas, DOM) on top of the
   * WebGPU canvas. Return a teardown function called on graph rebuild.
   */
  install?: (ctx: RepresentationInstallContext) => (() => void) | void;
}
