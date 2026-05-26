import type { AtlasDrawPoint } from './overlay-point'

export interface OverlayView {
  points: AtlasDrawPoint[] | null;
  width: number;
  height: number;
  scale: number;
  panX: number;
  panY: number;
  dragX: number;
  dragY: number;
  dragging: boolean;
}
