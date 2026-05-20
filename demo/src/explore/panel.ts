/**
 * Right-hand slide-out panel for the explore workflow. Self-contained: it
 * builds its own DOM and injects its own CSS, exposes a small imperative
 * API, and reports user intent through two callbacks.
 */

export interface PanelNodeInfo {
  entityInt: number
  /** Tie score to the current focus, when the node is a neighbour. */
  scoreToFocus?: number
  /** Degree (neighbour count) once known. */
  degree?: number
  /** True when the shown node is itself the current focus. */
  isFocus: boolean
}

const CSS = `
.xp-panel {
  position: fixed; top: 0; right: 0; height: 100vh; width: 320px;
  box-sizing: border-box; padding: 20px 20px 24px;
  background: rgba(10, 14, 22, 0.94); color: #e8eef6;
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  border-left: 1px solid rgba(120, 160, 220, 0.22);
  box-shadow: -18px 0 48px rgba(0, 0, 0, 0.45);
  transform: translateX(112%); transition: transform 220ms cubic-bezier(.2,.7,.2,1);
  z-index: 9000; display: flex; flex-direction: column; gap: 14px;
}
.xp-panel.xp-open { transform: translateX(0); }
.xp-kicker { font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  color: #6f8bb5; }
.xp-title { font-size: 24px; font-weight: 650; word-break: break-all; }
.xp-meta { display: flex; flex-direction: column; gap: 6px; }
.xp-row { display: flex; justify-content: space-between;
  border-bottom: 1px solid rgba(120,160,220,.10); padding-bottom: 5px; }
.xp-row span:first-child { color: #87a0c4; }
.xp-btn { appearance: none; border: 0; border-radius: 8px; cursor: pointer;
  padding: 11px 14px; font-size: 13px; font-weight: 600; }
.xp-explore { background: linear-gradient(180deg,#3b82f6,#2563eb); color: #fff; }
.xp-explore:hover { filter: brightness(1.1); }
.xp-explore:disabled { opacity: .5; cursor: default; }
.xp-back { background: rgba(120,160,220,.14); color: #cdd9ea; }
.xp-back:disabled { opacity: .35; cursor: default; }
.xp-crumb { font-size: 11px; color: #7e96bc; word-break: break-all; min-height: 16px; }
.xp-status { margin-top: auto; font-size: 11px; color: #6f8bb5; min-height: 15px; }
.xp-spacer { flex: 1; }
`

export class ExplorePanel {
  private readonly el: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly metaEl: HTMLElement
  private readonly crumbEl: HTMLElement
  private readonly statusEl: HTMLElement
  private readonly exploreBtn: HTMLButtonElement
  private readonly backBtn: HTMLButtonElement
  private shownInt: number | null = null
  private onExplore: (entityInt: number) => void = () => {}
  private onBack: () => void = () => {}

  constructor () {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)

    this.el = document.createElement('div')
    this.el.className = 'xp-panel'
    this.el.innerHTML = `
      <div class="xp-kicker">Entity</div>
      <div class="xp-title" data-xp="title">—</div>
      <div class="xp-meta" data-xp="meta"></div>
      <div class="xp-crumb" data-xp="crumb"></div>
      <div class="xp-spacer"></div>
      <button class="xp-btn xp-explore" data-xp="explore">Explore →</button>
      <button class="xp-btn xp-back" data-xp="back">← Back</button>
      <div class="xp-status" data-xp="status"></div>
    `
    document.body.appendChild(this.el)

    const pick = (k: string): HTMLElement =>
      this.el.querySelector(`[data-xp="${k}"]`) as HTMLElement
    this.titleEl = pick('title')
    this.metaEl = pick('meta')
    this.crumbEl = pick('crumb')
    this.statusEl = pick('status')
    this.exploreBtn = pick('explore') as HTMLButtonElement
    this.backBtn = pick('back') as HTMLButtonElement

    this.exploreBtn.addEventListener('click', () => {
      if (this.shownInt !== null) this.onExplore(this.shownInt)
    })
    this.backBtn.addEventListener('click', () => { this.onBack() })
  }

  setHandlers (onExplore: (e: number) => void, onBack: () => void): void {
    this.onExplore = onExplore
    this.onBack = onBack
  }

  show (info: PanelNodeInfo): void {
    this.shownInt = info.entityInt
    this.titleEl.textContent = `#${info.entityInt}`
    const rows: string[] = []
    if (info.isFocus) {
      rows.push(row('Role', 'current focus'))
    } else if (info.scoreToFocus !== undefined) {
      rows.push(row('Tie strength', info.scoreToFocus.toFixed(0)))
    }
    if (info.degree !== undefined) {
      rows.push(row('Network size', info.degree.toLocaleString()))
    }
    this.metaEl.innerHTML = rows.join('')
    this.exploreBtn.textContent = info.isFocus ? 'Re-centre' : 'Explore →'
    this.el.classList.add('xp-open')
  }

  hide (): void {
    this.el.classList.remove('xp-open')
    this.shownInt = null
  }

  setBreadcrumb (trail: number[]): void {
    this.crumbEl.textContent = trail.length
      ? `Trail: ${trail.map((n) => `#${n}`).join('  ›  ')}`
      : ''
    this.backBtn.disabled = trail.length === 0
  }

  setStatus (text: string): void {
    this.statusEl.textContent = text
  }

  setBusy (busy: boolean): void {
    this.exploreBtn.disabled = busy
  }
}

function row (label: string, value: string): string {
  return `<div class="xp-row"><span>${label}</span><span>${value}</span></div>`
}
