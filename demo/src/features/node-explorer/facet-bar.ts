import { facetLabel, summariseFacets, type FacetField, type FacetSummary } from './facet-engine'
import type { ExplorerFacets } from './types'

const BAR_STYLE = [
  'position:fixed', 'top:68px', 'left:50%', 'transform:translateX(-50%)',
  'display:flex', 'flex-direction:column', 'gap:4px',
  'padding:8px 10px',
  'max-width:min(720px,90vw)',
  'background:rgba(8,10,16,0.72)',
  'border:1px solid rgba(255,255,255,0.08)',
  'border-radius:18px',
  'backdrop-filter:blur(10px)',
  '-webkit-backdrop-filter:blur(10px)',
  'z-index:60',
  'font:500 11px ui-sans-serif,system-ui,-apple-system,sans-serif',
  'color:rgba(255,255,255,0.78)',
  'user-select:none',
  'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
].join(';')

const ROW_STYLE = 'display:flex;gap:4px;align-items:center;overflow-x:auto;scrollbar-width:none'
const ROW_LABEL_STYLE = 'min-width:64px;color:rgba(255,255,255,0.45);font-size:10px;text-transform:uppercase;letter-spacing:0.05em'
const CHIP_BASE = 'padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid transparent;cursor:pointer;font:inherit;color:inherit;white-space:nowrap;transition:background-color 100ms,border-color 100ms'
const CHIP_ACTIVE = 'background:rgba(120,170,255,0.32);border-color:rgba(120,170,255,0.55);color:#fff'

export interface FacetBarHandle {
  /** Currently selected values per field. */
  selection: Map<FacetField, Set<string>>;
  dispose: () => void;
}

export interface FacetBarOptions {
  facets: ExplorerFacets;
  /** Fired whenever the selection changes. */
  onChange: (selection: Map<FacetField, Set<string>>) => void;
}

/**
 * Multi-row chip bar. One row per facet field; clicking a chip toggles
 * that value into the selection. Empty facets are skipped.
 */
export function createFacetBar (options: FacetBarOptions): FacetBarHandle {
  const summaries = summariseFacets(options.facets)
  const selection = new Map<FacetField, Set<string>>()
  const chipElements = new Map<string, HTMLButtonElement>()

  const bar = document.createElement('div')
  bar.style.cssText = BAR_STYLE
  bar.dataset.nodeExplorer = 'facet-bar'

  const fire = (): void => options.onChange(new Map(selection))

  const refreshChips = (): void => {
    for (const [key, btn] of chipElements) {
      const [field, value] = key.split('::') as [FacetField, string]
      const active = selection.get(field)?.has(value) ?? false
      btn.style.cssText = active ? `${CHIP_BASE};${CHIP_ACTIVE}` : CHIP_BASE
    }
  }

  for (const summary of summaries) {
    if (summary.values.length === 0) continue
    const row = renderRow(summary, (field, value) => {
      const set = selection.get(field) ?? new Set<string>()
      if (set.has(value)) set.delete(value); else set.add(value)
      if (set.size === 0) selection.delete(field); else selection.set(field, set)
      refreshChips()
      fire()
    }, chipElements)
    bar.appendChild(row)
  }

  if (bar.children.length === 0) {
    bar.style.display = 'none'
  }
  document.body.appendChild(bar)

  return {
    selection,
    dispose (): void { bar.remove() },
  }
}

function renderRow (
  summary: FacetSummary,
  onToggle: (field: FacetField, value: string) => void,
  chipElements: Map<string, HTMLButtonElement>
): HTMLDivElement {
  const row = document.createElement('div')
  row.style.cssText = ROW_STYLE
  const label = document.createElement('div')
  label.textContent = facetLabel(summary.field)
  label.style.cssText = ROW_LABEL_STYLE
  row.appendChild(label)
  for (const { value, count } of summary.values) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.textContent = `${value} · ${count}`
    chip.style.cssText = CHIP_BASE
    chip.onclick = () => onToggle(summary.field, value)
    chipElements.set(`${summary.field}::${value}`, chip)
    row.appendChild(chip)
  }
  return row
}
