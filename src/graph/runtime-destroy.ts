import { select, type Selection } from 'd3-selection'
import { type Device } from '@luma.gl/core'

import { type Drag } from '@/graph/modules/Drag'
import { type FPSMonitor } from '@/graph/modules/FPSMonitor'
import { type Store } from '@/graph/modules/Store'
import { type Zoom } from '@/graph/modules/Zoom'
import { type ITimerQueryPool } from '@/graph/perf'
import { type MsaaTarget } from '@/graph/render/msaa-target'

interface Destroyable {
  destroy: () => void;
}

export interface DestroyGraphRuntimeOptions {
  canvasD3Selection: Selection<HTMLCanvasElement, undefined, null, undefined> | undefined;
  zoomInstance: Zoom;
  dragInstance: Drag;
  fpsMonitor: FPSMonitor | undefined;
  timerQueryPool: ITimerQueryPool | undefined;
  modules: Array<Destroyable | undefined>;
  msaaTarget: MsaaTarget | undefined;
  device: Device | undefined;
  shouldDestroyDevice: boolean;
  store: Store;
  canvas: HTMLCanvasElement | undefined;
  attributionDivElement: HTMLElement | undefined;
}

export function destroyGraphRuntime ({
  canvasD3Selection,
  zoomInstance,
  dragInstance,
  fpsMonitor,
  timerQueryPool,
  modules,
  msaaTarget,
  device,
  shouldDestroyDevice,
  store,
  canvas,
  attributionDivElement,
}: DestroyGraphRuntimeOptions): void {
  if (canvasD3Selection) {
    canvasD3Selection
      .on('mouseenter.cosmos', null)
      .on('mousemove.cosmos', null)
      .on('mouseleave.cosmos', null)
      .on('click', null)
      .on('mousemove', null)
      .on('contextmenu', null)
      .on('.drag', null)
      .on('.zoom', null)
  }

  select(document)
    .on('keydown.cosmos', null)
    .on('keyup.cosmos', null)

  zoomInstance.detach()
  zoomInstance.onStart = undefined
  zoomInstance.onZoom = undefined
  zoomInstance.onEnd = undefined

  if (dragInstance.behavior) {
    dragInstance.behavior
      .on('start.detect', null)
      .on('drag.detect', null)
      .on('end.detect', null)
  }

  fpsMonitor?.destroy()
  timerQueryPool?.destroy()
  for (const module of modules) module?.destroy()
  msaaTarget?.destroy()

  if (device && shouldDestroyDevice) {
    const clearPass = device.beginRenderPass({
      clearColor: store.backgroundColor,
      clearDepth: 1,
      clearStencil: 0,
    })
    clearPass.end()
    device.submit()
    device.destroy()
  }

  if (shouldDestroyDevice && canvas?.parentNode) {
    canvas.parentNode.removeChild(canvas)
  }
  if (attributionDivElement?.parentNode) {
    attributionDivElement.parentNode.removeChild(attributionDivElement)
  }

  document.getElementById('gl-bench-style')?.remove()
}
