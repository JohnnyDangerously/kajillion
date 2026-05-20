import type { Mat4Array } from '@/graph/modules/Store'

export const IDENTITY_MAT4: Mat4Array = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
export const ZERO_VEC2: [number, number] = [0, 0]
export const TILE_ATOMIC_LANES = 4
export const TRANSPARENT_BLACK: [number, number, number, number] = [0, 0, 0, 1]
export const WHITE_VEC4: [number, number, number, number] = [1, 1, 1, 1]
export const DISABLED_COLOR_VEC4: [number, number, number, number] = [-1, -1, -1, -1]
export const DEFAULT_POINT_LOD_ZOOM_RANGE: [number, number] = [0.12, 0.65]
