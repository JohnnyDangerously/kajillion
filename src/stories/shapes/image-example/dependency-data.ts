import { PointShape } from '@kajillion/graph'

// Define node types for Xcode dependency graph
enum NodeType {
  App = 0, // Main app target (swift icon)
  Framework = 1, // Framework (box icon)
  Library = 2, // Static library (toolbox icon)
  Bundle = 3, // Bundle (lego icon)
  Target = 4 // Build target (s icon)
}

interface DependencyNode {
  id: number;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  dependencies: number[];
  size: number;
  color: [number, number, number, number];
}

export interface XcodeDependencyGraphData {
  pointPositions: Float32Array;
  pointColors: Float32Array;
  pointShapes: Float32Array;
  pointSizes: Float32Array;
  imageIndices: Float32Array;
  links: number[];
  linkArrows: boolean[];
  linkColors: number[];
}

const dependencyNodes: DependencyNode[] = [
  // Main app target (center)
  { id: 0, name: 'MyApp', type: NodeType.App, x: 2048, y: 2048, dependencies: [1, 2, 3, 14], size: 60, color: [0.2, 0.6, 1.0, 1.0] },

  // Frameworks (first ring around center)
  { id: 1, name: 'CoreData', type: NodeType.Framework, x: 1024, y: 2048, dependencies: [4, 5], size: 50, color: [0.8, 0.4, 0.2, 1.0] },
  { id: 2, name: 'UIKit', type: NodeType.Framework, x: 2048, y: 1024, dependencies: [6, 15], size: 50, color: [0.8, 0.4, 0.2, 1.0] },
  { id: 3, name: 'Network', type: NodeType.Framework, x: 3072, y: 2048, dependencies: [7, 8], size: 50, color: [0.8, 0.4, 0.2, 1.0] },

  // Libraries (second ring)
  { id: 4, name: 'SQLite', type: NodeType.Library, x: 512, y: 2048, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 5, name: 'Foundation', type: NodeType.Library, x: 1024, y: 1024, dependencies: [16], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 6, name: 'CoreGraphics', type: NodeType.Library, x: 2048, y: 512, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 7, name: 'Security', type: NodeType.Library, x: 3072, y: 1024, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 8, name: 'CFNetwork', type: NodeType.Library, x: 3584, y: 2048, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },

  // Additional frameworks (first ring)
  { id: 9, name: 'Analytics', type: NodeType.Framework, x: 2048, y: 3072, dependencies: [10, 17], size: 50, color: [0.8, 0.4, 0.2, 1.0] },
  { id: 10, name: 'Firebase', type: NodeType.Library, x: 2048, y: 3840, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },

  // Test targets (outer ring)
  { id: 11, name: 'Tests', type: NodeType.Target, x: 512, y: 1024, dependencies: [0], size: 50, color: [0.4, 0.6, 1.0, 1.0] },
  { id: 12, name: 'UITests', type: NodeType.Target, x: 3584, y: 1024, dependencies: [0, 2], size: 45, color: [0.4, 0.6, 1.0, 1.0] },
  { id: 13, name: 'Widget', type: NodeType.Target, x: 3584, y: 3072, dependencies: [1, 2], size: 45, color: [0.4, 0.6, 1.0, 1.0] },

  // Additional components
  { id: 14, name: 'Localization', type: NodeType.Framework, x: 1536, y: 3072, dependencies: [18], size: 50, color: [0.8, 0.4, 0.2, 1.0] },
  { id: 15, name: 'CoreAnimation', type: NodeType.Library, x: 2560, y: 512, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 16, name: 'CoreFoundation', type: NodeType.Library, x: 1024, y: 512, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 17, name: 'Crashlytics', type: NodeType.Library, x: 1536, y: 3584, dependencies: [], size: 45, color: [0.6, 0.8, 0.4, 1.0] },
  { id: 18, name: 'LocalizationBundle', type: NodeType.Bundle, x: 1792, y: 3584, dependencies: [], size: 45, color: [1.0, 0.4, 1.0, 1.0] },

  // More test targets
  { id: 19, name: 'UnitTests', type: NodeType.Target, x: 512, y: 3072, dependencies: [0, 1], size: 45, color: [0.4, 0.6, 1.0, 1.0] },
  { id: 20, name: 'IntegrationTests', type: NodeType.Target, x: 512, y: 3584, dependencies: [0, 3], size: 45, color: [0.4, 0.6, 1.0, 1.0] },

  // Bundle resources
  { id: 21, name: 'Resources', type: NodeType.Bundle, x: 2304, y: 3072, dependencies: [0], size: 50, color: [1.0, 0.4, 1.0, 1.0] },
  { id: 22, name: 'Assets', type: NodeType.Bundle, x: 2560, y: 3584, dependencies: [0, 21], size: 50, color: [1.0, 0.4, 1.0, 1.0] },
]

const getLinkColor = (sourceType: NodeType): [number, number, number, number] => {
  switch (sourceType) {
  case NodeType.App:
    return [0.2, 0.8, 1.0, 0.8] // Bright blue
  case NodeType.Framework:
    return [1.0, 0.6, 0.2, 0.8] // Orange
  case NodeType.Library:
    return [0.4, 1.0, 0.4, 0.8] // Green
  case NodeType.Bundle:
    return [1.0, 0.4, 1.0, 0.8] // Magenta
  case NodeType.Target:
    return [0.8, 0.4, 1.0, 0.8] // Purple
  default:
    return [0.7, 0.7, 0.7, 0.8] // Gray
  }
}

export const createXcodeDependencyGraphData = (): XcodeDependencyGraphData => {
  const pointCount = dependencyNodes.length
  const pointPositions = new Float32Array(pointCount * 2)
  const pointColors = new Float32Array(pointCount * 4)
  const pointShapes = new Float32Array(pointCount)
  const pointSizes = new Float32Array(pointCount)
  const imageIndices = new Float32Array(pointCount)
  const links: number[] = []
  const linkArrows: boolean[] = []
  const linkColors: number[] = []

  for (const node of dependencyNodes) {
    const i = node.id

    pointPositions[i * 2] = node.x
    pointPositions[i * 2 + 1] = node.y
    pointShapes[i] = node.type === NodeType.Target ? PointShape.Hexagon : PointShape.None
    pointSizes[i] = node.size
    imageIndices[i] = node.type
    pointColors[i * 4] = node.color[0]
    pointColors[i * 4 + 1] = node.color[1]
    pointColors[i * 4 + 2] = node.color[2]
    pointColors[i * 4 + 3] = node.color[3]

    for (const depId of node.dependencies) {
      links.push(i, depId)
      linkArrows.push(true)

      const linkColor = getLinkColor(node.type)
      linkColors.push(linkColor[0], linkColor[1], linkColor[2], linkColor[3])
    }
  }

  return {
    pointPositions,
    pointColors,
    pointShapes,
    pointSizes,
    imageIndices,
    links,
    linkArrows,
    linkColors,
  }
}
