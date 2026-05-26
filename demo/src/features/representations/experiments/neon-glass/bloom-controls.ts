import { BLOOM_VARIANT_IDS, type BloomVariant } from './bloom-variants'

const BAR_STYLE = [
  'position:fixed', 'bottom:18px', 'left:50%', 'transform:translateX(-50%)',
  'display:flex', 'gap:4px', 'padding:6px',
  'background:rgba(8,10,16,0.74)',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:999px',
  'backdrop-filter:blur(10px)',
  '-webkit-backdrop-filter:blur(10px)',
  'z-index:60',
  'font:500 11px ui-sans-serif,system-ui,-apple-system,sans-serif',
  'color:rgba(255,255,255,0.78)',
  'user-select:none',
  'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
].join(';')

const BTN_BASE = [
  'padding:6px 14px',
  'border:none',
  'background:transparent',
  'color:inherit',
  'border-radius:999px',
  'cursor:pointer',
  'font:inherit',
  'text-transform:capitalize',
  'transition:background-color 120ms, color 120ms',
].join(';')

const BTN_ACTIVE = 'background:rgba(255,255,255,0.16);color:#fff'

/**
 * Floating button bar pinned to the bottom of the viewport. Lets the user
 * preview each bloom variant in place without reloading the page. Returns
 * a teardown that removes the bar.
 */
export function installBloomControls (
  initial: BloomVariant,
  onPick: (v: BloomVariant) => void
): () => void {
  const bar = document.createElement('div')
  bar.style.cssText = BAR_STYLE
  bar.dataset.neonGlassControls = 'true'

  const buttons = new Map<BloomVariant, HTMLButtonElement>()
  let current = initial

  const refresh = (): void => {
    for (const [v, btn] of buttons) {
      btn.style.cssText = v === current ? `${BTN_BASE};${BTN_ACTIVE}` : BTN_BASE
    }
  }

  for (const v of BLOOM_VARIANT_IDS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = v
    btn.style.cssText = BTN_BASE
    btn.onclick = (): void => {
      if (current === v) return
      current = v
      refresh()
      onPick(v)
    }
    btn.onmouseenter = (): void => {
      if (current !== v) btn.style.color = '#fff'
    }
    btn.onmouseleave = (): void => {
      if (current !== v) btn.style.color = 'rgba(255,255,255,0.78)'
    }
    buttons.set(v, btn)
    bar.appendChild(btn)
  }
  refresh()

  document.body.appendChild(bar)
  return () => { bar.remove() }
}
