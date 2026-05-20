import type { ControlElements } from '../control-plane/dom'
import { isWorkMode } from '../control-plane/controls'
import type { DemoConfig } from '../control-plane/types'

export function syncToggleButtonLabels (
  ctlEl: ControlElements,
  currentConfig: DemoConfig | undefined,
  activeLod?: string
): void {
  const isDark = ctlEl.theme.classList.contains('active')
  const isWork = currentConfig ? isWorkMode(currentConfig) : ctlEl.data.value === 'work'
  const isDense = ctlEl.density.classList.contains('active')
  const hasEdges = ctlEl.edges.classList.contains('active')
  const hasLod = ctlEl.lod.classList.contains('active')
  const hasLanes = ctlEl.lanes.classList.contains('active')
  const hasTilt = ctlEl.tilt.classList.contains('active')
  ctlEl.theme.textContent = isDark ? 'dark' : 'light'
  ctlEl.density.textContent = isWork ? (isDense ? 'large' : 'compact') : (isDense ? 'dense' : 'sparse')
  ctlEl.edges.textContent = hasEdges ? 'edges' : 'points'
  ctlEl.lod.textContent = isWork ? (hasLod ? 'rank' : 'even') : (hasLod ? 'phantom' : 'exact')
  ctlEl.lanes.textContent = hasLanes ? 'lanes' : 'straight'
  ctlEl.tilt.textContent = hasTilt ? 'tilt' : 'flat'
  for (const button of [ctlEl.theme, ctlEl.density, ctlEl.edges, ctlEl.lod, ctlEl.lanes, ctlEl.tilt]) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')))
  }
  writeModeReadout(ctlEl, currentConfig, activeLod)
}

export function writeModeReadout (
  ctlEl: ControlElements,
  currentConfig: DemoConfig | undefined,
  activeLod?: string
): void {
  const isDark = ctlEl.theme.classList.contains('active')
  const isWork = ctlEl.data.value === 'work'
  const hasEdges = ctlEl.edges.classList.contains('active')
  const hasLod = ctlEl.lod.classList.contains('active')
  const hasLanes = ctlEl.lanes.classList.contains('active')
  const hasTilt = ctlEl.tilt.classList.contains('active')
  const usesStableDpr = currentConfig?.palette === 'cosmic' && isDark
  const isMassAuto = ctlEl.webgpu.checked && hasLod && !isWork && parseInt(ctlEl.n.value, 10) >= 50000
  const paletteLabel = currentConfig && currentConfig.palette !== 'category'
    ? currentConfig.palette === 'subnet'
      ? 'subnet map'
      : isDark ? currentConfig.palette : `${currentConfig.palette} light`
    : null
  const modeParts = [
    ctlEl.webgpu.checked ? 'WebGPU' : 'WebGL',
    ctlEl.msaa.checked && ctlEl.webgpu.checked ? 'MSAA 4x' : 'MSAA off',
    ctlEl.adpr.checked && isDark && !usesStableDpr ? 'adaptive DPR' : 'native DPR',
    paletteLabel,
    isMassAuto ? (activeLod ?? 'mass + anchors') : null,
    isWork ? (hasLod ? 'ranked nodes' : 'even nodes') : hasLod ? 'phantom nodes' : 'exact nodes',
    hasEdges
      ? isWork
        ? (hasLanes ? 'curved work graph' : 'straight work graph')
        : (hasLanes ? 'bundled edges' : 'straight edges')
      : 'points only',
    hasTilt ? 'tilted field' : null,
    currentConfig?.pointDepthCueStrength
      ? `depth ${currentConfig.pointDepthCueStrength.toFixed(2)}`
      : 'depth off',
    currentConfig?.pointTileBudget
      ? `tile ${currentConfig.pointTileBudget}`
      : 'tile off',
    ctlEl.frameCap.options[ctlEl.frameCap.selectedIndex]?.textContent?.trim() ?? 'native',
  ]
  ctlEl.modeReadout.textContent = modeParts.filter(Boolean).join(' · ')
}
