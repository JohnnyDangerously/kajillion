import type { Mat4Array } from '@/graph/modules/Store'

export const IDENTITY_MAT4: Mat4Array = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
export const ZERO_VEC2: [number, number] = [0, 0]
export const DISABLED_COLOR_VEC4: [number, number, number, number] = [-1, -1, -1, -1]
export const DEFAULT_LINK_LOD_ZOOM_RANGE: [number, number] = [0.10, 0.60]
export const LINE_INSTANCE_BYTE_LENGTH = 7 * 4 * Float32Array.BYTES_PER_ELEMENT
