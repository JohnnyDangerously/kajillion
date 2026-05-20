import { Texture } from '@luma.gl/core'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

import { destroyForceLinkPrograms } from './destroy'
import { LinkDirection, type ForceLinkCreateContext, type ForceLinkState } from './contracts'

export function createForceLinkResources (
  context: ForceLinkCreateContext,
  state: ForceLinkState,
  direction: LinkDirection
): void {
  const { device, store: { pointsTextureSize, linksTextureSize }, data } = context
  if (!pointsTextureSize || !linksTextureSize) return

  state.linkFirstIndicesAndAmount = new Float32Array(pointsTextureSize * pointsTextureSize * 4)
  const linkBundleState = new Float32Array(linksTextureSize * linksTextureSize * 4)
  const grouped = direction === LinkDirection.INCOMING ? data.sourceIndexToTargetIndices : data.targetIndexToSourceIndices

  state.maxPointDegree = 0
  let linkIndex = 0
  grouped?.forEach((connectedPointIndices, pointIndex) => {
    if (!connectedPointIndices) return

    state.linkFirstIndicesAndAmount[pointIndex * 4 + 0] = linkIndex % linksTextureSize
    state.linkFirstIndicesAndAmount[pointIndex * 4 + 1] = Math.floor(linkIndex / linksTextureSize)
    state.linkFirstIndicesAndAmount[pointIndex * 4 + 2] = connectedPointIndices.length ?? 0

    connectedPointIndices.forEach(([connectedPointIndex, initialLinkIndex]) => {
      linkBundleState[linkIndex * 4 + 0] = connectedPointIndex % pointsTextureSize
      linkBundleState[linkIndex * 4 + 1] = Math.floor(connectedPointIndex / pointsTextureSize)
      const degree = data.degree?.[connectedPointIndex] ?? 0
      const connectedDegree = data.degree?.[pointIndex] ?? 0
      const degreeSum = degree + connectedDegree
      const bias = degreeSum !== 0 ? degree / degreeSum : 0.5
      const minDegree = Math.min(degree, connectedDegree)
      let strength = data.linkStrength?.[initialLinkIndex] ?? (1 / Math.max(minDegree, 1))
      strength = Math.sqrt(strength)
      linkBundleState[linkIndex * 4 + 2] = bias * strength
      linkBundleState[linkIndex * 4 + 3] = context.store.getRandomFloat(0, 1)

      linkIndex += 1
    })

    state.maxPointDegree = Math.max(state.maxPointDegree, connectedPointIndices.length ?? 0)
  })
  state.indices = linkBundleState

  ensurePointTexture(context, state, pointsTextureSize)
  state.linkFirstIndicesAndAmountTexture!.copyImageData({
    data: state.linkFirstIndicesAndAmount,
    bytesPerRow: getBytesPerRow('rgba32float', pointsTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  ensureLinkTexture(context, state, linksTextureSize)
  state.indicesTexture!.copyImageData({
    data: linkBundleState,
    bytesPerRow: getBytesPerRow('rgba32float', linksTextureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  if (state.previousMaxPointDegree !== undefined && state.previousMaxPointDegree !== state.maxPointDegree) {
    destroyForceLinkPrograms(state)
  }

  state.previousMaxPointDegree = state.maxPointDegree
  state.previousPointsTextureSize = pointsTextureSize
  state.previousLinksTextureSize = linksTextureSize
}

function ensurePointTexture (
  context: ForceLinkCreateContext,
  state: ForceLinkState,
  pointsTextureSize: number
): void {
  const recreatePointTextures =
    !state.linkFirstIndicesAndAmountTexture ||
    state.linkFirstIndicesAndAmountTexture.width !== pointsTextureSize ||
    state.linkFirstIndicesAndAmountTexture.height !== pointsTextureSize

  if (!recreatePointTextures) return

  if (state.linkFirstIndicesAndAmountTexture && !state.linkFirstIndicesAndAmountTexture.destroyed) {
    state.linkFirstIndicesAndAmountTexture.destroy()
  }
  state.linkFirstIndicesAndAmountTexture = context.device.createTexture({
    width: pointsTextureSize,
    height: pointsTextureSize,
    format: 'rgba32float',
    usage: Texture.SAMPLE | Texture.COPY_DST,
  })
}

function ensureLinkTexture (
  context: ForceLinkCreateContext,
  state: ForceLinkState,
  linksTextureSize: number
): void {
  const recreateLinkTextures =
    !state.indicesTexture ||
    state.indicesTexture.width !== linksTextureSize ||
    state.indicesTexture.height !== linksTextureSize

  if (!recreateLinkTextures) return

  if (state.indicesTexture && !state.indicesTexture.destroyed) state.indicesTexture.destroy()
  if (state.biasAndStrengthTexture && !state.biasAndStrengthTexture.destroyed) state.biasAndStrengthTexture.destroy()
  if (state.randomDistanceTexture && !state.randomDistanceTexture.destroyed) state.randomDistanceTexture.destroy()

  state.indicesTexture = context.device.createTexture({
    width: linksTextureSize,
    height: linksTextureSize,
    format: 'rgba32float',
    usage: Texture.SAMPLE | Texture.COPY_DST,
  })
  state.biasAndStrengthTexture = state.indicesTexture
  state.randomDistanceTexture = state.indicesTexture
}
