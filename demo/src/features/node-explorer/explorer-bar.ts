const BAR_STYLE = [
  'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
  'display:flex', 'gap:4px', 'padding:6px 8px',
  'background:rgba(8,10,16,0.74)',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:999px',
  'backdrop-filter:blur(10px)',
  '-webkit-backdrop-filter:blur(10px)',
  'z-index:65',
  'font:500 11px ui-sans-serif,system-ui,-apple-system,sans-serif',
  'color:rgba(255,255,255,0.78)',
  'user-select:none',
  'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
].join(';')

const BTN_BASE = [
  'padding:6px 14px',
  'border:none', 'background:transparent', 'color:inherit',
  'border-radius:999px', 'cursor:pointer',
  'font:inherit', 'text-transform:none',
  'transition:background-color 120ms,color 120ms',
  'white-space:nowrap',
].join(';')

const BTN_ACTIVE = 'background:rgba(255,255,255,0.16);color:#fff'

interface BarButton {
  id: string;
  label: string;
  onClick: () => void;
}

export interface ExplorerBarHandle {
  setActive: (id: string | null) => void;
  dispose: () => void;
}

export function createExplorerBar (buttons: BarButton[]): ExplorerBarHandle {
  const bar = document.createElement('div')
  bar.style.cssText = BAR_STYLE
  bar.dataset.nodeExplorer = 'bar'

  const elements = new Map<string, HTMLButtonElement>()
  let activeId: string | null = null

  const refresh = (): void => {
    for (const [id, el] of elements) {
      el.style.cssText = id === activeId ? `${BTN_BASE};${BTN_ACTIVE}` : BTN_BASE
    }
  }

  for (const b of buttons) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = b.label
    btn.style.cssText = BTN_BASE
    btn.onmouseenter = (): void => { if (activeId !== b.id) btn.style.color = '#fff' }
    btn.onmouseleave = (): void => { if (activeId !== b.id) btn.style.color = 'rgba(255,255,255,0.78)' }
    btn.onclick = b.onClick
    elements.set(b.id, btn)
    bar.appendChild(btn)
  }
  refresh()
  document.body.appendChild(bar)

  return {
    setActive (id: string | null): void {
      activeId = id
      refresh()
    },
    dispose (): void { bar.remove() },
  }
}
