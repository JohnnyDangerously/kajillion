import { getRgbaColor } from '@/graph/helper'

export type RgbaColor = [number, number, number, number]

export function setRgbFromColor (
  target: number[],
  color: string | RgbaColor
): void {
  const convertedRgba = getRgbaColor(color)
  target[0] = convertedRgba[0]
  target[1] = convertedRgba[1]
  target[2] = convertedRgba[2]
}

export function setRgbaFromColor (
  target: number[],
  color: string | RgbaColor
): void {
  const convertedRgba = getRgbaColor(color)
  target[0] = convertedRgba[0]
  target[1] = convertedRgba[1]
  target[2] = convertedRgba[2]
  target[3] = convertedRgba[3]
}

export function resetUnsetRgba (target: number[]): void {
  target[0] = -1
  target[1] = -1
  target[2] = -1
  target[3] = -1
}
