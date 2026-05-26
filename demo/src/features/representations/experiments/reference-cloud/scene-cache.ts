import { buildReferenceCloudScene } from './layout'
import type { CloudScene } from './types'

const scenes = new Map<string, CloudScene>()

export function getReferenceCloudScene (nodeCount: number, seed: number): CloudScene | null {
  return scenes.get(sceneKey(nodeCount, seed)) ?? null
}

export function buildCachedReferenceCloudScene (nodeCount: number, seed: number): CloudScene {
  const key = sceneKey(nodeCount, seed)
  const cached = scenes.get(key)
  if (cached) return cached
  const started = performance.now()
  const scene = buildReferenceCloudScene(nodeCount, seed)
  scene.metrics.sceneBuildMs = performance.now() - started
  scenes.set(key, scene)
  return scene
}

function sceneKey (nodeCount: number, seed: number): string {
  return `${nodeCount}:${seed}`
}
