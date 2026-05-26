import type { ExplodeLevel, PortraitLevel, PersonalLevel } from './view-stack'

export interface NeonRenderApi {
  renderTopOfStack: () => void;
  loadRealEdgesForExplode: (level: ExplodeLevel, signal: AbortSignal) => Promise<void>;
}

export type RenderableLevel = ExplodeLevel | PortraitLevel | PersonalLevel
