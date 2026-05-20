export function hexToRgb (hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbString ([r, g, b]: [number, number, number], alpha = 1): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`
}

export function colorString (hex: string, alpha: number): string {
  return rgbString(hexToRgb(hex), alpha)
}

export function mixRgb (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export function lighten (hex: string, amount: number): string {
  return rgbString(mixRgb(hexToRgb(hex), [255, 255, 255], amount), 1)
}

export function darken (hex: string, amount: number): string {
  return rgbString(mixRgb(hexToRgb(hex), [0, 0, 0], amount), 1)
}
