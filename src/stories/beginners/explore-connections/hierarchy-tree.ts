export type RGBA = [number, number, number, number]

const branchColors: RGBA[] = [
  [0.40, 0.50, 0.95, 1.0], // bright blue
  [0.95, 0.40, 0.40, 1.0], // coral red
  [0.30, 0.85, 0.55, 1.0], // emerald green
  [0.95, 0.70, 0.20, 1.0], // amber
  [0.75, 0.45, 0.90, 1.0], // violet
  [0.20, 0.80, 0.85, 1.0], // cyan
]

const rootColor: RGBA = [0.92, 0.92, 0.96, 1.0]

export interface TreeNode {
  index: number;
  depth: number;
  color: RGBA;
  children: TreeNode[];
  // Set during layout
  x: number;
  y: number;
  leafCount: number;
}

export interface LinkData {
  source: number;
  target: number;
  color: RGBA;
}

interface HierarchyTreeData {
  allNodes: TreeNode[];
  linkDataArray: LinkData[];
}

function buildBranch (
  depth: number,
  maxDepth: number,
  childrenPerLevel: number[],
  branchColor: RGBA,
  counter: { value: number }
): TreeNode[] {
  if (depth > maxDepth) return []

  const numChildren = childrenPerLevel[depth - 2] ?? 2
  const children: TreeNode[] = []

  for (let i = 0; i < numChildren; i++) {
    const node: TreeNode = {
      index: counter.value++,
      depth,
      x: 0,
      y: 0,
      color: branchColor,
      leafCount: 0,
      children: buildBranch(depth + 1, maxDepth, childrenPerLevel, branchColor, counter),
    }
    children.push(node)
  }

  return children
}

/** Count leaves in each subtree (used to allocate angular space proportionally). */
function countLeaves (node: TreeNode): number {
  if (node.children.length === 0) {
    node.leafCount = 1
    return 1
  }
  node.leafCount = node.children.reduce((sum, c) => sum + countLeaves(c), 0)
  return node.leafCount
}

/** Position nodes radially: each node gets an angular range proportional to its leaf count. */
function layoutRadial (
  node: TreeNode,
  angleStart: number,
  angleEnd: number,
  cx: number,
  cy: number,
  radii: number[]
): void {
  const r = radii[node.depth] ?? radii[radii.length - 1] ?? 0
  const angleMid = (angleStart + angleEnd) / 2
  node.x = cx + r * Math.cos(angleMid)
  node.y = cy + r * Math.sin(angleMid)

  let currentAngle = angleStart
  for (const child of node.children) {
    const childSpan = ((child.leafCount / node.leafCount) * (angleEnd - angleStart))
    layoutRadial(child, currentAngle, currentAngle + childSpan, cx, cy, radii)
    currentAngle += childSpan
  }
}

function collectAll (node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(collectAll)]
}

function collectLinks (node: TreeNode): LinkData[] {
  const out: LinkData[] = []
  for (const child of node.children) {
    out.push({ source: node.index, target: child.index, color: child.color })
    out.push(...collectLinks(child))
  }
  return out
}

export function buildHierarchyTreeData (): HierarchyTreeData {
  const counter = { value: 1 }

  const numBranches = 6
  const maxDepth = 4
  const childrenPerLevel = [3, 3, 2] // depth 2->3 kids, depth 3->3 kids, depth 4->2 kids

  const root: TreeNode = {
    index: 0,
    depth: 0,
    x: 0,
    y: 0,
    color: rootColor,
    leafCount: 0,
    children: [],
  }

  for (let b = 0; b < numBranches; b++) {
    const color: RGBA = branchColors[b % branchColors.length] ?? rootColor
    const branchHead: TreeNode = {
      index: counter.value++,
      depth: 1,
      x: 0,
      y: 0,
      color,
      leafCount: 0,
      children: buildBranch(2, maxDepth, childrenPerLevel, color, counter),
    }
    root.children.push(branchHead)
  }

  countLeaves(root)

  // Radii for each depth level (in space coordinates)
  const cx = 2048
  const cy = 2048
  const radii = [0, 320, 640, 960, 1250]

  // Small angular gap between branches for visual separation
  const gap = 0.06
  const totalGap = gap * numBranches
  const usableAngle = Math.PI * 2 - totalGap

  root.x = cx
  root.y = cy

  let angle = -Math.PI / 2 // start from top
  for (const branch of root.children) {
    const span = (branch.leafCount / root.leafCount) * usableAngle
    layoutRadial(branch, angle, angle + span, cx, cy, radii)
    angle += span + gap
  }

  return {
    allNodes: collectAll(root),
    linkDataArray: collectLinks(root),
  }
}
