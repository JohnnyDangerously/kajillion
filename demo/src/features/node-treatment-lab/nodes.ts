import { PALETTES } from './presets'
import type { LabNode, LabState } from './types'

export function makeLabNodes (state: LabState): LabNode[] {
  const palette = PALETTES[state.palette]
  if (state.scene === 'scale') {
    const sizes = [5, 8, 12, 18, 30, 48, 72]
    return sizes.map((radius, index) => ({
      x: (index - (sizes.length - 1) / 2) * 105,
      y: 0,
      radius,
      color: palette[index % palette.length]!,
      label: `${radius}px`,
      depth: 0.25 + index / sizes.length,
      selected: index === 4,
    }))
  }
  if (state.scene === 'cluster') {
    const nodes: LabNode[] = []
    for (let i = 0; i < 44; i += 1) {
      const angle = i * 2.399963229728653
      const ring = Math.sqrt(i + 0.3)
      const radius = i % 13 === 0 ? 20 : i % 7 === 0 ? 15 : i % 5 === 0 ? 11 : 7
      nodes.push({
        x: Math.cos(angle) * ring * 34 + Math.sin(i * 0.71) * 18,
        y: Math.sin(angle) * ring * 28 + Math.cos(i * 0.59) * 14,
        radius,
        color: palette[i % palette.length]!,
        label: i === 0 ? 'VIP' : i === 13 ? 'FIRST' : undefined,
        depth: 0.20 + ((i * 7) % 11) / 14,
        selected: i === 0,
      })
    }
    return nodes
  }
  return [
    { x: -145, y: 24, radius: 32, color: palette[0]!, label: 'PERSON', depth: 0.46, selected: true },
    { x: 150, y: -42, radius: 44, color: palette[1]!, label: 'COMPANY', depth: 0.78 },
  ]
}
