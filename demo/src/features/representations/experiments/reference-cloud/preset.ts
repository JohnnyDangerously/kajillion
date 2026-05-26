import type { GraphConfig } from '@kajillion/graph'
import type { VisualAttributes } from '../../../ui-state/visual-attributes'
import type { RepresentationInstallContext, RepresentationPreset, RepresentationVisualData } from '../../types'
import { installReferenceCloudOverlay } from './overlay'

export const referenceCloudPreset: RepresentationPreset = {
  id: 'reference-cloud',
  ownsCamera: true,
  applyGraphConfig (config: GraphConfig): GraphConfig {
    return {
      ...config,
      backgroundColor: '#000000',
      renderLinks: false,
      pointOpacity: 0,
      pointDefaultSize: 0,
      pointSizeScale: 0,
      fitViewOnInit: false,
      enableSimulation: false,
      enableDrag: false,
      renderLodMode: 'exact',
      impostorAutoMinPoints: 10_000_000,
      pointTileBudget: 0,
      disableIdleFrameSkip: true,
      adaptivePixelRatio: false,
      pixelRatio: 1,
      msaa: 1,
    }
  },
  transformAttributes (_data: RepresentationVisualData, attributes: VisualAttributes): void {
    attributes.pointSizes.fill(0)
    attributes.linkWidths.fill(0)
  },
  install (ctx: RepresentationInstallContext): (() => void) {
    return installReferenceCloudOverlay(ctx)
  },
}
