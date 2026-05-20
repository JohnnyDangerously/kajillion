import { Graph } from '@kajillion/graph'

export interface BenchDiagnostics {
  deviceType?: string;
  canvasCssWidth: number;
  canvasCssHeight: number;
  canvasBackbufferWidth: number;
  canvasBackbufferHeight: number;
  effectivePixelRatioX: number;
  effectivePixelRatioY: number;
}

export interface PowerInfo {
  /** True if `navigator.getBattery()` was available and resolved. */
  supported: boolean;
  /** [0, 1]. Undefined when unsupported. */
  level?: number;
  charging?: boolean;
  /**
   * Throttle hint: machine is NOT on charger. macOS Low Power Mode kicks in
   * silently when discharging (especially below 80%) and drops GPU perf
   * ~1.5-2×. There is no web API for LPM directly, so charger state is the
   * best proxy available. If true, cross-run perf comparisons against
   * AC-power baselines are invalid.
   *
   * Caveat: Chrome reports `charging: false` for AC machines in the
   * "finishing charge" trickle state near 100%. We treat level >= 0.97 as
   * AC-equivalent to avoid false throttle alarms on plugged-in laptops.
   */
  throttleSuspected?: boolean;
}

export function captureDiagnostics (
  graph: Graph,
  graphDiv: HTMLDivElement
): BenchDiagnostics {
  const canvas = graphDiv.querySelector('canvas')
  const cssWidth = canvas?.clientWidth ?? 0
  const cssHeight = canvas?.clientHeight ?? 0
  const backbufferWidth = canvas?.width ?? 0
  const backbufferHeight = canvas?.height ?? 0
  const effectivePixelRatioX = cssWidth > 0 ? backbufferWidth / cssWidth : 0
  const effectivePixelRatioY = cssHeight > 0 ? backbufferHeight / cssHeight : 0
  return {
    deviceType: (graph as unknown as { device?: { info?: { type?: string } } }).device?.info?.type,
    canvasCssWidth: cssWidth,
    canvasCssHeight: cssHeight,
    canvasBackbufferWidth: backbufferWidth,
    canvasBackbufferHeight: backbufferHeight,
    effectivePixelRatioX,
    effectivePixelRatioY,
  }
}

export async function getPowerInfo (): Promise<PowerInfo> {
  type NavigatorBattery = Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  }
  const nav = navigator as NavigatorBattery
  if (typeof nav.getBattery !== 'function') return { supported: false }
  try {
    const battery = await nav.getBattery()
    // Treat near-full battery as AC-equivalent: Chrome reports charging=false
    // during the "finishing charge" trickle, which is indistinguishable from
    // an at-rest-on-AC state but trips the throttle heuristic falsely.
    const throttleSuspected = !battery.charging && battery.level < 0.97
    return {
      supported: true,
      level: battery.level,
      charging: battery.charging,
      throttleSuspected,
    }
  } catch {
    return { supported: false }
  }
}

export function formatPowerInfo (info: PowerInfo): string {
  if (!info.supported) return 'navigator.getBattery unavailable (Safari/other)'
  const pct = info.level !== undefined ? `${Math.round(info.level * 100)}%` : '?'
  // Near-full + not-charging is the AC "finishing charge" trickle state.
  const acFinishingCharge = !info.charging && info.level !== undefined && info.level >= 0.97
  const src = info.charging ? 'AC' : (acFinishingCharge ? 'AC?' : 'Battery')
  const warn = info.throttleSuspected ? ' ⚠︎ likely throttled' : ''
  return `${src} ${pct}${warn}`
}
