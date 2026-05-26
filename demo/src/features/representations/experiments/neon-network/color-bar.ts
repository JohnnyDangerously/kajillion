import { COLOR_MODE_LABELS, type ColorMode } from './color-modes'

const BAR_STYLE = [
  'position:fixed', 'top:16px', 'right:16px',
  'display:flex', 'align-items:center', 'gap:8px',
  'padding:6px 10px 6px 14px',
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

const LABEL_STYLE = 'color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.06em;font-size:10px'

const SELECT_STYLE = [
  'appearance:none', '-webkit-appearance:none',
  'background:rgba(255,255,255,0.06)', 'color:#fff',
  'border:1px solid rgba(255,255,255,0.10)', 'border-radius:999px',
  'padding:4px 26px 4px 12px',
  'font:inherit', 'cursor:pointer',
  // Inline chevron so we don't depend on system styling.
  "background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22 viewBox=%220 0 10 6%22><path fill=%22white%22 d=%22M0 0l5 6 5-6z%22/></svg>')",
  'background-repeat:no-repeat', 'background-position:right 10px center',
].join(';')

export interface ColorBarHandle {
  setMode: (mode: ColorMode) => void;
  dispose: () => void;
}

export interface ColorBarOptions {
  modes: ColorMode[];
  initial: ColorMode;
  onChange: (mode: ColorMode) => void;
}

export function createColorBar (opts: ColorBarOptions): ColorBarHandle {
  const bar = document.createElement('div')
  bar.style.cssText = BAR_STYLE
  bar.dataset.nodeExplorer = 'color-bar'

  const label = document.createElement('div')
  label.textContent = 'Color by'
  label.style.cssText = LABEL_STYLE
  bar.appendChild(label)

  const select = document.createElement('select')
  select.style.cssText = SELECT_STYLE
  for (const mode of opts.modes) {
    const option = document.createElement('option')
    option.value = mode
    option.textContent = COLOR_MODE_LABELS[mode]
    select.appendChild(option)
  }
  select.value = opts.initial
  select.onchange = (): void => opts.onChange(select.value as ColorMode)
  bar.appendChild(select)

  document.body.appendChild(bar)

  return {
    setMode (mode: ColorMode): void { select.value = mode },
    dispose (): void { bar.remove() },
  }
}
