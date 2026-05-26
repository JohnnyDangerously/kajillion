export interface CloudNode {
  id: number;
  group: number;
  cluster: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  importance: number;
  bridge: boolean;
}

export interface CloudEdge {
  a: number;
  b: number;
  alpha: number;
  width: number;
  bridge: boolean;
}

export interface CloudScene {
  nodes: CloudNode[];
  edges: CloudEdge[];
  metrics: Record<string, number>;
}

export interface CloudView {
  scene: CloudScene | null;
  width: number;
  height: number;
  scale: number;
  panX: number;
  panY: number;
  displayScale: number;
  displayPanX: number;
  displayPanY: number;
  autoFit: boolean;
  roll: number;
  yaw: number;
  pitch: number;
  dragX: number;
  dragY: number;
  dragging: boolean;
  interactionUntil: number;
  acceptedGlyphs: Set<number>;
}
