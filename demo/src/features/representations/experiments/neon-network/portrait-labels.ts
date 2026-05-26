import type { Graph } from '@kajillion/graph'

// Small, unobtrusive caption directly beneath each face. Name only —
// no big company text, no chip background. Echoes the "image-4
// portrait" reference but at a calmer typographic weight.
const LABEL_STYLE = [
  'position:fixed',
  'pointer-events:none',
  'transform:translate(-50%, 0)',
  'padding:2px 6px',
  'color:rgba(255,255,255,0.92)',
  'font:500 12px/1.2 ui-sans-serif,system-ui,-apple-system,sans-serif',
  'text-align:center',
  'opacity:0',
  'transition:opacity 320ms cubic-bezier(.4,0,.2,1)',
  'white-space:nowrap',
  'user-select:none',
  'z-index:55',
  'text-shadow:0 1px 6px rgba(0,0,0,0.85)',
].join(';')

export interface PortraitLabel {
  /** World-space coordinates of the face this label points to. */
  worldX: number;
  worldY: number;
  /** Person name. Empty string → label skipped. */
  name: string;
  /** Pixel offset below the dot's screen position to place the label.
   *  Lets callers tune by face size at the current zoom. */
  belowPx?: number;
}

export interface PortraitLabelsHandle {
  setLabels: (labels: PortraitLabel[]) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

const DEFAULT_BELOW_PX = 56

/**
 * Floating per-face captions. One name beneath each dot, tracked per
 * frame so labels follow camera pan/zoom. Faces without a name (no
 * atlas match) get no label rather than a placeholder.
 */
export function createPortraitLabels (graph: Graph): PortraitLabelsHandle {
  let current: PortraitLabel[] = []
  const elements: HTMLDivElement[] = []
  let visible = false
  let rafId = 0
  let disposed = false

  const trackFrame = (): void => {
    if (disposed) return
    for (let i = 0; i < current.length; i += 1) {
      const lbl = current[i]!
      const el = elements[i]
      if (!el) continue
      const [sx, sy] = graph.spaceToScreenPosition([lbl.worldX, lbl.worldY])
      el.style.left = `${sx}px`
      el.style.top = `${sy + (lbl.belowPx ?? DEFAULT_BELOW_PX)}px`
    }
    rafId = requestAnimationFrame(trackFrame)
  }

  const renderElements = (): void => {
    for (const el of elements) el.remove()
    elements.length = 0
    for (const lbl of current) {
      if (!lbl.name) { elements.push(null as unknown as HTMLDivElement); continue }
      const el = document.createElement('div')
      el.style.cssText = LABEL_STYLE
      el.dataset.nodeExplorer = 'portrait-label'
      el.textContent = lbl.name
      document.body.appendChild(el)
      elements.push(el)
    }
  }

  const stopTracking = (): void => {
    if (rafId !== 0) cancelAnimationFrame(rafId)
    rafId = 0
  }
  const startTracking = (): void => {
    if (rafId === 0) rafId = requestAnimationFrame(trackFrame)
  }

  return {
    setLabels (labels): void {
      current = labels
      renderElements()
      if (visible && current.length > 0) startTracking()
      else stopTracking()
    },
    setVisible (v): void {
      if (v === visible) return
      visible = v
      for (const el of elements) {
        if (el) el.style.opacity = v ? '1' : '0'
      }
      if (v && current.length > 0) startTracking()
      else stopTracking()
    },
    dispose (): void {
      disposed = true
      stopTracking()
      for (const el of elements) el?.remove()
      elements.length = 0
      current = []
    },
  }
}
