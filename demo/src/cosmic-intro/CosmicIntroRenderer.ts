import * as THREE from 'three'
import { createCosmicScene } from './createCosmicScene'
import type { CosmicIntroRendererOptions, CosmicSceneHandles } from './types'

const DEFAULT_DIVE_DURATION_MS = 2100

function easeInOutCubic (t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function disposeMaterial (material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) item.dispose()
    return
  }
  const mappedMaterial = material as THREE.Material & { map?: THREE.Texture }
  mappedMaterial.map?.dispose()
  material.dispose()
}

export class CosmicIntroRenderer {
  private readonly host: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly sceneHandles: CosmicSceneHandles
  private readonly resizeObserver: ResizeObserver
  private readonly diveDurationMs: number
  private readonly maxPixelRatio: number
  private readonly diveFromCamera = new THREE.Vector3()
  private readonly diveFromLookAt = new THREE.Vector3()
  private readonly currentLookAt = new THREE.Vector3()
  private readonly renderLookAt = new THREE.Vector3()
  private frame = 0
  private running = false
  private disposed = false
  private diveStartMs = 0
  private resolveDive: (() => void) | null = null

  public constructor (options: CosmicIntroRendererOptions) {
    this.host = options.host
    this.diveDurationMs = options.diveDurationMs ?? DEFAULT_DIVE_DURATION_MS
    this.maxPixelRatio = options.pixelRatio ?? 1.55
    this.sceneHandles = createCosmicScene()
    this.currentLookAt.copy(this.sceneHandles.startLookAt)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x02040a, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.className = 'cosmic-intro-canvas'
    this.host.appendChild(this.renderer.domElement)

    this.resizeObserver = new ResizeObserver(() => { this.resize() })
    this.resizeObserver.observe(this.host)
    this.resize()
  }

  public start (): void {
    if (this.running || this.disposed) return
    this.running = true
    this.frame = requestAnimationFrame(this.render)
  }

  public reset (): void {
    if (this.disposed) return
    this.diveStartMs = 0
    this.sceneHandles.camera.position.copy(this.sceneHandles.startCameraPosition)
    this.currentLookAt.copy(this.sceneHandles.startLookAt)
    this.sceneHandles.camera.lookAt(this.currentLookAt)
    this.sceneHandles.particleUniforms.uDive.value = 0
    this.sceneHandles.filamentUniforms.uDive.value = 0
  }

  public beginDive (): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.start()
    this.diveFromCamera.copy(this.sceneHandles.camera.position)
    this.diveFromLookAt.copy(this.currentLookAt)
    this.diveStartMs = performance.now()
    return new Promise(resolve => {
      this.resolveDive = resolve
    })
  }

  public dispose (): void {
    if (this.disposed) return
    this.disposed = true
    this.running = false
    if (this.frame !== 0) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.resizeObserver.disconnect()
    this.sceneHandles.scene.traverse(object => {
      const mesh = object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      }
      mesh.geometry?.dispose()
      if (mesh.material) disposeMaterial(mesh.material)
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.resolveDive?.()
    this.resolveDive = null
  }

  public get isRunning (): boolean {
    return this.running && !this.disposed
  }

  private readonly render = (now: number): void => {
    if (!this.running || this.disposed) return
    const elapsed = now * 0.001
    const handles = this.sceneHandles
    let dive = 0

    if (this.diveStartMs > 0) {
      const linear = Math.min(1, (now - this.diveStartMs) / this.diveDurationMs)
      dive = easeInOutCubic(linear)
      handles.camera.position.lerpVectors(this.diveFromCamera, handles.diveCameraPosition, dive)
      this.currentLookAt.lerpVectors(this.diveFromLookAt, handles.diveLookAt, dive)
      if (linear >= 1 && this.resolveDive) {
        this.resolveDive()
        this.resolveDive = null
      }
    } else {
      handles.camera.position.x = handles.startCameraPosition.x + Math.sin(elapsed * 0.12) * 3
      handles.camera.position.y = handles.startCameraPosition.y + Math.cos(elapsed * 0.10) * 2
      handles.camera.position.z = handles.startCameraPosition.z + Math.sin(elapsed * 0.08) * 5
      this.currentLookAt.x = handles.startLookAt.x + Math.sin(elapsed * 0.12) * 2
      this.currentLookAt.y = handles.startLookAt.y + Math.cos(elapsed * 0.10) * 1
      this.currentLookAt.z = handles.startLookAt.z
    }

    handles.particleUniforms.uTime.value = elapsed
    handles.particleUniforms.uDive.value = dive
    handles.filamentUniforms.uTime.value = elapsed
    handles.filamentUniforms.uDive.value = dive
    for (const [index, group] of handles.driftGroups.entries()) {
      group.rotation.y = Math.sin(elapsed * 0.035 + index) * 0.004
      group.rotation.x = Math.cos(elapsed * 0.030 + index) * 0.003
    }

    this.renderLookAt.copy(this.currentLookAt)
    handles.camera.lookAt(this.renderLookAt)
    this.renderer.render(handles.scene, handles.camera)
    this.frame = requestAnimationFrame(this.render)
  }

  private resize (): void {
    if (this.disposed) return
    const rect = this.host.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    this.renderer.setPixelRatio(Math.min(this.maxPixelRatio, Math.max(1, window.devicePixelRatio || 1)))
    this.renderer.setSize(width, height, false)
    this.sceneHandles.camera.aspect = width / height
    this.sceneHandles.camera.updateProjectionMatrix()
  }
}
