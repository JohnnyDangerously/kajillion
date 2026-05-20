export type LinkEndpointAttributeData = {
  pointAData: Float32Array;
  pointBData: Float32Array;
}

export type LinkArrowAttributeData = {
  arrowData: Float32Array;
  hasArrowedLinks: boolean;
}

export function createLinkEndpointAttributeData (
  linksNumber: number,
  links: ArrayLike<number>,
  pointsTextureSize: number
): LinkEndpointAttributeData {
  const pointAData = new Float32Array(linksNumber * 2)
  const pointBData = new Float32Array(linksNumber * 2)

  for (let i = 0; i < linksNumber; i++) {
    const fromIndex = links[i * 2] as number
    const toIndex = links[i * 2 + 1] as number
    const fromX = fromIndex % pointsTextureSize
    const fromY = Math.floor(fromIndex / pointsTextureSize)
    const toX = toIndex % pointsTextureSize
    const toY = Math.floor(toIndex / pointsTextureSize)

    pointAData[i * 2] = fromX
    pointAData[i * 2 + 1] = fromY
    pointBData[i * 2] = toX
    pointBData[i * 2 + 1] = toY
  }

  return { pointAData, pointBData }
}

export function createSequentialLinkIndexData (linksNumber: number): Float32Array {
  const linkIndices = new Float32Array(linksNumber)
  for (let i = 0; i < linksNumber; i++) {
    linkIndices[i] = i
  }
  return linkIndices
}

export function createLinkArrowAttributeData (
  linksNumber: number,
  linkArrows: ArrayLike<number> | undefined
): LinkArrowAttributeData {
  const arrowData = linkArrows
    ? new Float32Array(linkArrows)
    : new Float32Array(linksNumber).fill(0)

  let hasArrowedLinks = false
  for (const v of arrowData) {
    if (v !== 0) {
      hasArrowedLinks = true
      break
    }
  }

  return { arrowData, hasArrowedLinks }
}
