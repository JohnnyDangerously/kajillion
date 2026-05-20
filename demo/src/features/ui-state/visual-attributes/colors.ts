import {
  ANALYST_GROUP_COLORS,
} from '../../demo-lifecycle/demo-space'
import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_ROOT,
  type WorkNodeKind,
} from '../../demo-lifecycle/work-graph-types'

export function fintechColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [0.12, 0.62, 0.92],
    [0.96, 0.22, 0.58],
    [0.58, 0.23, 0.72],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

export function influenceColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [1.00, 0.18, 0.04],
    [1.00, 0.70, 0.00],
    [0.95, 0.95, 0.90],
    [0.00, 0.82, 0.92],
    [0.65, 0.95, 1.00],
    [0.24, 0.14, 1.00],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

export function talentColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [0.18, 0.58, 0.88],
    [0.98, 0.86, 0.16],
    [0.94, 0.28, 0.45],
    [0.98, 0.56, 0.25],
    [0.36, 0.78, 0.68],
    [0.66, 0.38, 0.82],
    [0.92, 0.36, 0.70],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

export function analystWorkColor (
  group: number,
  kind: number | undefined,
  degree: number,
  score: number,
  hash: number
): [number, number, number] {
  const base = ANALYST_GROUP_COLORS[group % ANALYST_GROUP_COLORS.length] ?? ANALYST_GROUP_COLORS[0]!
  const rank = Math.max(score, Math.min(1, degree / 28))
  if (kind === WORK_NODE_ROOT) return [0.98, 0.99, 1.00]
  const authority = kind === WORK_NODE_GROUP || kind === WORK_NODE_COMPANY || degree >= 18 || score > 0.74
  const wash = authority ? 0.04 : 0.16 + (1 - rank) * 0.10
  const lift = authority ? 1.10 + rank * 0.10 : 1.02 + rank * 0.08 + hash * 0.03
  return [
    Math.min(1, (base[0] * (1 - wash) + wash) * lift),
    Math.min(1, (base[1] * (1 - wash) + wash) * lift),
    Math.min(1, (base[2] * (1 - wash) + wash) * lift),
  ]
}

export function colorByWorkKind (
  group: number,
  kind: WorkNodeKind | undefined,
  degree: number,
  score: number,
  hash: number,
): [number, number, number] {
  return analystWorkColor(group, kind, degree, score, hash)
}
