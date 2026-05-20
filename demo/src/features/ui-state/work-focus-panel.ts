import type { GeneratedGraph } from '../../generate-graph'
import type { FocusElements } from '../control-plane/dom'
import {
  WORK_GROUPS,
  WORK_NODE_COMPANY,
  WORK_NODE_GROUP,
  WORK_NODE_PERSON,
  WORK_NODE_ROOT,
  type WorkGraphData,
} from '../demo-lifecycle/work-graph-types'

export type WorkFocusState =
  | {
      type: 'point';
      index: number;
      degree: number;
      neighbors: number[];
      secondDegree: number[];
      connectedLinks: number[];
      directLinks: number[];
      neighborhood: number[];
      visiblePoints: number[];
    }
  | { type: 'link'; index: number; endpoints: number[] }

interface WorkFocusPanelProjection {
  overviewDisabled: boolean;
  neighborsDisabled: boolean;
  stepDisabled: boolean;
  title: string;
  subtitle: string;
  node: string;
  degree: string;
  links: string;
  kind: string;
  group: string;
  company: string;
  strength: string;
}

function workNodeKindLabel (kind: number | undefined): string {
  if (kind === WORK_NODE_ROOT) return 'workspace'
  if (kind === WORK_NODE_GROUP) return 'segment'
  if (kind === WORK_NODE_COMPANY) return 'company'
  if (kind === WORK_NODE_PERSON) return 'person'
  return 'node'
}

function workEdgeKindLabel (kind: number | undefined): string {
  if (kind === 1) return 'second-degree'
  if (kind === 2) return 'predicted'
  return 'direct'
}

function workGroupNameForPoint (workData: WorkGraphData | null, index: number): string {
  const explicitLabel = workData?.nodeLabels?.[index]
  if (explicitLabel) return explicitLabel
  if (index === 0) return 'CRM Graph'
  const group = workData?.groupForNode?.[index]
  return group !== undefined && group >= 0
    ? WORK_GROUPS[group]?.label ?? 'Account'
    : 'Account'
}

function workNodeGroupLabel (workData: WorkGraphData | null, index: number): string {
  const group = workData?.groupForNode?.[index]
  return group !== undefined && group >= 0 ? WORK_GROUPS[group]?.label ?? 'Account' : 'All'
}

function workNodeCompanyLabel (workData: WorkGraphData | null, index: number): string {
  const company = workData?.nodeCompany?.[index]
  if (company !== undefined && company >= 0) return workData?.nodeLabels?.[company] ?? `Company ${company}`
  return '—'
}

export function projectWorkFocusPanel (options: {
  isWork: boolean;
  hasGraph: boolean;
  nodeCount: number;
  workData: WorkGraphData | null;
  renderData: GeneratedGraph | null;
  focusState: WorkFocusState | undefined;
}): WorkFocusPanelProjection {
  const { isWork, hasGraph, nodeCount, workData, renderData, focusState } = options
  const base = {
    overviewDisabled: !isWork || !hasGraph,
    neighborsDisabled: !isWork || !hasGraph || focusState?.type !== 'point',
    stepDisabled: !isWork || !hasGraph || focusState?.type !== 'point',
  }
  if (!isWork) {
    return {
      ...base,
      title: 'Overview',
      subtitle: 'Work graph',
      node: '—',
      degree: '—',
      links: '—',
      kind: '—',
      group: '—',
      company: '—',
      strength: '—',
    }
  }

  if (!focusState) {
    return {
      ...base,
      title: 'Overview',
      subtitle: `${nodeCount.toLocaleString()} nodes`,
      node: '—',
      degree: '—',
      links: '—',
      kind: 'graph',
      group: 'all',
      company: '—',
      strength: 'ready',
    }
  }

  if (focusState.type === 'point') {
    const kind = workData?.nodeKind?.[focusState.index]
    return {
      ...base,
      title: workGroupNameForPoint(workData, focusState.index),
      subtitle: workData?.nodeSubtitles?.[focusState.index] ?? `Point ${focusState.index.toLocaleString()}`,
      node: focusState.index.toLocaleString(),
      degree: focusState.degree.toLocaleString(),
      links: focusState.connectedLinks.length.toLocaleString(),
      kind: workNodeKindLabel(kind),
      group: workNodeGroupLabel(workData, focusState.index),
      company: workNodeCompanyLabel(workData, focusState.index),
      strength: `${Math.round((workData?.nodeScore?.[focusState.index] ?? 0) * 100)}%`,
    }
  }

  const edgeData = renderData as WorkGraphData | null
  const edgeKind = edgeData?.edgeKind?.[focusState.index]
  const edgeWeight = edgeData?.edgeWeight?.[focusState.index] ?? 1
  const endpointGroups = [...new Set(focusState.endpoints.map(index => workNodeGroupLabel(workData, index)))]
  return {
    ...base,
    title: 'Connection',
    subtitle: focusState.endpoints.map(index => workGroupNameForPoint(workData, index)).join(' <-> '),
    node: focusState.endpoints.length.toLocaleString(),
    degree: '—',
    links: '1',
    kind: workEdgeKindLabel(edgeKind),
    group: endpointGroups.join(' / '),
    company: '—',
    strength: `${edgeWeight.toFixed(2)}x`,
  }
}

export function applyWorkFocusPanel (focusEl: FocusElements, projection: WorkFocusPanelProjection): void {
  focusEl.overview.disabled = projection.overviewDisabled
  focusEl.neighbors.disabled = projection.neighborsDisabled
  focusEl.step.disabled = projection.stepDisabled
  focusEl.title.textContent = projection.title
  focusEl.subtitle.textContent = projection.subtitle
  focusEl.node.textContent = projection.node
  focusEl.degree.textContent = projection.degree
  focusEl.links.textContent = projection.links
  focusEl.kind.textContent = projection.kind
  focusEl.group.textContent = projection.group
  focusEl.company.textContent = projection.company
  focusEl.strength.textContent = projection.strength
}
