import type { Device, Framebuffer } from '@luma.gl/core'
import { defaultConfigValues } from '@/graph/variables'

export function ensureSampledPointsGridFramebuffer (
  device: Device,
  screenSize: [number, number],
  pointSamplingDistance: number | undefined,
  sampledPointsFbo: Framebuffer | undefined
): Framebuffer | undefined {
  let dist = pointSamplingDistance ?? Math.min(...screenSize) / 2
  if (dist === 0) dist = defaultConfigValues.pointSamplingDistance
  const width = Math.ceil(screenSize[0] / dist)
  const height = Math.ceil(screenSize[1] / dist)
  if (width === 0 || height === 0) return sampledPointsFbo

  if (!sampledPointsFbo || sampledPointsFbo.width !== width || sampledPointsFbo.height !== height) {
    if (sampledPointsFbo && !sampledPointsFbo.destroyed) {
      sampledPointsFbo.destroy()
    }
    return device.createFramebuffer({
      width,
      height,
      colorAttachments: ['rgba32float'],
    })
  }

  return sampledPointsFbo
}
