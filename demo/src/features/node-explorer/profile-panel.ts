import type { ExplorerNetwork, ExplorerFacets } from './types'

const PANEL_STYLE = [
  'position:fixed', 'top:16px', 'right:16px',
  'width:280px', 'padding:14px 16px',
  'background:rgba(8,10,16,0.86)',
  'border:1px solid rgba(255,255,255,0.10)',
  'border-radius:14px',
  'color:rgba(255,255,255,0.92)',
  'font:13px/1.45 ui-sans-serif,system-ui,-apple-system,sans-serif',
  'backdrop-filter:blur(10px)',
  '-webkit-backdrop-filter:blur(10px)',
  'box-shadow:0 16px 40px rgba(0,0,0,0.45)',
  'z-index:80',
  'user-select:text',
  'transform:translateY(-8px)',
  'opacity:0',
  'pointer-events:none',
  'transition:opacity 140ms,transform 140ms',
].join(';')

const AVATAR_STYLE = [
  'width:72px', 'height:72px', 'border-radius:50%',
  'object-fit:cover',
  'border:2px solid rgba(255,255,255,0.20)',
  'box-shadow:0 4px 18px rgba(0,0,0,0.4)',
  'background:#1a1d28',
  'display:block',
].join(';')

interface ProfileHandle {
  show: (nodeIndex: number) => void;
  hide: () => void;
  dispose: () => void;
}

export function createProfilePanel (
  network: ExplorerNetwork,
  facets: ExplorerFacets | undefined,
  onExplore?: (nodeIndex: number) => void,
): ProfileHandle {
  const panel = document.createElement('div')
  panel.style.cssText = PANEL_STYLE
  panel.dataset.nodeExplorer = 'profile'
  document.body.appendChild(panel)

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '×'
  close.style.cssText = [
    'position:absolute', 'top:8px', 'right:10px',
    'width:24px', 'height:24px', 'padding:0',
    'background:transparent', 'border:none',
    'color:rgba(255,255,255,0.55)', 'cursor:pointer',
    'font:18px/1 ui-sans-serif,system-ui,sans-serif',
  ].join(';')

  const setVisible = (visible: boolean): void => {
    panel.style.opacity = visible ? '1' : '0'
    panel.style.transform = visible ? 'translateY(0)' : 'translateY(-8px)'
    panel.style.pointerEvents = visible ? 'auto' : 'none'
  }

  const render = (nodeIndex: number): void => {
    const name = network.names[nodeIndex] || '(unknown)'
    const eid = network.eids[nodeIndex]
    const hop = network.hops?.[nodeIndex]
    const score = network.scores?.[nodeIndex]
    const avatar = network.avatarUrls[nodeIndex]
    const company = facets?.companies?.[nodeIndex]
    const industry = facets?.industries?.[nodeIndex]
    const market = facets?.markets?.[nodeIndex]
    const title = facets?.titles?.[nodeIndex]
    const level = facets?.levels?.[nodeIndex]
    const fn = facets?.functions?.[nodeIndex]

    panel.innerHTML = ''
    panel.appendChild(close)

    const header = document.createElement('div')
    header.style.cssText = 'display:flex;gap:12px;align-items:center;margin-bottom:10px'
    if (avatar) {
      const img = document.createElement('img')
      img.src = avatar
      img.style.cssText = AVATAR_STYLE
      img.alt = name
      header.appendChild(img)
    } else {
      const stub = document.createElement('div')
      stub.style.cssText = `${AVATAR_STYLE};display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:22px`
      stub.textContent = name.charAt(0).toUpperCase() || '?'
      header.appendChild(stub)
    }
    const heading = document.createElement('div')
    heading.style.cssText = 'flex:1;min-width:0'
    const nameEl = document.createElement('div')
    nameEl.textContent = name
    nameEl.style.cssText = 'font-weight:600;font-size:15px;line-height:1.2;margin-bottom:4px;word-break:break-word'
    heading.appendChild(nameEl)
    if (title) {
      const t = document.createElement('div')
      t.textContent = title
      t.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.72);line-height:1.3'
      heading.appendChild(t)
    }
    header.appendChild(heading)
    panel.appendChild(header)

    const dl = document.createElement('div')
    dl.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;color:rgba(255,255,255,0.78)'
    const row = (k: string, v: string | number | undefined | null): void => {
      if (v === undefined || v === null || v === '') return
      const ke = document.createElement('div')
      ke.textContent = k
      ke.style.cssText = 'color:rgba(255,255,255,0.45)'
      const ve = document.createElement('div')
      ve.textContent = String(v)
      ve.style.cssText = 'overflow-wrap:anywhere'
      dl.appendChild(ke); dl.appendChild(ve)
    }
    row('Company', company)
    row('Industry', industry)
    row('Market', market)
    row('Function', fn)
    row('Level', level)
    if (hop !== undefined) row('Hop', hop === 0 ? '0 (root)' : String(hop))
    if (score !== undefined && score > 0) row('Score', Math.round(score))
    row('Entity id', eid)
    panel.appendChild(dl)

    // Action button — present when the rep has wired an onExplore
    // handler. Hop=0 (the root, "John") doesn't get the button since
    // his own network is the atlas we're already in.
    if (onExplore && hop !== 0) {
      const explore = document.createElement('button')
      explore.type = 'button'
      explore.textContent = `Explore ${name === '(unknown)' ? "this person's" : name + "'s"} network →`
      explore.style.cssText = [
        'margin-top:14px', 'width:100%',
        'padding:10px 14px',
        'background:rgba(120,170,255,0.20)',
        'border:1px solid rgba(120,170,255,0.42)',
        'border-radius:10px',
        'color:#cfe0ff', 'cursor:pointer',
        'font:600 12px/1 ui-sans-serif,system-ui,sans-serif',
        'letter-spacing:0.02em',
        'transition:background-color 120ms,border-color 120ms',
      ].join(';')
      explore.onmouseenter = (): void => { explore.style.background = 'rgba(120,170,255,0.32)' }
      explore.onmouseleave = (): void => { explore.style.background = 'rgba(120,170,255,0.20)' }
      explore.onclick = (): void => { onExplore(nodeIndex) }
      panel.appendChild(explore)
    }
  }

  const hide = (): void => setVisible(false)
  close.onclick = hide

  const escListener = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') hide()
  }
  document.addEventListener('keydown', escListener)

  return {
    show: (nodeIndex: number): void => {
      render(nodeIndex)
      setVisible(true)
    },
    hide,
    dispose: (): void => {
      document.removeEventListener('keydown', escListener)
      panel.remove()
    },
  }
}
