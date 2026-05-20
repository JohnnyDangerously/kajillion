export const CLUSTER_COUNT = 280
export const FIELD_STARS = 220000
export const CLUSTER_PARTICLES = 290000
export const CLUSTER_CORE_PARTICLES = 62000
export const FILAMENT_PARTICLES = 300000
export const AMBIENT_VOLUME_PARTICLES = 230000
export const FILAMENT_STEPS = 54
export const EDGE_NEIGHBORS = 5
export const FIELD_X_SPAN = 9200
export const FIELD_Z_NEAR = 3400
export const FIELD_Z_FAR = -10800

export const PARTICLE_VERTEX_SHADER = `
attribute float aSize;
attribute float aTwinkle;
varying vec3 vColor;
varying float vAlpha;
uniform float uTime;
uniform float uDive;

void main() {
  vColor = color;
  vec3 p = position;
  p.y += sin(uTime * 0.06 + p.x * 0.003 + p.z * 0.002 + aTwinkle * 6.28318) * 0.18;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float pulse = 0.985 + 0.015 * sin(uTime * 0.35 + aTwinkle * 6.28318);
  float depthScale = 560.0 / max(120.0, -mvPosition.z);
  gl_PointSize = aSize * pulse * depthScale * (1.0 + uDive * 0.46);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = clamp(0.32 + aSize * 0.16, 0.28, 1.0);
}
`

export const PARTICLE_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.18, 0.0, d);
  float halo = smoothstep(0.5, 0.07, d);
  gl_FragColor = vec4(vColor, (core * 0.96 + halo * 0.42) * vAlpha);
}
`

export const FILAMENT_VERTEX_SHADER = `
varying vec3 vColor;
varying float vAlpha;
uniform float uTime;
uniform float uDive;

void main() {
  vColor = color;
  vec3 p = position;
  p.y += sin(uTime * 0.08 + p.x * 0.004 + p.z * 0.003) * (0.16 + uDive * 0.42);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float depthScale = 520.0 / max(140.0, -mvPosition.z);
  gl_PointSize = 2.25 * depthScale * (1.0 + uDive * 0.34);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = clamp(0.32 + depthScale * 0.22, 0.28, 0.88);
}
`

export const FILAMENT_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, glow * vAlpha);
}
`

export const LINE_VERTEX_SHADER = `
varying vec3 vColor;
varying float vDepth;
uniform float uTime;
uniform float uDive;

void main() {
  vColor = color;
  vec3 p = position;
  p.y += sin(uTime * 0.06 + position.x * 0.003 + position.z * 0.002) * (0.20 + uDive * 0.50);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vDepth = clamp((900.0 + mvPosition.z) / 1100.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const LINE_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vDepth;
uniform float uDive;

void main() {
  float alpha = mix(0.055, 0.31, vDepth) * (1.0 + uDive * 0.34);
  gl_FragColor = vec4(vColor, alpha);
}
`
