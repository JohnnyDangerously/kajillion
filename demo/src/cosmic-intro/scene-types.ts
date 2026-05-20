export type CosmicColor = [number, number, number]

export interface ClusterSpec {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  hue: CosmicColor;
  mass: number;
}

export interface FilamentEdge {
  a: number;
  b: number;
  strength: number;
  color: CosmicColor;
  bowX: number;
  bowY: number;
  bowZ: number;
}
