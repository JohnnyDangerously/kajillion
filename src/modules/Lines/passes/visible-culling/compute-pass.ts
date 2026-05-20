import type { Device } from '@luma.gl/core'

import type { GpuTimerLike } from '@/graph/modules/Lines/passes/shared/contracts'

export function runVisibleLineComputePass (
  device: Device,
  timer: GpuTimerLike | undefined,
  label: string,
  execute: (pass: ReturnType<Device['beginComputePass']>) => void
): void {
  timer?.begin(label)
  const pass = device.beginComputePass({ id: label })
  execute(pass)
  pass.end()
  timer?.end()
}
