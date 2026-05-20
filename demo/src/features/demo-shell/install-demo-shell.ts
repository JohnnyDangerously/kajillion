import galleryHtml from './templates/gallery.html?raw'
import graphStageHtml from './templates/graph-stage.html?raw'
import nodeLabHtml from './templates/node-lab.html?raw'
import sidebarHtml from './templates/sidebar.html?raw'

export function installDemoShell (): void {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app root')
  app.innerHTML = `${graphStageHtml}${sidebarHtml}${nodeLabHtml}${galleryHtml}`
}
