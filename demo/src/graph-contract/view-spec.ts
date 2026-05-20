import type { GalleryPalette } from '../gallery-presets'
import { EDGE_KIND_TO_CODE } from './edge-kinds'
import type { GraphLayoutName, ViewSpec } from './types'

export function buildDefaultViewSpec (params: {
  id?: string;
  name?: string;
  palette: GalleryPalette;
  layout?: GraphLayoutName;
  theme: 'dark' | 'light';
  density: boolean;
  lanes: boolean;
  renderLinks: boolean;
}): ViewSpec {
  return {
    schemaVersion: '0.1',
    id: params.id ?? `view-${params.palette}-${params.theme}`,
    name: params.name ?? `${params.palette} ${params.theme}`,
    layout: params.layout ?? 'force2d',
    node: {
      shape: params.density ? 'dot' : 'bubble',
      colorBy: params.palette === 'category' ? 'category' : 'preset',
      sizeBy: params.density ? 'degree' : 'importance',
    },
    edge: {
      renderer: params.lanes ? 'bundled' : 'straight',
      colorBy: 'sourceTargetMix',
      widthBy: params.lanes ? 'weight' : 'constant',
      visibleKinds: params.renderLinks ? ['observed'] : [],
    },
    labels: {
      mode: params.palette === 'category' ? 'importantOnly' : 'editorialLabels',
      field: 'label',
      maxCount: params.palette === 'category' ? 7 : 32,
    },
    effects: {
      background: params.theme,
      bloom: params.theme === 'dark' ? 0.3 : 0.08,
      saturation: params.theme === 'dark' ? 1.05 : 1.18,
      contrast: params.theme === 'dark' ? 1.0 : 1.08,
    },
    camera: {
      fitPadding: params.density ? 0.22 : 0.18,
      maxZoom: 8,
    },
  }
}

export function validateViewSpec (spec: ViewSpec): string[] {
  const errors: string[] = []
  if (spec.schemaVersion !== '0.1') errors.push(`unsupported schemaVersion: ${spec.schemaVersion}`)
  if (!spec.id) errors.push('id is required')
  if (!spec.name) errors.push('name is required')
  if (!spec.edge.visibleKinds.every(kind => kind in EDGE_KIND_TO_CODE)) errors.push('edge.visibleKinds contains an unknown kind')
  if (spec.labels.maxCount < 0) errors.push('labels.maxCount must be >= 0')
  if (spec.camera.fitPadding < 0 || spec.camera.fitPadding > 0.49) errors.push('camera.fitPadding must be in [0, 0.49]')
  return errors
}
