import { Graph } from '@kajillion/graph'
import type { GeneratedGraph } from '../../generate-graph'
import {
  buildDefaultViewSpec,
  generatedGraphToSnapshot,
  graphFrameFromSnapshot,
  type GraphFrame,
  type GraphFrameVisibilityFilter,
  type GraphSnapshot,
  type ViewSpec,
} from '../../graph-contract'
import type { VisualLabControlPlane } from '../../visual-lab-control-plane'
import {
  agentGraphPayloadToGeneratedGraph,
  appendEdgesToBuffers,
  type AgentCommand,
  type AgentGraphPayload,
} from '../agent-bridge'
import type { DemoConfig } from '../control-plane/types'
import { DEMO_SPACE_SIZE } from '../demo-lifecycle/demo-space'
import { renderDataFromFrame } from '../demo-lifecycle/render-data'
import type { VisualAttributes } from '../ui-state/visual-attributes'

export interface AgentGraphInstallOptions {
  title?: string;
  graphId?: string;
  fit?: boolean;
  workMode?: boolean;
  explore?: boolean;
}

export interface RuntimeActions {
  installAgentGraph: (payload: AgentGraphPayload, options?: AgentGraphInstallOptions) => Promise<unknown>;
  appendEdgesToCurrentGraph: (pairs: number[]) => { edgeCount: number };
  applyAgentCommand: (command: AgentCommand) => Promise<unknown>;
}

export interface RuntimeActionsContext {
  graphHost: HTMLDivElement;
  getCurrentConfig: () => DemoConfig;
  setCurrentConfig: (cfg: DemoConfig) => void;
  getCurrentGraph: () => Graph | null;
  setCurrentGraph: (graph: Graph | null) => void;
  setCurrentData: (data: GeneratedGraph | null) => void;
  getCurrentRenderData: () => GeneratedGraph | null;
  setCurrentRenderData: (data: GeneratedGraph | null) => void;
  setCurrentDataKey: (key: string) => void;
  setCurrentSnapshot: (snapshot: GraphSnapshot | null) => void;
  setCurrentFrame: (frame: GraphFrame | null) => void;
  setCurrentViewSpec: (viewSpec: ViewSpec | null) => void;
  resetLabInteractionState: (edgeMode: GraphFrameVisibilityFilter['edgeMode']) => void;
  resetAgentPresentationState: () => void;
  setMetaNodeCount: (text: string) => void;
  buildGraphConfig: (cfg: DemoConfig) => ConstructorParameters<typeof Graph>[1];
  buildVisualAttributes: (data: GeneratedGraph) => VisualAttributes;
  exposeDebugGraph: (graph: Graph) => void;
  getVisualLabControlPlane: () => VisualLabControlPlane | null;
}

export function createRuntimeActions (ctx: RuntimeActionsContext): RuntimeActions {
  let agentLinkColors: Float32Array | null = null
  let agentLinkWidths: Float32Array | null = null

  async function installAgentGraph (
    payload: AgentGraphPayload,
    options: AgentGraphInstallOptions = {}
  ): Promise<unknown> {
    const data = agentGraphPayloadToGeneratedGraph(payload, { spaceSize: DEMO_SPACE_SIZE })
    const currentConfig = ctx.getCurrentConfig()
    const cfg: DemoConfig = {
      ...currentConfig,
      n: data.nodeCount,
      dataMode: options.workMode === false ? 'cosmo' : 'work',
      sim: !!options.explore,
      explore: !!options.explore,
      renderLinks: data.edgeCount > 0,
      palette: currentConfig.palette,
    }
    ctx.setCurrentConfig(cfg)
    ctx.setCurrentData(data)
    ctx.setCurrentDataKey(`agent:${options.graphId ?? Date.now()}:${data.nodeCount}:${data.edgeCount}`)
    const currentGraph = ctx.getCurrentGraph()
    if (currentGraph) {
      try { currentGraph.destroy() } catch { /* ignore */ }
      ctx.setCurrentGraph(null)
    }
    ctx.graphHost.innerHTML = ''
    const graph = new Graph(ctx.graphHost, ctx.buildGraphConfig(cfg))
    await graph.ready
    ctx.setCurrentGraph(graph)
    const snapshot = generatedGraphToSnapshot(data, {
      datasetId: 'agent',
      graphId: options.graphId ?? `agent-${data.nodeCount}-${data.edgeCount}`,
      title: options.title ?? 'Agent graph',
      generator: 'agent-api',
      sourceSpaceSize: DEMO_SPACE_SIZE,
    })
    const viewSpec = buildDefaultViewSpec({
      palette: cfg.palette,
      theme: cfg.theme,
      density: cfg.density,
      lanes: cfg.lanes,
      renderLinks: cfg.renderLinks,
    })
    const frame = graphFrameFromSnapshot(snapshot, viewSpec.layout)
    const renderData = renderDataFromFrame(frame, viewSpec, cfg, DEMO_SPACE_SIZE)
    ctx.setCurrentSnapshot(snapshot)
    ctx.setCurrentFrame(frame)
    ctx.setCurrentViewSpec(viewSpec)
    ctx.setCurrentRenderData(renderData)
    ctx.resetLabInteractionState('inside')
    ctx.resetAgentPresentationState()
    const visual = ctx.buildVisualAttributes(renderData)
    agentLinkColors = visual.linkColors
    agentLinkWidths = visual.linkWidths
    graph.setPointPositions(renderData.positions, true)
    graph.setPointColors(visual.pointColors)
    graph.setPointSizes(visual.pointSizes)
    graph.setLinks(renderData.links)
    graph.setLinkColors(visual.linkColors)
    graph.setLinkWidths(visual.linkWidths)
    graph.render(cfg.explore ? 1 : undefined)
    ctx.setMetaNodeCount(`${data.nodeCount.toLocaleString()} (agent)`)
    ctx.exposeDebugGraph(graph)
    if (options.fit !== false) graph.fitView(520, 0.18, !!cfg.explore)
    return {
      nodeCount: data.nodeCount,
      edgeCount: data.edgeCount,
      graphId: snapshot.metadata.graphId,
    }
  }

  function appendEdgesToCurrentGraph (pairs: number[]): { edgeCount: number } {
    const graph = ctx.getCurrentGraph()
    const rd = ctx.getCurrentRenderData()
    if (!graph || !rd) throw new Error('appendEdges: no active graph')
    const next = appendEdgesToBuffers({
      links: rd.links,
      edgeCount: rd.edgeCount,
      linkColors: agentLinkColors,
      linkWidths: agentLinkWidths,
    }, pairs)
    if (!next.changed) return { edgeCount: rd.edgeCount }

    rd.links = next.links
    rd.edgeCount = next.edgeCount
    agentLinkColors = next.linkColors
    agentLinkWidths = next.linkWidths

    graph.setLinks(next.links)
    if (next.linkColors) graph.setLinkColors(next.linkColors)
    if (next.linkWidths) graph.setLinkWidths(next.linkWidths)
    graph.render(1)
    return { edgeCount: rd.edgeCount }
  }

  async function applyAgentCommand (command: AgentCommand): Promise<unknown> {
    const lab = ctx.getVisualLabControlPlane()
    switch (command.type) {
    case 'loadGraph':
      return await installAgentGraph(command.graph, command.options)
    case 'appendEdges':
      return appendEdgesToCurrentGraph(command.links)
    case 'focusNode':
      if (!lab) return null
      return command.options?.async === false
        ? lab.focusNode(command.index, command.options)
        : await lab.focusNodeAsync(command.index, command.options)
    case 'filterNodes':
      return lab?.setNodeFilter(command.pointIndices, command.options) ?? null
    case 'clearInteraction':
      lab?.clearInteraction()
      return { cleared: true }
    case 'setVisibleEdgeKinds':
      return lab?.setVisibleEdgeKinds(command.visibleKinds) ?? null
    case 'secondDegreeProjection':
      return await lab?.runSecondDegreeProjection(command.options)
    default:
      throw new Error(`Unknown agent command: ${(command as { type?: string }).type ?? 'missing type'}`)
    }
  }

  return {
    installAgentGraph,
    appendEdgesToCurrentGraph,
    applyAgentCommand,
  }
}
