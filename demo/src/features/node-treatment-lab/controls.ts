import { drawLab } from './canvas-renderer'
import { TREATMENT_PRESETS } from './presets'
import { asTreatment, clamp } from './treatment-helpers'
import type {
  LabBorder,
  LabLighting,
  LabPalette,
  LabScene,
  LabSharpness,
  LabState,
} from './types'

type DragStart = {
  x: number;
  y: number;
  panX: number;
  panY: number;
}

function setOpen (panel: HTMLElement, tab: HTMLButtonElement, open: boolean): void {
  panel.classList.toggle('open', open)
  tab.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function setSelectValue (id: string, value: string): void {
  const el = document.getElementById(id) as HTMLSelectElement | HTMLInputElement | null
  if (el) el.value = value
}

function readSelect<T extends string> (id: string, fallback: T): T {
  return ((document.getElementById(id) as HTMLSelectElement | null)?.value ?? fallback) as T
}

function syncControls (state: LabState): void {
  setSelectValue('node-lab-scene', state.scene)
  setSelectValue('node-lab-palette', state.palette)
  setSelectValue('node-lab-border', state.border)
  setSelectValue('node-lab-lighting', state.lighting)
  setSelectValue('node-lab-sharpness', state.sharpness)
  setSelectValue('node-lab-zoom', String(Math.round(state.zoom)))
}

export function initNodeTreatmentLabControls (state: LabState): void {
  const tab = document.getElementById('node-lab-tab') as HTMLButtonElement | null
  const panel = document.getElementById('node-treatment-lab')
  const close = document.getElementById('node-lab-close') as HTMLButtonElement | null
  const canvas = document.getElementById('node-lab-canvas') as HTMLCanvasElement | null
  const fill = document.getElementById('node-lab-fill')
  const edge = document.getElementById('node-lab-edge')
  const cost = document.getElementById('node-lab-cost')
  const pass = document.getElementById('node-lab-pass')
  const zoomReadout = document.getElementById('node-lab-zoom-readout')
  const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.node-lab-option'))
  const zoomButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-node-lab-zoom]'))
  if (!tab || !panel || !close || !canvas) return

  let dragStart: DragStart | null = null

  const render = (): void => {
    syncControls(state)
    drawLab(canvas, state)
    const meta = TREATMENT_PRESETS[state.treatment]
    if (fill) fill.textContent = `${state.palette} ${state.lighting}`
    if (edge) edge.textContent = `${state.border} border`
    if (cost) cost.textContent = meta.cost
    if (pass) pass.textContent = `${state.sharpness} preview`
    if (zoomReadout) zoomReadout.textContent = `${Math.round(state.zoom)}%`
    for (const button of presetButtons) {
      button.classList.toggle('active', asTreatment(button.dataset.treatment) === state.treatment)
    }
  }

  tab.addEventListener('click', () => {
    const nextOpen = !panel.classList.contains('open')
    setOpen(panel, tab, nextOpen)
    if (nextOpen) render()
  })
  close.addEventListener('click', () => setOpen(panel, tab, false))

  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      state.treatment = asTreatment(button.dataset.treatment)
      Object.assign(state, TREATMENT_PRESETS[state.treatment])
      render()
    })
  }

  const wireSelect = <T extends string>(id: string, key: keyof LabState, fallback: T): void => {
    const el = document.getElementById(id) as HTMLSelectElement | null
    if (!el) return
    el.addEventListener('change', () => {
      ;(state as unknown as Record<string, string>)[key as string] = readSelect(id, fallback)
      render()
    })
  }
  wireSelect<LabScene>('node-lab-scene', 'scene', 'pair')
  wireSelect<LabPalette>('node-lab-palette', 'palette', 'bright')
  wireSelect<LabBorder>('node-lab-border', 'border', 'black')
  wireSelect<LabLighting>('node-lab-lighting', 'lighting', 'sphere')
  wireSelect<LabSharpness>('node-lab-sharpness', 'sharpness', 'sdf')

  const zoom = document.getElementById('node-lab-zoom') as HTMLInputElement | null
  zoom?.addEventListener('input', () => {
    state.zoom = clamp(Number(zoom.value) || 100, 18, 420)
    render()
  })
  for (const button of zoomButtons) {
    button.addEventListener('click', () => {
      state.zoom = clamp(Number(button.dataset.nodeLabZoom) || 100, 18, 420)
      render()
    })
  }

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault()
    const factor = Math.exp(-event.deltaY * 0.0018)
    state.zoom = clamp(state.zoom * factor, 18, 420)
    render()
  }, { passive: false })
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('dragging')
    dragStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY }
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!dragStart) return
    const z = state.zoom / 100
    state.panX = dragStart.panX + (event.clientX - dragStart.x) / z
    state.panY = dragStart.panY + (event.clientY - dragStart.y) / z
    render()
  })
  canvas.addEventListener('pointerup', () => {
    dragStart = null
    canvas.classList.remove('dragging')
  })
  canvas.addEventListener('pointercancel', () => {
    dragStart = null
    canvas.classList.remove('dragging')
  })
  window.addEventListener('resize', () => {
    if (panel.classList.contains('open')) render()
  })
  render()
}
