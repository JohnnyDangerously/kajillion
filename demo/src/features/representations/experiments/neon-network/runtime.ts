import type { ExplorerHandle } from '../../../node-explorer'
import type { BackButtonHandle } from './back-button'
import type { ColorBarHandle } from './color-bar'
import type { ClusterIndex } from './cluster-state'
import type { ClusterTooltipHandle } from './cluster-tooltip'
import type { HubLabelsHandle } from './hub-labels'
import type { PortraitLabelsHandle } from './portrait-labels'
import type { RingAnimationHandle } from './ring-animation'
import type { ViewLevel } from './view-stack'
import type { RepresentationInstallContext } from '../../types'

export interface NeonNetworkRuntime {
  ctx: RepresentationInstallContext;
  labelStyle: HTMLStyleElement;
  cancelled: boolean;
  cancelBloom: (() => void) | null;
  cancelLayoutTween: (() => void) | null;
  explorerHandle: ExplorerHandle | null;
  colorBarHandle: ColorBarHandle | null;
  tooltipHandle: ClusterTooltipHandle | null;
  backButtonHandle: BackButtonHandle | null;
  ringAnimation: RingAnimationHandle | null;
  hubLabelsHandle: HubLabelsHandle | null;
  portraitLabelsHandle: PortraitLabelsHandle | null;
  cancelLinkOpacityTween: (() => void) | null;
  csrAbort: AbortController | null;
  cancelForceRelax: (() => void) | null;
  currentPortraitAnchored: Uint8Array | null;
  draggingIdx: number;
  dragOverrideX: number;
  dragOverrideY: number;
  lastHoveredIdx: number;
  ringStartTimer: number;
  viewStack: ViewLevel[];
  currentClusterIndex: ClusterIndex | null;
}

export function createNeonRuntime (
  ctx: RepresentationInstallContext,
  labelStyle: HTMLStyleElement,
): NeonNetworkRuntime {
  return {
    ctx,
    labelStyle,
    cancelled: false,
    cancelBloom: null,
    cancelLayoutTween: null,
    explorerHandle: null,
    colorBarHandle: null,
    tooltipHandle: null,
    backButtonHandle: null,
    ringAnimation: null,
    hubLabelsHandle: null,
    portraitLabelsHandle: null,
    cancelLinkOpacityTween: null,
    csrAbort: null,
    cancelForceRelax: null,
    currentPortraitAnchored: null,
    draggingIdx: -1,
    dragOverrideX: Number.NaN,
    dragOverrideY: Number.NaN,
    lastHoveredIdx: -1,
    ringStartTimer: 0,
    viewStack: [],
    currentClusterIndex: null,
  }
}
