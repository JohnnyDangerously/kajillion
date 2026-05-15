export type GalleryPalette =
  'category' | 'ember' | 'ion' | 'signal' | 'tokyo' | 'subnet' | 'insight' | 'fintech' | 'influence' | 'talent'

export interface GalleryGraphData {
  positions: Float32Array;
  links: Float32Array;
  nodeCount: number;
  edgeCount: number;
}

export function parsePaletteParam (value: string | null): GalleryPalette {
  return value === 'ember' ||
    value === 'ion' ||
    value === 'signal' ||
    value === 'tokyo' ||
    value === 'subnet' ||
    value === 'insight' ||
    value === 'fintech' ||
    value === 'influence' ||
    value === 'talent'
    ? value
    : 'category'
}

export function isGalleryPalette (palette: GalleryPalette): boolean {
  return palette !== 'category'
}

export function galleryPresetUrlDefaults (palette: GalleryPalette): Record<string, string | null> {
  if (palette === 'signal') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'tokyo') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'insight') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'fintech') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'influence') {
    return {
      n: '10000',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'talent') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '0',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'subnet') {
    return {
      n: '500',
      data: 'work',
      theme: 'light',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '1',
      sim: '0',
      blend: 'normal',
    }
  }
  return { theme: 'dark' }
}

export function galleryRenderData<T extends GalleryGraphData> (
  palette: GalleryPalette,
  data: T,
  spaceSize: number
): T {
  if (palette === 'tokyo') return tokyoScene(data, spaceSize) as T
  if (palette === 'subnet') return subnetScene(data, spaceSize) as T
  if (palette === 'signal') return signalScene(data, spaceSize) as T
  if (palette === 'insight') return insightScene(data, spaceSize) as T
  if (palette === 'fintech') return fintechScene(data, spaceSize) as T
  if (palette === 'influence') return influenceScene(data, spaceSize) as T
  if (palette === 'talent') return talentScene(data, spaceSize) as T
  return data
}

export function influenceLabelAnchors (spaceSize: number): Array<{ label: string; x: number; y: number }> {
  const p = (label: string, nx: number, ny: number): { label: string; x: number; y: number } => ({
    label,
    x: spaceSize * nx,
    y: spaceSize * ny,
  })
  return [
    p('microchunkychip', 0.51, 0.50),
    p('thedemocrats', 0.66, 0.68),
    p('speakerryan', 0.36, 0.32),
    p('whiteofpeace', 0.25, 0.62),
    p('realjamesallsup', 0.25, 0.71),
    p('cnn', 0.42, 0.66),
    p('bakedalaska', 0.69, 0.20),
    p('realdonaldtrump', 0.45, 0.35),
    p('washingtonpost', 0.52, 0.88),
    p('wikileaks', 0.57, 0.90),
    p('russianembassy', 0.49, 0.91),
    p('foxandfriends', 0.22, 0.27),
    p('breitbartnews', 0.45, 0.38),
    p('drudge_report', 0.60, 0.20),
    p('newsmax', 0.54, 0.25),
    p('youtube', 0.64, 0.28),
    p('msnbc', 0.67, 0.42),
    p('huffpost', 0.69, 0.46),
    p('politico', 0.23, 0.46),
    p('potus', 0.28, 0.50),
    p('foxnews', 0.34, 0.53),
    p('nypost', 0.78, 0.39),
    p('mfa_russia', 0.87, 0.35),
    p('breaking911', 0.74, 0.45),
    p('lucianwintrich', 0.55, 0.17),
    p('ramzpaul', 0.32, 0.23),
    p('tedcruz', 0.42, 0.26),
    p('jaredkushner', 0.20, 0.35),
    p('hillaryclinton', 0.50, 0.31),
    p('facebook', 0.33, 0.57),
    p('mashable', 0.39, 0.58),
  ]
}

export function talentLabelAnchors (spaceSize: number): Array<{ label: string; x: number; y: number }> {
  const p = (label: string, nx: number, ny: number): { label: string; x: number; y: number } => ({
    label,
    x: spaceSize * nx,
    y: spaceSize * ny,
  })
  return [
    p('Engineering', 0.53, 0.45),
    p('Sales', 0.61, 0.50),
    p('Product', 0.56, 0.39),
    p('Support', 0.48, 0.54),
    p('Ops', 0.64, 0.42),
  ]
}

function influenceScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize * 0.51
  const cy = spaceSize * 0.50
  const radius = spaceSize * 0.48
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(0)
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
  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }
  positions[0] = cx
  positions[1] = cy
  groupForNode[0] = 0

  const clusters = [
    { group: 0, start: 1, end: Math.floor(nodeCount * 0.42), x: 0.51, y: 0.50, rx: 0.36, ry: 0.30, hub: 0, radial: true },
    { group: 0, start: Math.floor(nodeCount * 0.42), end: Math.floor(nodeCount * 0.62), x: 0.63, y: 0.64, rx: 0.27, ry: 0.24, hub: 2, radial: true },
    { group: 1, start: Math.floor(nodeCount * 0.62), end: Math.floor(nodeCount * 0.78), x: 0.37, y: 0.37, rx: 0.29, ry: 0.24, hub: 1, radial: true },
    { group: 2, start: Math.floor(nodeCount * 0.78), end: Math.floor(nodeCount * 0.84), x: 0.25, y: 0.58, rx: 0.18, ry: 0.20, hub: 3, radial: false },
    { group: 3, start: Math.floor(nodeCount * 0.84), end: Math.floor(nodeCount * 0.91), x: 0.45, y: 0.76, rx: 0.27, ry: 0.19, hub: 4, radial: false },
    { group: 4, start: Math.floor(nodeCount * 0.91), end: Math.floor(nodeCount * 0.96), x: 0.66, y: 0.30, rx: 0.25, ry: 0.21, hub: 5, radial: false },
    { group: 5, start: Math.floor(nodeCount * 0.96), end: nodeCount, x: 0.76, y: 0.46, rx: 0.20, ry: 0.21, hub: 6, radial: false },
  ]
  const hubs: number[] = [0]
  for (const cluster of clusters) {
    const hub = Math.min(nodeCount - 1, Math.max(cluster.start, cluster.hub))
    hubs.push(hub)
    for (let node = cluster.start; node < cluster.end; node += 1) {
      const angle = mixedHash01(node, 331 + cluster.group) * Math.PI * 2
      const r = Math.sqrt(mixedHash01(node, 733 + cluster.group))
      const jitter = mixedHash01(node, 991 + cluster.group)
      positions[node * 2] = spaceSize * cluster.x + Math.cos(angle) * radius * cluster.rx * r
      positions[node * 2 + 1] = spaceSize * cluster.y + Math.sin(angle) * radius * cluster.ry * r
      groupForNode[node] = cluster.group
      if (cluster.radial && node % 2 === 0) addLink(0, node)
      if (node > cluster.start) addLink(node, node - 1)
      if (node % 3 === 0) addLink(node, cluster.start + Math.floor(jitter * Math.max(1, node - cluster.start)))
      if (node % 17 === 0) addLink(node, hub)
    }
  }
  for (let i = 0; i < hubs.length; i += 1) {
    addLink(hubs[i]!, hubs[(i + 1) % hubs.length]!)
    if (i > 1) addLink(hubs[i]!, 0)
  }
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}

function talentScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize * 0.56
  const cy = spaceSize * 0.48
  const radius = spaceSize * 0.26
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(0)
  for (let node = 0; node < nodeCount; node += 1) {
    const angle = mixedHash01(node, 510) * Math.PI * 2
    const ring = Math.sqrt(mixedHash01(node, 616))
    const warp = 1 + Math.sin(angle * 5.0) * 0.10
    positions[node * 2] = cx + Math.cos(angle) * radius * ring * warp
    positions[node * 2 + 1] = cy + Math.sin(angle) * radius * ring * (0.92 + Math.cos(angle * 3) * 0.06)
    groupForNode[node] = Math.floor(mixedHash01(node, 812) * 7)
  }
  const links: number[] = []
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: 0 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}

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

export function fintechLabelAnchors (spaceSize: number): Array<{ label: string; x: number; y: number }> {
  return FINTECH_HUBS.map(hub => ({
    label: hub.label,
    x: fintechX(hub.nx, spaceSize),
    y: fintechY(hub.ny, spaceSize),
  }))
}

function fintechScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
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

function insightScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.39
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(-1)
  const yellowCount = Math.min(Math.floor(nodeCount * 0.19), Math.max(0, nodeCount - 2))
  const magentaCount = Math.min(Math.floor(nodeCount * 0.23), Math.max(0, nodeCount - yellowCount - 1))
  const grayCount = Math.max(0, nodeCount - yellowCount - magentaCount)
  const gray: number[] = []
  const yellow: number[] = []
  const magenta: number[] = []

  for (let i = 0; i < grayCount; i += 1) {
    const node = i
    gray.push(node)
    const h = mixedHash01(node, 19)
    const angle = h * Math.PI * 2
    const h2 = mixedHash01(node, 251)
    const r = radius * (0.13 + Math.sqrt(mixedHash01(node, 881)) * 0.83 + (h2 > 0.84 ? 0.10 : 0))
    positions[node * 2] = cx + Math.cos(angle) * r * (0.95 + mixedHash01(node, 3) * 0.05)
    positions[node * 2 + 1] = cy + Math.sin(angle) * r * (0.92 + mixedHash01(node, 5) * 0.08)
  }

  const placeCommunity = (
    nodes: number[],
    start: number,
    count: number,
    group: number,
    centerX: number,
    centerY: number,
    spreadX: number,
    spreadY: number
  ): void => {
    for (let i = 0; i < count; i += 1) {
      const node = start + i
      nodes.push(node)
      groupForNode[node] = group
      const angle = mixedHash01(node, 73) * Math.PI * 2
      const r = Math.sqrt(mixedHash01(node, 173))
      positions[node * 2] = centerX + Math.cos(angle) * spreadX * r
      positions[node * 2 + 1] = centerY + Math.sin(angle) * spreadY * r
    }
  }
  placeCommunity(yellow, grayCount, yellowCount, 0, cx - radius * 0.30, cy + radius * 0.37, radius * 0.24, radius * 0.28)
  placeCommunity(magenta, grayCount + yellowCount, magentaCount, 1, cx + radius * 0.38, cy - radius * 0.25, radius * 0.29, radius * 0.28)

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
  const sortedByDistance = (node: number, nodes: number[]): number[] => {
    const ax = positions[node * 2] ?? cx
    const ay = positions[node * 2 + 1] ?? cy
    return [...nodes].sort((a, b) => {
      const adx = (positions[a * 2] ?? cx) - ax
      const ady = (positions[a * 2 + 1] ?? cy) - ay
      const bdx = (positions[b * 2] ?? cx) - ax
      const bdy = (positions[b * 2 + 1] ?? cy) - ay
      return adx * adx + ady * ady - (bdx * bdx + bdy * bdy)
    })
  }
  for (let i = 0; i < gray.length; i += 1) {
    const a = gray[i]!
    const near = sortedByDistance(a, gray)
    addLink(a, near[1 + Math.floor(mixedHash01(a, 31) * 5)] ?? gray[(i + 1) % gray.length]!)
    if (i % 2 === 0) addLink(a, near[4 + Math.floor(mixedHash01(a, 37) * 9)] ?? gray[(i + 7) % gray.length]!)
    if (i % 7 === 0) addLink(a, near[12 + Math.floor(mixedHash01(a, 41) * 20)] ?? gray[(i + 23) % gray.length]!)
  }
  const wireCommunity = (nodes: number[], bridge: number[]): void => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]!
      const near = sortedByDistance(a, nodes)
      addLink(a, near[1 + Math.floor(mixedHash01(a, 101) * 4)] ?? nodes[(i + 1) % nodes.length]!)
      addLink(a, near[4 + Math.floor(mixedHash01(a, 107) * 8)] ?? nodes[(i + 4) % nodes.length]!)
      if (i % 3 === 0) addLink(a, near[10 + Math.floor(mixedHash01(a, 109) * 12)] ?? nodes[(i + 11) % nodes.length]!)
      if (i % 5 === 0 && bridge.length > 0) addLink(a, bridge[Math.floor(mixedHash01(a, 909) * bridge.length) % bridge.length]!)
    }
  }
  wireCommunity(yellow, gray)
  wireCommunity(magenta, gray)
  for (let i = 0; i < Math.min(yellow.length, magenta.length); i += 9) {
    addLink(yellow[i]!, magenta[(i * 2 + 7) % magenta.length]!)
  }

  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}

function signalScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.38
  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }
  const ringCount = Math.max(28, Math.min(72, Math.floor(nodeCount * 0.14)))
  const spokeCount = Math.max(18, Math.min(48, Math.floor(nodeCount * 0.08)))
  const ringNodes: number[] = []
  const spokes: number[][] = Array.from({ length: spokeCount }, () => [])
  for (let i = 0; i < Math.min(ringCount, nodeCount); i += 1) {
    ringNodes.push(i)
    const angle = (i / ringCount) * Math.PI * 2
    const wobble = 1 + Math.sin(angle * 5.0) * 0.025
    positions[i * 2] = cx + Math.cos(angle) * radius * 0.23 * wobble
    positions[i * 2 + 1] = cy + Math.sin(angle) * radius * 0.23 * wobble
  }
  for (let node = ringNodes.length; node < nodeCount; node += 1) {
    const spoke = node % spokeCount
    const ordinal = spokes[spoke]!.length
    spokes[spoke]!.push(node)
    const spokeAngle = (spoke / spokeCount) * Math.PI * 2 + Math.sin(spoke * 4.31) * 0.035
    const row = Math.floor(ordinal / 3)
    const lane = (ordinal % 3) - 1
    const r = 0.31 + Math.min(0.66, row * 0.045 + hash01(node + 51) * 0.05)
    const tangent = spokeAngle + Math.PI / 2
    const laneOffset = lane * radius * (0.008 + row * 0.0015)
    positions[node * 2] = cx + Math.cos(spokeAngle) * radius * r + Math.cos(tangent) * laneOffset
    positions[node * 2 + 1] = cy + Math.sin(spokeAngle) * radius * r + Math.sin(tangent) * laneOffset
  }

  const links: number[] = []
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    links.push(a, b)
  }
  for (let i = 0; i < ringNodes.length; i += 1) {
    addLink(ringNodes[i]!, ringNodes[(i + 1) % ringNodes.length]!)
    if (i % 4 === 0) addLink(ringNodes[i]!, ringNodes[(i + 5) % ringNodes.length]!)
  }
  for (let spoke = 0; spoke < spokes.length; spoke += 1) {
    const nodes = spokes[spoke]!
    const root = ringNodes[Math.floor((spoke / spokeCount) * ringNodes.length) % ringNodes.length] ?? 0
    let previous = root
    for (const [i, node_] of nodes.entries()) {
      const node = node_!
      addLink(previous, node)
      if (i % 3 === 0) addLink(root, node)
      previous = node
    }
    if (spoke % 3 === 0 && nodes.length > 2) {
      const neighbor = spokes[(spoke + 1) % spokes.length]!
      if (neighbor.length > 2) addLink(nodes[Math.floor(nodes.length * 0.64)]!, neighbor[Math.floor(neighbor.length * 0.58)]!)
    }
  }
  return { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
}

function tokyoScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.405
  const nodeCount = data.nodeCount
  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }
  const satelliteCount = Math.max(0, Math.min(30, Math.floor(nodeCount * 0.055)))
  const meshCount = Math.max(1, nodeCount - satelliteCount)
  const ringCount = Math.max(8, Math.min(18, Math.round(Math.sqrt(meshCount) * 0.70)))
  const rings: number[][] = Array.from({ length: ringCount }, () => [])
  const weights: number[] = []
  let totalWeight = 0
  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ringCount === 1 ? 1 : ring / (ringCount - 1)
    const r = 0.19 + Math.pow(t, 0.90) * 0.81
    const rimBoost = ring > ringCount - 5 ? 1.95 : ring < 3 ? 0.68 : 1
    const weight = Math.max(0.16, r * rimBoost)
    weights.push(weight)
    totalWeight += weight
  }
  let assigned = 0
  for (let ring = 0; ring < ringCount; ring += 1) {
    const remainingRings = ringCount - ring - 1
    const target = Math.max(4, Math.round((weights[ring]! / totalWeight) * meshCount))
    const count = ring === ringCount - 1 ? meshCount - assigned : Math.min(target, meshCount - assigned - remainingRings * 4)
    for (let j = 0; j < count && assigned < meshCount; j += 1) {
      rings[ring]!.push(assigned)
      assigned += 1
    }
  }

  for (const [ring, ring_] of rings.entries()) {
    const nodes = ring_!
    const t = ringCount === 1 ? 1 : ring / (ringCount - 1)
    const ringRadius = 0.19 + Math.pow(t, 0.90) * 0.81
    const angleOffset = ring * 0.27 + Math.sin(ring * 1.7) * 0.045
    for (let j = 0; j < nodes.length; j += 1) {
      const node = nodes[j]!
      const t = j / nodes.length
      const angle = t * Math.PI * 2 + angleOffset + (hash01(node + 13) - 0.5) * 0.028
      const tangentNoise = (hash01(node + 301) - 0.5) * radius * 0.018
      const radialNoise = (hash01(node + 907) - 0.5) * radius * (ring > ringCount - 5 ? 0.020 : 0.034)
      const ySqueeze = 0.99 + Math.sin(angle * 2.0 + ring) * 0.012
      positions[node * 2] = cx + Math.cos(angle) * (radius * ringRadius + radialNoise) + Math.cos(angle + Math.PI / 2) * tangentNoise
      positions[node * 2 + 1] = cy + Math.sin(angle) * (radius * ringRadius + radialNoise) * ySqueeze + Math.sin(angle + Math.PI / 2) * tangentNoise
    }
  }

  for (let node = meshCount; node < nodeCount; node += 1) {
    const t = (node - meshCount) / Math.max(1, satelliteCount)
    const angle = t * Math.PI * 2 + hash01(node + 409) * 0.32
    const r = 1.08 + hash01(node + 977) * 0.18
    positions[node * 2] = cx + Math.cos(angle) * radius * r
    positions[node * 2 + 1] = cy + Math.sin(angle) * radius * r * 0.985
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
  for (let ring = 0; ring < rings.length; ring += 1) {
    const nodes = rings[ring]!
    const nextRing = rings[ring + 1]
    for (let j = 0; j < nodes.length; j += 1) {
      const a = nodes[j]!
      if (ring > rings.length - 4) addLink(a, nodes[(j + 1) % nodes.length]!)
      if (ring > rings.length - 6 && j % 2 === 0) addLink(a, nodes[(j + 2) % nodes.length]!)
      if (ring > rings.length - 4 && j % 5 === 0) addLink(a, nodes[(j + Math.floor(nodes.length * 0.08)) % nodes.length]!)
      if (nextRing && nextRing.length > 0) {
        const t = j / nodes.length
        const k = Math.floor(t * nextRing.length)
        addLink(a, nextRing[k % nextRing.length]!)
        addLink(a, nextRing[(k + 1) % nextRing.length]!)
        if (j % 3 === 0) addLink(a, nextRing[(k + nextRing.length - 1) % nextRing.length]!)
        if (ring > rings.length - 6 && j % 4 === 0) addLink(a, nextRing[(k + 3) % nextRing.length]!)
      }
      if (ring > 0 && ring < rings.length - 2 && j % 4 === 0) {
        const chordRing = rings[Math.min(rings.length - 1, ring + 2 + (j % 2))]!
        const k = Math.floor((j / nodes.length) * chordRing.length + chordRing.length * (j % 8 === 0 ? 0.21 : -0.15))
        addLink(a, chordRing[k % chordRing.length]!)
      }
      if (ring > 2 && ring < rings.length - 3 && j % 11 === 0) {
        const chordRing = rings[Math.max(0, ring - 2)]!
        const k = Math.floor((j / nodes.length) * chordRing.length + chordRing.length * 0.37)
        addLink(a, chordRing[k % chordRing.length]!)
      }
    }
  }
  const outer = rings[rings.length - 1] ?? []
  for (let node = meshCount; node < nodeCount; node += 1) {
    if (outer.length === 0) break
    const k = Math.floor(hash01(node + 4_091) * outer.length)
    addLink(node, outer[k % outer.length]!)
    if (node % 4 === 0) addLink(node, outer[(k + Math.floor(outer.length * 0.11)) % outer.length]!)
  }
  const redSectorNodes: number[] = []
  for (let node = 0; node < meshCount; node += 1) {
    const x = positions[node * 2] ?? cx
    const y = positions[node * 2 + 1] ?? cy
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy) / radius
    if (dx > radius * 0.02 && dy < radius * 0.28 && dy > -radius * 0.82 && r > 0.32) redSectorNodes.push(node)
  }
  redSectorNodes.sort((a, b) => {
    const aa = Math.atan2((positions[a * 2 + 1] ?? cy) - cy, (positions[a * 2] ?? cx) - cx)
    const bb = Math.atan2((positions[b * 2 + 1] ?? cy) - cy, (positions[b * 2] ?? cx) - cx)
    return aa - bb
  })
  for (let i = 0; i < redSectorNodes.length; i += 1) {
    const a = redSectorNodes[i]!
    addLink(a, redSectorNodes[(i + 1) % redSectorNodes.length]!)
    addLink(a, redSectorNodes[(i + 2) % redSectorNodes.length]!)
    if (i % 2 === 0) addLink(a, redSectorNodes[(i + 5) % redSectorNodes.length]!)
    if (i % 4 === 0) addLink(a, redSectorNodes[(i + Math.floor(redSectorNodes.length * 0.28)) % redSectorNodes.length]!)
  }
  return { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
}

function subnetScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const center = spaceSize / 2
  const groupForNode = new Int32Array(nodeCount)
  const groups = 7
  const clusterAngles = [-2.58, -1.88, -0.82, 0.00, 0.78, 1.62, 2.46]
  const clusterRadii = [1760, 1780, 1670, 1760, 1700, 1650, 1780]
  const hubIndices: number[] = []
  const membersByGroup: number[][] = Array.from({ length: groups }, () => [])
  positions[0] = center
  positions[1] = center
  groupForNode[0] = -1
  let cursor = 1
  for (let group = 0; group < groups && cursor < nodeCount; group += 1) {
    const angle = clusterAngles[group] ?? 0
    positions[cursor * 2] = center + Math.cos(angle) * (clusterRadii[group] ?? 1700) * 0.40
    positions[cursor * 2 + 1] = center + Math.sin(angle) * (clusterRadii[group] ?? 1700) * 0.34
    groupForNode[cursor] = group
    hubIndices[group] = cursor
    cursor += 1
  }
  while (cursor < nodeCount) {
    const group = (cursor - 1) % groups
    const hub = hubIndices[group] ?? 0
    const ordinal = membersByGroup[group]!.length
    const angle = (clusterAngles[group] ?? 0) + (ordinal * 2.399963229728653) + (hash01(cursor) - 0.5) * 0.56
    const ring = Math.floor(ordinal / 18)
    const r = 170 + ring * 80 + Math.sqrt(hash01(cursor + 23)) * 260
    const stretch = group === 0 || group === 3 ? 1.34 : 1.08
    positions[cursor * 2] = (positions[hub * 2] ?? center) + Math.cos(angle) * r * stretch
    positions[cursor * 2 + 1] = (positions[hub * 2 + 1] ?? center) + Math.sin(angle) * r * 0.82
    groupForNode[cursor] = group
    membersByGroup[group]!.push(cursor)
    cursor += 1
  }

  const links: number[] = []
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    links.push(a, b)
  }
  for (let group = 0; group < groups; group += 1) {
    const hub = hubIndices[group] ?? 0
    addLink(0, hub)
    const members = membersByGroup[group] ?? []
    for (let i = 0; i < members.length; i += 1) {
      const node = members[i]!
      addLink(hub, node)
      if (i > 0) addLink(members[i - 1]!, node)
      if (i > 4 && i % 2 === 0) addLink(members[(i + members.length - 5) % members.length]!, node)
      if (i % 9 === 0) addLink(node, members[Math.floor(hash01(node + 707) * members.length)] ?? hub)
    }
  }
  for (let group = 0; group < groups; group += 1) {
    addLink(hubIndices[group] ?? 0, hubIndices[(group + 1) % groups] ?? 0)
    if (group % 2 === 0) addLink(hubIndices[group] ?? 0, hubIndices[(group + 2) % groups] ?? 0)
  }
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}

export function displayPaletteColor (idx: number, isLight: boolean): [number, number, number] {
  return isLight ? lightPaletteColor(idx) : paletteColor(idx)
}

export function galleryParticleColor (
  palette: GalleryPalette,
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  if (palette === 'ember') return emberParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'ion') return ionParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'signal') return signalParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'tokyo') return tokyoParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'subnet') return subnetParticleColor(normalizedX, normalizedY, hash, degree)
  if (palette === 'insight') return insightParticleColor(normalizedX, normalizedY, hash, degree)
  return paletteColor(Math.floor(hash * 8))
}

export function galleryLinkColor (
  palette: GalleryPalette,
  sourceY: number,
  targetY: number,
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  if (palette === 'ember') return emberLinkColor(sourceY, targetY, sourceColor, targetColor)
  if (palette === 'ion') return ionLinkColor(sourceColor, targetColor)
  if (palette === 'signal') return signalLinkColor(sourceColor, targetColor)
  if (palette === 'tokyo') return tokyoLinkColor(sourceColor, targetColor)
  if (palette === 'subnet') return subnetLinkColor(sourceColor, targetColor)
  if (palette === 'insight') return insightLinkColor(sourceColor, targetColor)
  return mixRgb(sourceColor, targetColor, 0.5)
}

function paletteColor (idx: number): [number, number, number] {
  const palette: [number, number, number][] = [
    [0.11, 0.70, 1.00],
    [0.02, 0.78, 0.58],
    [0.62, 0.92, 0.07],
    [1.00, 0.62, 0.00],
    [0.98, 0.18, 0.67],
    [0.45, 0.38, 1.00],
    [1.00, 0.32, 0.18],
    [0.95, 0.10, 0.34],
  ]
  return palette[idx % palette.length] ?? [0.5, 0.7, 1]
}

function lightPaletteColor (idx: number): [number, number, number] {
  const palette: [number, number, number][] = [
    [0.00, 0.48, 1.00],
    [0.00, 0.70, 0.52],
    [0.46, 0.78, 0.00],
    [1.00, 0.50, 0.00],
    [1.00, 0.08, 0.54],
    [0.50, 0.30, 1.00],
    [1.00, 0.24, 0.10],
    [0.94, 0.00, 0.28],
  ]
  return palette[idx % palette.length] ?? [0.0, 0.48, 1.0]
}

function clamp01 (value: number): number {
  return Math.max(0, Math.min(1, value))
}

function hash01 (index: number): number {
  return (Math.imul(index + 1, 2654435761) >>> 0) / 0x1_0000_0000
}

function mixedHash01 (index: number, salt: number): number {
  let x = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return (x >>> 0) / 0x1_0000_0000
}

function mixRgb (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const u = clamp01(t)
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ]
}

function emberParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const top = clamp01((0.58 - normalizedY) / 0.48)
  const bottom = clamp01((normalizedY - 0.42) / 0.52)
  const equatorShadow = Math.exp(-Math.pow((normalizedY - 0.50) / 0.105, 2))
  const rim = clamp01(Math.abs(normalizedX - 0.5) * 2)
  const spark = clamp01((degree > 9 ? 0.20 : 0) + (hash > 0.86 ? (hash - 0.86) * 1.8 : 0))
  const warm: [number, number, number] = [1.0, 0.55 + spark * 0.18, 0.08]
  const hot: [number, number, number] = [1.0, 0.93, 0.70]
  const silver: [number, number, number] = [0.78, 0.84, 0.82]
  const white: [number, number, number] = [0.96, 0.98, 0.95]
  const coal: [number, number, number] = [0.09, 0.075, 0.055]
  const upper = mixRgb(warm, hot, clamp01(top * 0.58 + spark))
  const lower = mixRgb(silver, white, clamp01(bottom * 0.42 + rim * 0.18))
  const lit = top >= bottom ? upper : lower
  return mixRgb(lit, coal, clamp01(equatorShadow * (0.74 - rim * 0.30)))
}

function emberLinkColor (
  sourceY: number,
  targetY: number,
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  const midY = (sourceY + targetY) * 0.5
  const equatorShadow = Math.exp(-Math.pow((midY - 0.50) / 0.13, 2))
  const base = mixRgb(sourceColor, targetColor, 0.5)
  return mixRgb(base, [0.12, 0.10, 0.08], clamp01(0.54 + equatorShadow * 0.30))
}

function ionParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const angle = Math.atan2(normalizedY - 0.5, normalizedX - 0.5)
  const radial = Math.hypot(normalizedX - 0.5, normalizedY - 0.5)
  const band = (Math.sin(angle * 3.0 + radial * 10.0) + 1) * 0.5
  const cyan: [number, number, number] = [0.02, 0.94, 1.0]
  const magenta: [number, number, number] = [1.0, 0.12, 0.78]
  const violet: [number, number, number] = [0.46, 0.28, 1.0]
  const green: [number, number, number] = [0.34, 1.0, 0.54]
  const base = band < 0.34
    ? mixRgb(cyan, green, band / 0.34)
    : band < 0.68
      ? mixRgb(green, magenta, (band - 0.34) / 0.34)
      : mixRgb(magenta, violet, (band - 0.68) / 0.32)
  const hot = clamp01((degree > 8 ? 0.18 : 0) + (hash > 0.92 ? (hash - 0.92) * 4.0 : 0))
  return mixRgb(base, [0.92, 0.98, 1.0], hot)
}

function ionLinkColor (
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  return mixRgb(mixRgb(sourceColor, targetColor, 0.5), [0.06, 0.10, 0.18], 0.42)
}

function signalParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const cx = normalizedX - 0.5
  const cy = normalizedY - 0.5
  const radial = Math.hypot(cx, cy)
  const ring = Math.exp(-Math.pow((radial - 0.28) / 0.030, 2))
  const spoke = Math.exp(-Math.pow(Math.sin(Math.atan2(cy, cx) * 18), 2) / 0.12)
  const hub = Math.exp(-Math.pow(radial / 0.11, 2))
  const orangePulse = hash > 0.992 || (degree > 24 && hash > 0.965)
  if (orangePulse) return [1.0, 0.22 + ring * 0.18, 0.02]
  const luminance = clamp01(0.36 + ring * 0.54 + hub * 0.48 + spoke * 0.10 + (hash > 0.92 ? 0.18 : 0))
  return [luminance, luminance * 0.98, luminance * 0.92]
}

function signalLinkColor (
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const isOrange = base[0] > 0.85 && base[1] < 0.42
  return isOrange ? mixRgb(base, [1.0, 0.24, 0.04], 0.42) : mixRgb(base, [0.90, 0.90, 0.86], 0.62)
}

function tokyoParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const cx = normalizedX - 0.5
  const cy = normalizedY - 0.5
  const radial = Math.hypot(cx, cy)
  const angle = Math.atan2(cy, cx)
  const redSector = normalizedX > 0.51 && normalizedY > 0.51 && angle > 0.08 && angle < 1.45
  if (redSector && (radial > 0.30 || degree > 8 || hash > 0.62)) {
    const heat = clamp01(0.82 + radial * 0.42 + (degree > 10 ? 0.12 : 0))
    return [heat, 0.13 + hash * 0.06, 0.08]
  }
  const rim = Math.exp(-Math.pow((radial - 0.49) / 0.045, 2))
  const star = degree > 12 || hash > 0.985
  const luminance = clamp01((star ? 1.0 : 0.72) + rim * 0.26 + (hash > 0.93 ? 0.11 : 0))
  return [luminance, luminance, luminance * 0.97]
}

function tokyoLinkColor (
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const isRed = base[0] > 0.72 && base[1] < 0.36 && base[2] < 0.26
  return isRed ? mixRgb(base, [1.0, 0.18, 0.10], 0.34) : mixRgb(base, [0.82, 0.82, 0.80], 0.52)
}

function insightParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const yellow = normalizedX < 0.48 && normalizedY < 0.48
  const magenta = normalizedX > 0.46 && normalizedY > 0.47
  if (yellow) {
    const lift = clamp01(0.72 + degree * 0.018 + hash * 0.10)
    return [1.0, lift * 0.72, 0.02]
  }
  if (magenta) {
    const lift = clamp01(0.68 + degree * 0.017 + hash * 0.12)
    return [1.0, 0.30 + lift * 0.22, 0.86]
  }
  const v = clamp01(0.18 + degree * 0.010 + hash * 0.08)
  return [v, v, v]
}

function insightLinkColor (
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  const base = mixRgb(sourceColor, targetColor, 0.5)
  const highlighted = base[0] > 0.70 && (base[1] > 0.30 || base[2] > 0.46)
  return highlighted ? base : mixRgb(base, [0.26, 0.26, 0.26], 0.76)
}

function subnetParticleColor (
  normalizedX: number,
  normalizedY: number,
  hash: number,
  degree: number
): [number, number, number] {
  const angle = Math.atan2(normalizedY - 0.5, normalizedX - 0.5)
  const sector = (Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 7) + 7) % 7
  const palette: [number, number, number][] = [
    [0.50, 0.16, 1.00],
    [0.83, 0.18, 0.92],
    [1.00, 0.16, 0.14],
    [1.00, 0.55, 0.00],
    [1.00, 0.92, 0.00],
    [0.26, 0.82, 0.14],
    [0.28, 0.60, 1.00],
  ]
  const base = palette[sector] ?? palette[0]!
  const hubLift = clamp01((degree - 4) / 18)
  const jitter = (hash - 0.5) * 0.06
  return [
    clamp01(base[0] + hubLift * 0.08 + jitter),
    clamp01(base[1] + hubLift * 0.08 + jitter),
    clamp01(base[2] + hubLift * 0.08 + jitter),
  ]
}

function subnetLinkColor (
  sourceColor: [number, number, number],
  targetColor: [number, number, number]
): [number, number, number] {
  return mixRgb(mixRgb(sourceColor, targetColor, 0.48), [1.0, 1.0, 1.0], 0.10)
}
