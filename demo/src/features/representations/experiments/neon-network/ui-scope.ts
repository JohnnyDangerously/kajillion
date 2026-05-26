export function installNeonUiScope (): HTMLStyleElement {
  document.body.dataset.activeRep = 'neon-network'
  // Tag for ?theme=light overrides — keeps the CSS contained to the
  // rep instead of leaking into the demo shell.
  const isLight = new URLSearchParams(window.location.search).get('theme') === 'light'
  if (isLight) document.body.dataset.activeTheme = 'light'
  const style = document.createElement('style')
  style.dataset.repHide = 'neon-network'
  style.textContent = `
    .cluster-label { display: none !important; }
    body[data-active-rep="neon-network"] header,
    body[data-active-rep="neon-network"] #overlay,
    body[data-active-rep="neon-network"] #sidebar,
    body[data-active-rep="neon-network"] [data-node-explorer="bar"],
    body[data-active-rep="neon-network"] [data-node-explorer="facet-bar"],
    body[data-active-rep="neon-network"] #node-lab-tab,
    body[data-active-rep="neon-network"] #node-treatment-lab,
    body[data-active-rep="neon-network"] #gallery-tab,
    body[data-active-rep="neon-network"] #preset-gallery {
      display: none !important;
    }
    /* shell-scene.css reserves a 288px gutter on the right for the
       sidebar. We hide the sidebar but the gutter remains, showing
       up as an unwanted black stripe on the right edge. Expand the
       graph host to fill the full viewport when neon-network owns
       the screen. */
    body[data-active-rep="neon-network"] #graph-host {
      inset: 0 !important;
    }
    /* ?theme=light presentation mode: white page, dark text on the
       back pill + color bar so they read on the white background. */
    body[data-active-theme="light"] {
      background: #ffffff;
    }
    body[data-active-theme="light"] [data-node-explorer="back-button"],
    body[data-active-theme="light"] [data-node-explorer="color-bar"] {
      background: rgba(255, 255, 255, 0.78) !important;
      color: #1d2a4a !important;
      border-color: rgba(0, 0, 0, 0.12) !important;
    }
    body[data-active-theme="light"] [data-node-explorer="color-bar"] select {
      background: rgba(0, 0, 0, 0.05) !important;
      color: #1d2a4a !important;
      border-color: rgba(0, 0, 0, 0.10) !important;
    }
    body[data-active-theme="light"] [data-node-explorer="hub-label"],
    body[data-active-theme="light"] [data-node-explorer="portrait-label"] {
      background: rgba(255, 255, 255, 0.92) !important;
      color: #1d2a4a !important;
    }
  `
  document.head.appendChild(style)
  return style
}

export function hideUntilReady (
  graph: { setPointSizes: (sizes: Float32Array) => void; render: () => void },
  nodeCount: number,
): void {
  graph.setPointSizes(new Float32Array(nodeCount))
  graph.render()
}
