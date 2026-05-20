const TIME_ELAPSED_EXT_FALLBACK = 0x88BF
const GPU_DISJOINT_EXT_FALLBACK = 0x8FBB
const QUERY_RESULT_AVAILABLE_FALLBACK = 0x8867
const QUERY_RESULT_FALLBACK = 0x8866

interface TimerQueryExtension {
  TIME_ELAPSED_EXT?: number;
  GPU_DISJOINT_EXT?: number;
  QUERY_RESULT_AVAILABLE?: number;
  QUERY_RESULT?: number;
}

export interface TimerQueryEnums {
  timeElapsed: number;
  gpuDisjoint: number;
  queryResultAvailable: number;
  queryResult: number;
}

export function getTimerQueryEnums (gl: WebGL2RenderingContext): TimerQueryEnums | null {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null
  if (!ext) return null
  return {
    timeElapsed: ext.TIME_ELAPSED_EXT ?? TIME_ELAPSED_EXT_FALLBACK,
    gpuDisjoint: ext.GPU_DISJOINT_EXT ?? GPU_DISJOINT_EXT_FALLBACK,
    queryResultAvailable: ext.QUERY_RESULT_AVAILABLE ?? QUERY_RESULT_AVAILABLE_FALLBACK,
    queryResult: ext.QUERY_RESULT ?? QUERY_RESULT_FALLBACK,
  }
}
