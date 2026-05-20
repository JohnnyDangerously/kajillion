import type { NodeTreatment } from './types'

export function asTreatment (value: string | undefined): NodeTreatment {
  return value === 'halo' || value === 'glass' || value === 'ink' || value === 'selected' || value === 'vip'
    ? value
    : 'rim'
}

export function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
