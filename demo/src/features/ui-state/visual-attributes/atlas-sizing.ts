import {
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_ROOT,
  type WorkNodeKind,
} from '../../demo-lifecycle/work-graph-types'

const PERSON_BANDS = [4.4, 5.1, 6.0, 7.2, 8.8]
const COMPANY_BANDS = [8.0, 9.8, 12.2, 15.2, 18.8]
const CLOSE_PERSON_BANDS = [12.0, 13.8, 15.8, 18.2, 21.0]
const CLOSE_COMPANY_BANDS = [18.0, 22.0, 27.0, 33.0, 42.0]

export function atlasWorkSize (
  kind: WorkNodeKind | undefined,
  degree: number,
  score: number,
  hash: number,
  zoomEqualize: number
): number {
  if (kind === WORK_NODE_ROOT || kind === WORK_NODE_GROUP) return 0
  const rank = score * 0.62 + Math.min(1, degree / 28) * 0.30 + hash * 0.08
  const band = Math.max(0, Math.min(4, Math.floor(rank * 5.2)))
  if (kind === WORK_NODE_COMPANY) {
    const far = COMPANY_BANDS[band]! + hash * 1.2
    const close = CLOSE_COMPANY_BANDS[band]! + hash * 1.6
    return far * (1 - zoomEqualize) + close * zoomEqualize
  }
  const far = PERSON_BANDS[band]! + hash * 0.42
  const close = CLOSE_PERSON_BANDS[band]! + hash * 0.62
  return far * (1 - zoomEqualize) + close * zoomEqualize
}
