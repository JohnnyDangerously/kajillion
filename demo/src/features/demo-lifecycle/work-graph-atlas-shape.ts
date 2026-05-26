export type AtlasAnchor = { x: number; y: number; radius: number; angle: number }
export type AtlasArm = {
  ax: number; ay: number; bx: number; by: number; cx: number; cy: number; spread: number
}
export type AtlasIsland = { x: number; y: number; rx: number; ry: number; tail: number; angle: number }

export const ATLAS_ANCHORS: AtlasAnchor[] = [
  { x: 0.33, y: 0.49, radius: 1420, angle: -0.18 },
  { x: 0.47, y: 0.27, radius: 1180, angle: 0.65 },
  { x: 0.65, y: 0.34, radius: 1320, angle: 0.18 },
  { x: 0.79, y: 0.58, radius: 1420, angle: -0.42 },
  { x: 0.59, y: 0.74, radius: 1180, angle: -2.35 },
  { x: 0.37, y: 0.74, radius: 1360, angle: -2.92 },
  { x: 0.21, y: 0.33, radius: 1240, angle: -1.02 },
]

export const ATLAS_ARMS: AtlasArm[] = [
  { ax: 0.13, ay: 0.31, bx: 0.44, by: 0.20, cx: 0.84, cy: 0.33, spread: 220 },
  { ax: 0.17, ay: 0.48, bx: 0.49, by: 0.41, cx: 0.90, cy: 0.49, spread: 250 },
  { ax: 0.16, ay: 0.67, bx: 0.43, by: 0.73, cx: 0.82, cy: 0.66, spread: 230 },
  { ax: 0.26, ay: 0.18, bx: 0.34, by: 0.49, cx: 0.28, cy: 0.82, spread: 190 },
  { ax: 0.55, ay: 0.14, bx: 0.57, by: 0.45, cx: 0.60, cy: 0.84, spread: 210 },
  { ax: 0.78, ay: 0.24, bx: 0.68, by: 0.50, cx: 0.77, cy: 0.78, spread: 200 },
  { ax: 0.10, ay: 0.77, bx: 0.28, by: 0.61, cx: 0.47, cy: 0.80, spread: 180 },
  { ax: 0.63, ay: 0.77, bx: 0.76, by: 0.61, cx: 0.93, cy: 0.72, spread: 170 },
]

export const ATLAS_ISLANDS: AtlasIsland[] = [
  { x: 0.48, y: 0.49, rx: 0.110, ry: 0.078, tail: 0.16, angle: -0.3 },
  { x: 0.55, y: 0.54, rx: 0.105, ry: 0.073, tail: 0.14, angle: 0.2 },
  { x: 0.43, y: 0.57, rx: 0.092, ry: 0.062, tail: 0.13, angle: 2.8 },
  { x: 0.22, y: 0.32, rx: 0.070, ry: 0.052, tail: 0.18, angle: -2.9 },
  { x: 0.34, y: 0.29, rx: 0.095, ry: 0.060, tail: 0.20, angle: -0.2 },
  { x: 0.49, y: 0.31, rx: 0.110, ry: 0.070, tail: 0.24, angle: 0.1 },
  { x: 0.67, y: 0.30, rx: 0.100, ry: 0.060, tail: 0.17, angle: 0.4 },
  { x: 0.78, y: 0.42, rx: 0.070, ry: 0.050, tail: 0.22, angle: 0.0 },
  { x: 0.20, y: 0.53, rx: 0.115, ry: 0.073, tail: 0.20, angle: 2.9 },
  { x: 0.38, y: 0.51, rx: 0.145, ry: 0.090, tail: 0.12, angle: 2.8 },
  { x: 0.58, y: 0.51, rx: 0.145, ry: 0.086, tail: 0.16, angle: -0.1 },
  { x: 0.82, y: 0.59, rx: 0.095, ry: 0.065, tail: 0.24, angle: 0.2 },
  { x: 0.27, y: 0.72, rx: 0.095, ry: 0.066, tail: 0.20, angle: 2.7 },
  { x: 0.46, y: 0.73, rx: 0.125, ry: 0.076, tail: 0.15, angle: 3.1 },
  { x: 0.66, y: 0.72, rx: 0.115, ry: 0.074, tail: 0.18, angle: -0.2 },
  { x: 0.12, y: 0.42, rx: 0.046, ry: 0.036, tail: 0.26, angle: -2.8 },
  { x: 0.90, y: 0.33, rx: 0.045, ry: 0.034, tail: 0.18, angle: 0.6 },
  { x: 0.13, y: 0.76, rx: 0.042, ry: 0.032, tail: 0.23, angle: 2.7 },
  { x: 0.91, y: 0.72, rx: 0.050, ry: 0.035, tail: 0.25, angle: 0.3 },
]
