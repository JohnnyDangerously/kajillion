export interface AtlasCluster {
  x: number;
  y: number;
  rx: number;
  ry: number;
  theta: number;
  group: number;
}

export const ATLAS_CLUSTERS: readonly AtlasCluster[] = [
  { x: 0.24, y: 0.30, rx: 0.090, ry: 0.055, theta: -0.42, group: 2 },
  { x: 0.31, y: 0.39, rx: 0.082, ry: 0.060, theta: 0.38, group: 2 },
  { x: 0.42, y: 0.28, rx: 0.074, ry: 0.052, theta: -0.18, group: 1 },
  { x: 0.49, y: 0.37, rx: 0.078, ry: 0.060, theta: 0.28, group: 1 },
  { x: 0.58, y: 0.26, rx: 0.082, ry: 0.052, theta: 0.16, group: 0 },
  { x: 0.68, y: 0.34, rx: 0.090, ry: 0.060, theta: -0.36, group: 0 },
  { x: 0.76, y: 0.47, rx: 0.084, ry: 0.066, theta: 0.50, group: 10 },
  { x: 0.63, y: 0.55, rx: 0.080, ry: 0.058, theta: -0.12, group: 9 },
  { x: 0.50, y: 0.55, rx: 0.078, ry: 0.060, theta: 0.10, group: 7 },
  { x: 0.38, y: 0.58, rx: 0.086, ry: 0.062, theta: -0.36, group: 8 },
  { x: 0.27, y: 0.61, rx: 0.084, ry: 0.060, theta: 0.24, group: 4 },
  { x: 0.17, y: 0.53, rx: 0.060, ry: 0.050, theta: -0.44, group: 4 },
  { x: 0.15, y: 0.39, rx: 0.064, ry: 0.052, theta: 0.72, group: 8 },
  { x: 0.21, y: 0.74, rx: 0.065, ry: 0.048, theta: 0.15, group: 6 },
  { x: 0.36, y: 0.78, rx: 0.075, ry: 0.050, theta: -0.26, group: 6 },
  { x: 0.55, y: 0.77, rx: 0.084, ry: 0.052, theta: 0.20, group: 5 },
  { x: 0.72, y: 0.73, rx: 0.072, ry: 0.052, theta: -0.10, group: 5 },
  { x: 0.86, y: 0.60, rx: 0.060, ry: 0.052, theta: 0.52, group: 11 },
  { x: 0.85, y: 0.28, rx: 0.060, ry: 0.050, theta: -0.18, group: 11 },
  { x: 0.12, y: 0.24, rx: 0.050, ry: 0.042, theta: 0.38, group: 3 },
  { x: 0.88, y: 0.81, rx: 0.048, ry: 0.040, theta: -0.34, group: 12 },
  { x: 0.08, y: 0.68, rx: 0.046, ry: 0.038, theta: 0.24, group: 3 },
]
