import type { mat3 } from 'gl-matrix'

/**
 * Converts the internal 3x3 transform into the 4x4 std140-friendly matrix
 * layout used by WebGPU uniform buffers.
 */
export type Mat4Array = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export function toStd140TransformMatrix (transform: mat3): Mat4Array {
  if (transform.length !== 9) {
    throw new Error(`Transform must be a 9-element array (3x3 matrix), got ${transform.length} elements`)
  }

  return [
    transform[0], transform[1], transform[2], 0,
    transform[3], transform[4], transform[5], 0,
    transform[6], transform[7], transform[8], 0,
    0, 0, 0, 1,
  ]
}
