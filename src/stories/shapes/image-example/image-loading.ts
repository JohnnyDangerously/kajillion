const pngUrlToImageData = (pngUrl: string): Promise<ImageData> => {
  return new Promise<ImageData>((resolve, reject) => {
    const img = new Image()

    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get 2D context'))
        return
      }

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve(imageData)
    }
    img.onerror = (): void => reject(new Error(`Failed to load image: ${pngUrl}`))
    img.src = pngUrl
  })
}

export const loadPngImages = (pngUrls: string[]): Promise<ImageData[]> => {
  return Promise.all(pngUrls.map(pngUrlToImageData))
}
