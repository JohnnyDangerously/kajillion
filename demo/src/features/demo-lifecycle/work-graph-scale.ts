import type { GeneratedGraph } from '../../generate-graph'
import {
  DEMO_CONTENT_SCALE,
  DEMO_SPACE_SIZE,
  SOURCE_SPACE_SIZE,
} from './demo-space'

export function scaleGeneratedDataToDemoSpace (data: GeneratedGraph): GeneratedGraph {
  const sourceCenter = SOURCE_SPACE_SIZE / 2
  const demoCenter = DEMO_SPACE_SIZE / 2
  const positions = new Float32Array(data.positions.length)
  for (let i = 0; i < data.positions.length; i += 2) {
    positions[i] = demoCenter + ((data.positions[i] ?? sourceCenter) - sourceCenter) * DEMO_CONTENT_SCALE
    positions[i + 1] = demoCenter + ((data.positions[i + 1] ?? sourceCenter) - sourceCenter) * DEMO_CONTENT_SCALE
  }
  return {
    positions,
    links: data.links,
    nodeCount: data.nodeCount,
    edgeCount: data.edgeCount,
  }
}
