import type { Graph } from '@kajillion/graph'
import type { HubPlacement } from './network-view'

const LABEL_STYLE = [
  'position:fixed',
  'pointer-events:auto',
  'cursor:pointer',
  'transform:translate(-50%, -50%)',
  'padding:5px 12px',
  'background:rgba(8,10,16,0.74)',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:999px',
  'color:rgba(255,255,255,0.94)',
  'font:600 13px/1 ui-sans-serif,system-ui,-apple-system,sans-serif',
  'backdrop-filter:blur(8px)',
  '-webkit-backdrop-filter:blur(8px)',
  'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
  'opacity:0',
  'transition:opacity 320ms cubic-bezier(.4,0,.2,1)',
  'white-space:nowrap',
  'user-select:none',
  'z-index:55',
].join(';')

const COUNT_STYLE = 'opacity:0.55;font-weight:400;margin-left:4px'

export interface HubLabelsHandle {
  /** Install / refresh labels for the supplied hubs and start tracking
   *  their on-screen positions. Replaces any previous label set. */
  setHubs: (hubs: HubPlacement[]) => void;
  /** Fade labels in / out (after a positional burst has settled, or
   *  when the explode view is being torn down). */
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

/**
 * Floating HTML labels pinned to each hub's world-space position. Labels
 * are tracked on a RAF so they follow the camera when the user pans /
 * zooms. Cheap: one spaceToScreen lookup per hub per frame, hub count
 * usually < 50.
 */
export function createHubLabels (
  graph: Graph,
  onHubClick?: (hub: HubPlacement) => void,
): HubLabelsHandle {
  let current: HubPlacement[] = []
  const elements: HTMLDivElement[] = []
  let visible = false
  let rafId = 0
  let disposed = false

  const trackFrame = (): void => {
    if (disposed) return
    for (let i = 0; i < current.length; i += 1) {
      const hub = current[i]!
      const el = elements[i]!
      const [sx, sy] = graph.spaceToScreenPosition([hub.hubX, hub.hubY])
      el.style.left = `${sx}px`
      el.style.top = `${sy}px`
    }
    rafId = requestAnimationFrame(trackFrame)
  }

  const renderElements = (): void => {
    // Drop any previously-mounted DOM and rebuild from `current`.
    for (const el of elements) el.remove()
    elements.length = 0
    for (const hub of current) {
      const el = document.createElement('div')
      el.style.cssText = LABEL_STYLE
      el.dataset.nodeExplorer = 'hub-label'
      el.textContent = hub.value
      const count = document.createElement('span')
      count.style.cssText = COUNT_STYLE
      count.textContent = `· ${hub.memberIndices.length + 1}`
      el.appendChild(count)
      if (onHubClick) el.onclick = (): void => onHubClick(hub)
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
    setHubs (hubs): void {
      current = hubs
      renderElements()
      if (visible && current.length > 0) startTracking()
      else stopTracking()
    },
    setVisible (v): void {
      if (v === visible) return
      visible = v
      for (const el of elements) el.style.opacity = v ? '1' : '0'
      if (v && current.length > 0) startTracking()
      else stopTracking()
    },
    dispose (): void {
      disposed = true
      stopTracking()
      for (const el of elements) el.remove()
      elements.length = 0
      current = []
    },
  }
}
