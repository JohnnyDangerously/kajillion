import { type Device } from '@luma.gl/core'

import { type GraphConfigInterface } from '@/graph/config'
import { type GraphData } from '@/graph/modules/GraphData'
import { type FPSMonitor } from '@/graph/modules/FPSMonitor'
import { type Lines } from '@/graph/modules/Lines'
import { type Points } from '@/graph/modules/Points'
import { type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'
import { type ITimerQueryPool } from '@/graph/perf'

export interface ConfigUpdateStateContext {
  config: GraphConfigInterface;
  graph: GraphData;
  points: Points | undefined;
  lines: Lines | undefined;
  store: Store;
  device: Device | undefined;
  canvas: HTMLCanvasElement;
  fpsMonitor: FPSMonitor | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
  zoomInstance: Zoom;
  setFpsMonitor: (fpsMonitor: FPSMonitor | undefined) => void;
  setTimerQueryPool: (timerQueryPool: ITimerQueryPool | undefined) => void;
  markLinksChanged: () => void;
  markRenderDirty: () => void;
  resetAdaptiveDpr: () => void;
  maybeApplyAdaptiveDpr: (nowMs: number) => boolean;
  applyEffectivePixelRatio: (ratio: number) => boolean;
  resizeCanvas: (forceResize?: boolean) => void;
  update: (simulationAlpha?: number) => void;
  updateZoomDragBehaviors: () => void;
}
