import * as THREE from 'three'
import {
  FILAMENT_FRAGMENT_SHADER,
  FILAMENT_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
} from './scene-constants'
import type { CosmicSceneHandles } from './types'

export interface ParticlePointBuffers {
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
  twinkle: Float32Array
}

function createParticleGeometry (buffers: ParticlePointBuffers): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1))
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(buffers.twinkle, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function createParticleMaterial (
  uniforms: CosmicSceneHandles['particleUniforms']
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

function createFilamentMaterial (
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FILAMENT_VERTEX_SHADER,
    fragmentShader: FILAMENT_FRAGMENT_SHADER,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

export function createParticlePoints (
  buffers: ParticlePointBuffers,
  uniforms: CosmicSceneHandles['particleUniforms']
): THREE.Points {
  return new THREE.Points(createParticleGeometry(buffers), createParticleMaterial(uniforms))
}

export function createFilamentParticlePoints (
  buffers: ParticlePointBuffers,
  uniforms: CosmicSceneHandles['filamentUniforms']
): THREE.Points {
  return new THREE.Points(createParticleGeometry(buffers), createFilamentMaterial(uniforms))
}
