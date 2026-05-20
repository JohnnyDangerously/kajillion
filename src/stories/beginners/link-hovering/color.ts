export function hslToRgb (hue: number, saturation: number, lightness: number): [number, number, number] {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - c / 2

  let r, g, b
  if (hue >= 0 && hue < 60) {
    r = c; g = x; b = 0
  } else if (hue >= 60 && hue < 120) {
    r = x; g = c; b = 0
  } else if (hue >= 120 && hue < 180) {
    r = 0; g = c; b = x
  } else if (hue >= 180 && hue < 240) {
    r = 0; g = x; b = c
  } else if (hue >= 240 && hue < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  return [r + m, g + m, b + m]
}
