import type { RepresentationPreset } from '../../types'

/**
 * First-class wrapper for the existing native work graph. This intentionally
 * has no hooks: the demo runtime keeps using the current work-mode data,
 * layout, visual-attribute, camera, and interaction paths unchanged.
 */
export const workGraphPreset: RepresentationPreset = {
  id: 'work-graph',
}
