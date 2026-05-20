import { Buffer, type Device } from '@luma.gl/core'

import {
  getActiveLinkMaskSignature,
  writeActiveLinkMask,
} from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'

export interface ActiveLineMaskState {
  activeLineMaskBuffer: Buffer | undefined;
  activeLineMaskCapacity: number;
  activeLineMaskSignature: string;
  activeLineMaskLinkCount: number;
  activeLineMaskDirty: boolean;
  activeLineMaskIndicesRef: number[] | undefined;
}

export interface ActiveLineMaskUpdateInput {
  device: Device;
  linkCount: number;
  activeLinkIndices: number[] | undefined;
  state: ActiveLineMaskState;
}

export function updateActiveLineMask (input: ActiveLineMaskUpdateInput): ActiveLineMaskState {
  const { device, linkCount, activeLinkIndices, state } = input
  if (device.info?.type !== 'webgpu' || linkCount === 0) return state

  if (
    !state.activeLineMaskDirty &&
    state.activeLineMaskIndicesRef === activeLinkIndices &&
    state.activeLineMaskLinkCount === linkCount &&
    state.activeLineMaskBuffer &&
    !state.activeLineMaskBuffer.destroyed &&
    state.activeLineMaskCapacity >= linkCount
  ) {
    return state
  }

  const signature = getActiveLinkMaskSignature(linkCount, activeLinkIndices)
  if (
    !state.activeLineMaskDirty &&
    state.activeLineMaskSignature === signature &&
    state.activeLineMaskLinkCount === linkCount &&
    state.activeLineMaskBuffer &&
    !state.activeLineMaskBuffer.destroyed &&
    state.activeLineMaskCapacity >= linkCount
  ) {
    return state
  }

  let activeLineMaskBuffer = state.activeLineMaskBuffer
  let activeLineMaskCapacity = state.activeLineMaskCapacity
  let recreated = false
  if (!activeLineMaskBuffer || activeLineMaskBuffer.destroyed || activeLineMaskCapacity < linkCount) {
    if (activeLineMaskBuffer && !activeLineMaskBuffer.destroyed) {
      activeLineMaskBuffer.destroy()
    }
    activeLineMaskBuffer = device.createBuffer({
      byteLength: linkCount * Uint32Array.BYTES_PER_ELEMENT,
      usage: Buffer.STORAGE | Buffer.COPY_DST,
    })
    activeLineMaskCapacity = linkCount
    recreated = true
  }
  if (!state.activeLineMaskDirty && !recreated && state.activeLineMaskSignature === signature) {
    return { ...state, activeLineMaskBuffer, activeLineMaskCapacity }
  }

  const mask = new Uint32Array(linkCount)
  writeActiveLinkMask(mask, activeLinkIndices)
  activeLineMaskBuffer.write(mask)

  return {
    activeLineMaskBuffer,
    activeLineMaskCapacity,
    activeLineMaskSignature: signature,
    activeLineMaskLinkCount: linkCount,
    activeLineMaskDirty: false,
    activeLineMaskIndicesRef: activeLinkIndices,
  }
}
