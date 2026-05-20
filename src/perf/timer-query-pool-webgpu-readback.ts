import { BYTES_PER_TIMESTAMP } from './timer-query-pool-webgpu-constants'

export interface TimestampPair {
  label: string;
  beginIdx: number;
  endIdx: number;
}

export interface FrameRecord {
  pairs: TimestampPair[];
  stagingBuffer: GPUBuffer | null;
  byteLength: number;
  copyScheduled: boolean;
  mapInFlight: boolean;
}

export interface QueryRange {
  firstQuery: number;
  queryCount: number;
  byteLength: number;
}

export function createFrameRecord (): FrameRecord {
  return { pairs: [], stagingBuffer: null, byteLength: 0, copyScheduled: false, mapInFlight: false }
}

export function computeQueryRange (frame: FrameRecord): QueryRange | null {
  let minIdx = Number.POSITIVE_INFINITY
  let maxIdx = -1
  for (const p of frame.pairs) {
    if (p.beginIdx < minIdx) minIdx = p.beginIdx
    if (p.endIdx > maxIdx) maxIdx = p.endIdx
  }
  if (maxIdx < 0) return null
  const firstQuery = minIdx
  const queryCount = (maxIdx - minIdx) + 1
  const byteLength = queryCount * BYTES_PER_TIMESTAMP
  return { firstQuery, queryCount, byteLength }
}

export function decodeTimestamps (range: ArrayBuffer, queryCount: number): bigint[] {
  const view = new DataView(range)
  const timestamps = new Array<bigint>(queryCount)
  for (let i = 0; i < queryCount; i += 1) {
    const lo = view.getUint32(i * 8, true)
    const hi = view.getUint32(i * 8 + 4, true)
    timestamps[i] = (BigInt(hi) * BigInt(0x100000000)) + BigInt(lo)
  }
  return timestamps
}
