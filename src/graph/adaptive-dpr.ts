export interface AdaptiveDprTransform {
  x: number;
  y: number;
  k: number;
}

export interface AdaptiveDprDecisionInput {
  nowMs: number;
  setting: boolean | number;
  configuredPixelRatio: number;
  transform: AdaptiveDprTransform;
  previousTransform: AdaptiveDprTransform;
  isDragActive: boolean;
  isZoomRunning: boolean;
  isSimulationRunning: boolean;
  lastInteractionMs: number;
  settleMs: number;
}

export interface AdaptiveDprDecision {
  desired: number;
  fullDpr: number;
  interactionDpr: number;
  settled: boolean;
  lastInteractionMs: number;
  cameraMoved: boolean;
}

export const sanitizePixelRatio = (ratio: number): number =>
  Number.isFinite(ratio) && ratio > 0 ? ratio : 1

export const hasAdaptiveDprCameraMotion = (
  current: AdaptiveDprTransform,
  previous: AdaptiveDprTransform,
): boolean => {
  const hasPreviousTransform = Number.isFinite(previous.x) &&
    Number.isFinite(previous.y) &&
    Number.isFinite(previous.k)
  return hasPreviousTransform && (
    Math.abs(current.x - previous.x) > 0.25 ||
    Math.abs(current.y - previous.y) > 0.25 ||
    Math.abs(Math.log(Math.max(current.k, 1e-6) / Math.max(previous.k, 1e-6))) > 0.0005
  )
}

export const resolveAdaptiveDprDecision = (
  input: AdaptiveDprDecisionInput,
): AdaptiveDprDecision => {
  const interactionDpr = sanitizePixelRatio(typeof input.setting === 'number' ? input.setting : 1.0)
  const fullDpr = sanitizePixelRatio(input.configuredPixelRatio)
  const cameraMoved = hasAdaptiveDprCameraMotion(input.transform, input.previousTransform)
  const isInteracting = input.isDragActive ||
    (input.isZoomRunning && cameraMoved) ||
    input.isSimulationRunning
  const lastInteractionMs = isInteracting ? input.nowMs : input.lastInteractionMs
  const settled = input.nowMs - lastInteractionMs > input.settleMs
  return {
    desired: settled ? fullDpr : interactionDpr,
    fullDpr,
    interactionDpr,
    settled,
    lastInteractionMs,
    cameraMoved,
  }
}
