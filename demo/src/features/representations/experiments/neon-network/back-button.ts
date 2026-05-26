/**
 * Persistent "Back" pill at the top-left that pops the current view back
 * one level. Only visible when the view is anything other than the
 * top-level cluster atlas.
 */

const BTN_STYLE = [
  'position:fixed', 'top:16px', 'left:16px',
  'display:flex', 'align-items:center', 'gap:6px',
  'padding:7px 14px 7px 11px',
  'background:rgba(8,10,16,0.74)',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:999px',
  'color:rgba(255,255,255,0.85)',
  'font:600 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif',
  'cursor:pointer',
  'backdrop-filter:blur(10px)',
  '-webkit-backdrop-filter:blur(10px)',
  'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
  'z-index:70',
  'opacity:0',
  'transform:translateY(-6px)',
  'pointer-events:none',
  'transition:opacity 140ms,transform 140ms',
  'user-select:none',
].join(';')

export interface BackButtonHandle {
  show: (label?: string) => void;
  hide: () => void;
  dispose: () => void;
}

export function createBackButton (onBack: () => void): BackButtonHandle {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = BTN_STYLE
  btn.dataset.nodeExplorer = 'back-button'
  const chevron = document.createElement('span')
  chevron.textContent = '‹'
  chevron.style.cssText = 'font:700 18px/1 ui-sans-serif,system-ui;color:rgba(255,255,255,0.6);margin-right:2px'
  const label = document.createElement('span')
  label.textContent = 'Back'
  btn.appendChild(chevron)
  btn.appendChild(label)
  btn.onclick = (): void => onBack()
  document.body.appendChild(btn)

  let visible = false
  return {
    show (text = 'Back'): void {
      label.textContent = text
      if (!visible) {
        btn.style.opacity = '1'
        btn.style.transform = 'translateY(0)'
        btn.style.pointerEvents = 'auto'
        visible = true
      }
    },
    hide (): void {
      if (!visible) return
      btn.style.opacity = '0'
      btn.style.transform = 'translateY(-6px)'
      btn.style.pointerEvents = 'none'
      visible = false
    },
    dispose (): void { btn.remove() },
  }
}
