import { cosmicScene } from './cosmic'
import { fintechScene } from './fintech'
import { influenceScene } from './influence'
import { insightScene } from './insight'
import { signalScene } from './signal'
import { subnetScene } from './subnet'
import { talentScene } from './talent'
import { tokyoScene } from './tokyo'
import type { GalleryGraphData, GalleryPalette } from './types'

export function galleryRenderData<T extends GalleryGraphData> (
  palette: GalleryPalette,
  data: T,
  spaceSize: number
): T {
  if (palette === 'cosmic') return cosmicScene(data, spaceSize) as T
  if (palette === 'tokyo') return tokyoScene(data, spaceSize) as T
  if (palette === 'subnet') return subnetScene(data, spaceSize) as T
  if (palette === 'signal') return signalScene(data, spaceSize) as T
  if (palette === 'insight') return insightScene(data, spaceSize) as T
  if (palette === 'fintech') return fintechScene(data, spaceSize) as T
  if (palette === 'influence') return influenceScene(data, spaceSize) as T
  if (palette === 'talent') return talentScene(data, spaceSize) as T
  return data
}
