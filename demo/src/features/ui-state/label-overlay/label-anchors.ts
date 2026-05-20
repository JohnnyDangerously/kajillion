import type { GeneratedGraph } from '../../../generate-graph'
import {
  cosmicLabelAnchors,
  fintechLabelAnchors,
  influenceLabelAnchors,
  talentLabelAnchors,
} from '../../../gallery-presets'
import { isWorkMode } from '../../work-mode'
import type { DemoConfig } from '../../control-plane/types'
import { DEMO_SPACE_SIZE } from '../../demo-lifecycle/demo-space'
import { WORK_GROUPS, type WorkGraphData } from '../../demo-lifecycle/work-graph-types'

export interface LabelAnchor {
  label: string;
  x: number;
  y: number;
}

export function buildLabelAnchors (data: GeneratedGraph, config: DemoConfig): LabelAnchor[] {
  if (config.palette === 'subnet' && config.theme === 'light') {
    const groupForNode = (data as GeneratedGraph & { groupForNode?: Int32Array }).groupForNode
    if (groupForNode) {
      const labels = ['10.55.2.36', '10.55.2.40', '172.17.12.30', '192.168.22.54', '192.168.22.52', '172.31.111.126', '172.16.3.15']
      const sums = labels.map(label => ({ label, x: 0, y: 0, count: 0 }))
      for (let i = 0; i < data.nodeCount; i += 1) {
        const group = groupForNode[i] ?? -1
        const bucket = group >= 0 ? sums[group] : undefined
        if (!bucket) continue
        bucket.x += data.positions[i * 2] ?? 0
        bucket.y += data.positions[i * 2 + 1] ?? 0
        bucket.count += 1
      }
      return [
        { label: '172.31.111.124', x: DEMO_SPACE_SIZE / 2, y: DEMO_SPACE_SIZE / 2 },
        ...sums.filter(item => item.count > 0).map(item => ({
          label: item.label,
          x: item.x / item.count,
          y: item.y / item.count,
        })),
      ]
    }
  }
  if (isWorkMode(config)) {
    const center = DEMO_SPACE_SIZE / 2
    if (config.palette === 'analyst' && config.theme === 'light') {
      const workData = data as WorkGraphData
      const groupForNode = workData.groupForNode
      if (groupForNode) {
        const sums = WORK_GROUPS.map(group => ({ label: group.label, x: 0, y: 0, count: 0 }))
        for (let i = 0; i < data.nodeCount; i += 1) {
          const group = groupForNode[i] ?? -1
          const bucket = group >= 0 ? sums[group] : undefined
          if (!bucket) continue
          bucket.x += data.positions[i * 2] ?? center
          bucket.y += data.positions[i * 2 + 1] ?? center
          bucket.count += 1
        }
        return sums.filter(item => item.count > 0).map(item => ({
          label: item.label,
          x: item.x / item.count,
          y: item.y / item.count,
        }))
      }
    }
    const groupLabels = WORK_GROUPS.map(group => ({
      label: group.label,
      x: center + Math.cos(group.angle) * group.radius * 0.35,
      y: center - Math.sin(group.angle) * group.radius * 0.35,
    }))
    return [
      {
        label: 'CRM Graph',
        x: center,
        y: center,
      },
      ...groupLabels,
    ]
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < data.positions.length; i += 2) {
    const x = data.positions[i] ?? DEMO_SPACE_SIZE / 2
    const y = data.positions[i + 1] ?? DEMO_SPACE_SIZE / 2
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (config.palette === 'tokyo' && config.theme === 'dark') {
    return [
      { label: 'CONNECTING', x: minX + (maxX - minX) * 0.24, y: minY + (maxY - minY) * 0.46 },
      { label: 'THE', x: minX + (maxX - minX) * 0.63, y: minY + (maxY - minY) * 0.39 },
      { label: 'UNCONNECTED', x: minX + (maxX - minX) * 0.69, y: minY + (maxY - minY) * 0.31 },
      { label: '結', x: minX + (maxX - minX) * 0.50, y: minY + (maxY - minY) * 0.53 },
    ]
  }
  if (config.palette === 'signal' && config.theme === 'dark') {
    return [
      { label: 'BIG_DATA', x: minX + (maxX - minX) * 0.16, y: minY + (maxY - minY) * 0.24 },
      { label: 'R-7.1', x: minX + (maxX - minX) * 0.67, y: minY + (maxY - minY) * 0.18 },
      { label: 'INPUT', x: minX + (maxX - minX) * 0.83, y: minY + (maxY - minY) * 0.38 },
      { label: 'NODE.08', x: minX + (maxX - minX) * 0.76, y: minY + (maxY - minY) * 0.72 },
      { label: '2024-5094', x: minX + (maxX - minX) * 0.22, y: minY + (maxY - minY) * 0.68 },
      { label: 'SYSTEM', x: minX + (maxX - minX) * 0.49, y: minY + (maxY - minY) * 0.46 },
    ]
  }
  if (config.palette === 'cosmic' && config.theme === 'dark') {
    return cosmicLabelAnchors(DEMO_SPACE_SIZE)
  }
  if (config.palette === 'insight' && config.theme === 'dark') {
    return [
      { label: 'nation', x: minX + (maxX - minX) * 0.39, y: minY + (maxY - minY) * 0.43 },
      { label: 'check', x: minX + (maxX - minX) * 0.41, y: minY + (maxY - minY) * 0.68 },
      { label: 'back', x: minX + (maxX - minX) * 0.69, y: minY + (maxY - minY) * 0.36 },
      { label: 'mississippi', x: minX + (maxX - minX) * 0.58, y: minY + (maxY - minY) * 0.43 },
      { label: 'faith', x: minX + (maxX - minX) * 0.77, y: minY + (maxY - minY) * 0.25 },
      { label: 'hope', x: minX + (maxX - minX) * 0.61, y: minY + (maxY - minY) * 0.24 },
    ]
  }
  if (config.palette === 'fintech' && config.theme === 'dark') {
    return fintechLabelAnchors(DEMO_SPACE_SIZE)
  }
  if (config.palette === 'influence' && config.theme === 'dark') {
    return influenceLabelAnchors(DEMO_SPACE_SIZE)
  }
  if (config.palette === 'talent' && config.theme === 'dark') {
    return talentLabelAnchors(DEMO_SPACE_SIZE)
  }
  const names = ['Research', 'Product', 'Growth', 'Operations', 'Finance', 'Success', 'Customer']
  const spots: [number, number][] = [
    [0.50, 0.22],
    [0.64, 0.44],
    [0.34, 0.47],
    [0.50, 0.74],
    [0.77, 0.64],
  ]
  return names.map((label, i) => {
    const [nx, ny] = spots[i] ?? [0.5, 0.5]
    return {
      label,
      x: minX + (maxX - minX) * nx,
      y: minY + (maxY - minY) * ny,
    }
  })
}
