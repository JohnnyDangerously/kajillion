/**
 * Floating tooltip that names the cluster the cursor is over. Pinned
 * near the cluster centroid (not the cursor) so it reads as a label for
 * the rose, not a cursor-following hint.
 */

const TIP_STYLE = [
  'position:fixed',
  'padding:8px 12px',
  'background:rgba(8,10,16,0.92)',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:10px',
  'color:#fff',
  'font:600 13px/1.25 ui-sans-serif,system-ui,-apple-system,sans-serif',
  'pointer-events:none',
  'z-index:75',
  'box-shadow:0 6px 22px rgba(0,0,0,0.45)',
  'backdrop-filter:blur(8px)',
  '-webkit-backdrop-filter:blur(8px)',
  'opacity:0',
  'transform:translate(-50%, -100%) translateY(-12px)',
  'transition:opacity 120ms,transform 120ms',
  'white-space:nowrap',
  'user-select:none',
].join(';')

const TIP_SUB_STYLE = [
  'display:block',
  'margin-top:2px',
  'font-weight:400',
  'color:rgba(255,255,255,0.55)',
  'text-transform:uppercase',
  'letter-spacing:0.06em',
  'font-size:10px',
].join(';')

export interface ClusterTooltipHandle {
  /** Show the tooltip pinned at the given screen-space coords. */
  show: (x: number, y: number, label: string, sub: string) => void;
  hide: () => void;
  dispose: () => void;
}

export function createClusterTooltip (): ClusterTooltipHandle {
  const tip = document.createElement('div')
  tip.style.cssText = TIP_STYLE
  tip.dataset.nodeExplorer = 'cluster-tooltip'
  const main = document.createElement('span')
  const sub = document.createElement('span')
  sub.style.cssText = TIP_SUB_STYLE
  tip.appendChild(main)
  tip.appendChild(sub)
  document.body.appendChild(tip)

  let visible = false
  return {
    show (x, y, label, subtext): void {
      main.textContent = label
      sub.textContent = subtext
      tip.style.left = `${x}px`
      tip.style.top = `${y}px`
      if (!visible) {
        tip.style.opacity = '1'
        tip.style.transform = 'translate(-50%, -100%) translateY(-12px)'
        visible = true
      }
    },
    hide (): void {
      if (!visible) return
      tip.style.opacity = '0'
      visible = false
    },
    dispose (): void { tip.remove() },
  }
}
