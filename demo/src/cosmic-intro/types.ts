import type * as THREE from 'three'

export interface CosmicIntroTarget {
  x: number;
  y: number;
}

export interface CosmicIntroRendererOptions {
  host: HTMLElement;
  target?: CosmicIntroTarget;
  pixelRatio?: number;
  diveDurationMs?: number;
}

export interface CosmicSceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  startCameraPosition: THREE.Vector3;
  startLookAt: THREE.Vector3;
  diveCameraPosition: THREE.Vector3;
  diveLookAt: THREE.Vector3;
  particleUniforms: {
    uTime: { value: number };
    uDive: { value: number };
  };
  filamentUniforms: {
    uTime: { value: number };
    uDive: { value: number };
  };
  driftGroups: THREE.Object3D[];
}
