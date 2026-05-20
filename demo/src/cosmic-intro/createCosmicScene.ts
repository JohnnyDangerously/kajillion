import * as THREE from 'three'
import { createClusters, createEdges } from './scene-clusters'
import { createFilamentLines, createTopologySurface } from './scene-lines'
import {
  createAmbientVolume,
  createClusterCoreHighlights,
  createFilamentDust,
  createParticleField,
} from './scene-particles'
import type { CosmicSceneHandles } from './types'

export function createCosmicScene (): CosmicSceneHandles {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x02040a, 0.00034)

  const camera = new THREE.PerspectiveCamera(56, 1, 0.5, 9800)
  const target = new THREE.Vector3(70, 4, -48)
  const startCameraPosition = new THREE.Vector3(-160, 3850, 1380)
  const startLookAt = new THREE.Vector3(0, -760, -1160)
  const diveCameraPosition = new THREE.Vector3(82, 72, 122)
  const diveLookAt = target.clone()
  camera.position.copy(startCameraPosition)
  camera.lookAt(startLookAt)

  const clusters = createClusters()
  const edges = createEdges(clusters)
  const particleUniforms = {
    uTime: { value: 0 },
    uDive: { value: 0 },
  }
  const filamentUniforms = {
    uTime: { value: 0 },
    uDive: { value: 0 },
  }

  const webGroup = new THREE.Group()
  webGroup.add(createAmbientVolume(clusters, particleUniforms))
  webGroup.add(createTopologySurface(clusters, filamentUniforms))
  webGroup.add(createFilamentLines(clusters, edges, filamentUniforms))
  webGroup.add(createFilamentDust(clusters, edges, filamentUniforms))
  webGroup.add(createParticleField(clusters, particleUniforms))
  webGroup.add(createClusterCoreHighlights(clusters, particleUniforms))
  webGroup.rotation.x = -0.018
  webGroup.rotation.z = -0.055
  scene.add(webGroup)

  const targetLight = new THREE.PointLight(0xffc46d, 4.2, 460, 1.8)
  targetLight.position.copy(target)
  scene.add(targetLight)
  scene.add(new THREE.AmbientLight(0x6f86ff, 0.44))

  return {
    scene,
    camera,
    target,
    startCameraPosition,
    startLookAt,
    diveCameraPosition,
    diveLookAt,
    particleUniforms,
    filamentUniforms,
    driftGroups: [webGroup],
  }
}
