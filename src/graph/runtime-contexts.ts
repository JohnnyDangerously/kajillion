import type { RuntimeSelectionContext } from '@/graph/graph/selection/runtime-selection'
import type { RuntimeDataUpdateContext } from '@/graph/graph/runtime-data-setters'
import type { RuntimeFrameRendererContext } from '@/graph/graph/runtime-frame-renderer'
import type { RuntimePositionCacheContext } from '@/graph/graph/runtime-position-cache'
import type { RuntimeRenderEntryContext } from '@/graph/graph/runtime-render-entry'
import type { RuntimeSimulationControlContext } from '@/graph/graph/runtime-simulation-controls'
import type { RuntimeCanvasContext } from '@/graph/graph/runtime-canvas'
import type { RuntimeViewControlContext } from '@/graph/graph/runtime-view-controls'
import type { GraphAccessorContext } from '@/graph/graph/runtime-accessors'
import type { GraphRuntimeContextOwner } from '@/graph/graph/runtime-context-owner'
import {
  createGraphAccessorContext,
  createRuntimeCanvasContext,
  createRuntimeDataUpdateContext,
  createRuntimeFrameRendererContext,
  createRuntimePositionCacheContext,
  createRuntimeRenderEntryContext,
  createRuntimeSelectionContext,
  createRuntimeSimulationControlContext,
  createRuntimeViewControlContext,
} from '@/graph/graph/runtime-context-builders'

export abstract class GraphRuntimeContexts {
  private get owner (): GraphRuntimeContextOwner {
    return this as unknown as GraphRuntimeContextOwner
  }

  protected getRenderEntryContext (): RuntimeRenderEntryContext {
    return createRuntimeRenderEntryContext(this.owner)
  }

  protected getViewControlContext (): RuntimeViewControlContext {
    return createRuntimeViewControlContext(this.owner)
  }

  protected getSimulationControlContext (): RuntimeSimulationControlContext {
    return createRuntimeSimulationControlContext(this.owner)
  }

  protected getDataUpdateContext (): RuntimeDataUpdateContext {
    return createRuntimeDataUpdateContext(this.owner)
  }

  protected getFrameRendererContext (): RuntimeFrameRendererContext {
    return createRuntimeFrameRendererContext(this.owner)
  }

  protected getCanvasContext (): RuntimeCanvasContext {
    return createRuntimeCanvasContext(this.owner)
  }

  protected getPositionCacheContext (): RuntimePositionCacheContext {
    return createRuntimePositionCacheContext(this.owner)
  }

  protected getAccessorContext (): GraphAccessorContext {
    return createGraphAccessorContext(this.owner)
  }

  protected getSelectionContext (): RuntimeSelectionContext {
    return createRuntimeSelectionContext(this.owner)
  }
}
