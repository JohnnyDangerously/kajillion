import { mixedHash01 } from './utils'
import type { GalleryGraphData, LabelAnchor } from './types'

interface FintechHub {
  label: string;
  nx: number;
  ny: number;
  group: number;
  leaves: number;
}

const FINTECH_HUBS: FintechHub[] = [
  { label: 'mPOS эквайринг', nx: 0.18, ny: 0.18, group: 1, leaves: 13 },
  { label: 'T-commerce', nx: 0.17, ny: 0.42, group: 1, leaves: 10 },
  { label: 'E-Wallets', nx: 0.43, ny: 0.07, group: 0, leaves: 7 },
  { label: 'Offline-commerce', nx: 0.54, ny: 0.25, group: 2, leaves: 8 },
  { label: 'M-Wallets', nx: 0.49, ny: 0.45, group: 0, leaves: 9 },
  { label: 'BLE/Beacons', nx: 0.39, ny: 0.28, group: 2, leaves: 5 },
  { label: 'Prepaid / Gift карты', nx: 0.63, ny: 0.34, group: 2, leaves: 6 },
  { label: 'Bitcoin', nx: 0.72, ny: 0.31, group: 0, leaves: 8 },
  { label: 'PFM -> PFP', nx: 0.85, ny: 0.44, group: 0, leaves: 11 },
  { label: 'Платежи и переводы', nx: 0.94, ny: 0.19, group: 2, leaves: 7 },
  { label: 'Wishlist', nx: 0.74, ny: 0.70, group: 0, leaves: 6 },
  { label: 'Register&Pay via Profile', nx: 0.57, ny: 0.78, group: 0, leaves: 4 },
  { label: 'Онлайн-эквайринг', nx: 0.43, ny: 0.78, group: 1, leaves: 7 },
  { label: 'Банк как услуга', nx: 0.54, ny: 0.63, group: 1, leaves: 6 },
  { label: 'E-Commerce', nx: 0.66, ny: 0.73, group: 2, leaves: 4 },
  { label: 'Онлайн-факторинг и кредитование МСБ', nx: 0.84, ny: 0.84, group: 1, leaves: 6 },
  { label: 'Микрокредитование онлайн', nx: 0.93, ny: 0.72, group: 0, leaves: 5 },
  { label: 'P2P-кредитование', nx: 0.79, ny: 0.90, group: 0, leaves: 4 },
  { label: 'Соцсети трейдеров', nx: 0.06, ny: 0.84, group: 0, leaves: 4 },
  { label: 'Краудфандинг', nx: 0.24, ny: 0.79, group: 2, leaves: 5 },
  { label: 'Конструкторы онлайн-магазинов', nx: 0.20, ny: 0.68, group: 1, leaves: 5 },
  { label: 'POS-кредитование оплаты', nx: 0.54, ny: 0.93, group: 2, leaves: 5 },
]

export function fintechLabelAnchors (spaceSize: number): LabelAnchor[] {
  return FINTECH_HUBS.map(hub => ({
    label: hub.label,
    x: fintechX(hub.nx, spaceSize),
    y: fintechY(hub.ny, spaceSize),
  }))
}

export function fintechScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(0)
  const hubNodes: number[] = []
  const leavesByHub: number[][] = FINTECH_HUBS.map(() => [])
  let cursor = 0
  for (let i = 0; i < FINTECH_HUBS.length && cursor < nodeCount; i += 1) {
    const hub = FINTECH_HUBS[i]!
    hubNodes.push(cursor)
    groupForNode[cursor] = hub.group
    positions[cursor * 2] = fintechX(hub.nx, spaceSize)
    positions[cursor * 2 + 1] = fintechY(hub.ny, spaceSize)
    cursor += 1
  }
  for (let hubIndex = 0; hubIndex < FINTECH_HUBS.length && cursor < nodeCount; hubIndex += 1) {
    const hub = FINTECH_HUBS[hubIndex]!
    const count = Math.min(hub.leaves, nodeCount - cursor)
    const hx = fintechX(hub.nx, spaceSize)
    const hy = fintechY(hub.ny, spaceSize)
    for (let i = 0; i < count; i += 1) {
      const node = cursor
      const angle = mixedHash01(node, 700 + hubIndex) * Math.PI * 2
      const r = spaceSize * (0.035 + mixedHash01(node, 900 + hubIndex) * 0.045)
      groupForNode[node] = hub.group
      positions[node * 2] = hx + Math.cos(angle) * r * 1.4
      positions[node * 2 + 1] = hy + Math.sin(angle) * r
      leavesByHub[hubIndex]!.push(node)
      cursor += 1
    }
  }
  while (cursor < nodeCount) {
    const node = cursor
    const hubIndex = Math.floor(mixedHash01(node, 1201) * FINTECH_HUBS.length)
    const hub = FINTECH_HUBS[hubIndex] ?? FINTECH_HUBS[0]!
    const hx = fintechX(hub.nx, spaceSize)
    const hy = fintechY(hub.ny, spaceSize)
    const angle = mixedHash01(node, 1401) * Math.PI * 2
    const r = spaceSize * (0.020 + mixedHash01(node, 1407) * 0.030)
    groupForNode[node] = hub.group
    positions[node * 2] = hx + Math.cos(angle) * r * 1.35
    positions[node * 2 + 1] = hy + Math.sin(angle) * r
    leavesByHub[hubIndex]!.push(node)
    cursor += 1
  }

  const links: number[] = []
  const seenLinks = new Set<string>()
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const key = `${low}:${high}`
    if (seenLinks.has(key)) return
    seenLinks.add(key)
    links.push(a, b)
  }
  for (const [i, hubNode] of hubNodes.entries()) {
    const hub = hubNode!
    for (const leaf of leavesByHub[i] ?? []) addLink(hub, leaf)
  }
  const hubEdges: Array<[number, number]> = [
    [0, 1], [0, 4], [0, 5], [0, 12], [1, 12], [2, 4], [2, 7], [2, 9],
    [3, 4], [3, 6], [3, 7], [4, 6], [4, 13], [4, 12], [5, 6], [6, 14],
    [7, 8], [7, 9], [8, 10], [8, 16], [8, 9], [10, 14], [10, 16],
    [11, 12], [11, 14], [12, 13], [12, 21], [14, 15], [15, 16],
    [15, 17], [16, 17], [18, 19], [19, 20], [20, 1], [21, 17],
  ]
  for (const [a, b] of hubEdges) addLink(hubNodes[a] ?? -1, hubNodes[b] ?? -1)
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}

function fintechX (normalized: number, spaceSize: number): number {
  return spaceSize * (0.03 + normalized * 0.94)
}

function fintechY (normalized: number, spaceSize: number): number {
  return spaceSize * (0.08 + (1 - normalized) * 0.82)
}
