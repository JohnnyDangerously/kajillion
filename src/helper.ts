import { color as d3Color } from 'd3-color'
import { Device } from '@luma.gl/core'
import { WebGLDevice } from '@luma.gl/webgl'
import { GL } from '@luma.gl/constants'
import DOMPurify from 'dompurify'

import { MAX_POINT_SIZE } from '@/graph/modules/Shared/point-constants'

export { readPixels, Rgba32FloatFramebufferReadback, readRgba32FloatFramebufferAsync } from './helper/readback'

export const isFunction = <T>(a: T): boolean => typeof a === 'function'
export const isArray = <T>(a: unknown | T[]): a is T[] => Array.isArray(a)
export const isObject = <T>(a: T): boolean => (a instanceof Object)
export const isAClassInstance = <T>(a: T): boolean => {
  if (a instanceof Object) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    return (a as T & Object).constructor.name !== 'Function' && (a as T & Object).constructor.name !== 'Object'
  } else return false
}
export const isPlainObject = <T>(a: T): boolean => isObject(a) && !isArray(a) && !isFunction(a) && !isAClassInstance(a)

export function getRgbaColor (value: string | [number, number, number, number]): [number, number, number, number] {
  let rgba: [number, number, number, number]
  if (isArray(value)) {
    rgba = value
  } else {
    const color = d3Color(value)
    const rgb = color?.rgb()
    rgba = [
      (rgb?.r ?? 0) / 255,
      (rgb?.g ?? 0) / 255,
      (rgb?.b ?? 0) / 255,
      color?.opacity ?? 1,
    ]
  }

  return rgba
}

export function rgbToBrightness (r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Extracts point indices from a pixel readback buffer.
 * Every 4th value (R channel) is checked — non-zero means the point at that index was found.
 */
export function extractIndicesFromPixels (pixels: Float32Array): number[] {
  const result: number[] = []
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 0) result.push(i / 4)
  }
  return result
}

/**
 * Returns the maximum point size supported by the device, scaled by pixel ratio.
 * For WebGL devices, reads the limit from the context; for other device types, uses MAX_POINT_SIZE from Store.
 * @param device - The luma.gl device
 * @param pixelRatio - Device pixel ratio to scale the result
 * @returns Maximum point size (device limit / pixelRatio)
 */
export function getMaxPointSize (device: Device, pixelRatio: number): number {
  switch (device.info.type) {
  case 'webgl': {
    const range = (device as WebGLDevice).gl.getParameter(GL.ALIASED_POINT_SIZE_RANGE) as [number, number]
    return (range?.[1] ?? MAX_POINT_SIZE) / pixelRatio
  }
  case 'webgpu':
    // WebGPU has no built-in gl_PointSize equivalent — points are always rasterized
    // at size 1 and larger sprites need instanced-quad emulation. Returning the same
    // artistic cap as WebGL2 keeps cull-margin math consistent across backends.
    return MAX_POINT_SIZE / pixelRatio
  default:
    return MAX_POINT_SIZE / pixelRatio
  }
}

export function clamp (num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max)
}

export function isNumber (value: number | undefined | null | typeof NaN): boolean {
  return value !== undefined && value !== null && !Number.isNaN(value)
}

/**
 * Sanitizes HTML content to prevent XSS attacks using DOMPurify
 *
 * This function is used internally to sanitize HTML content before setting innerHTML,
 * such as in attribution text. It uses a safe default configuration that allows
 * only common safe HTML elements and attributes.
 *
 * @param html The HTML string to sanitize
 * @param options Optional DOMPurify configuration options to override defaults
 * @returns Sanitized HTML string safe for innerHTML usage
 */
export function sanitizeHtml (html: string, options?: DOMPurify.Config): string {
  return DOMPurify.sanitize(html, {
    // Default configuration: allow common safe HTML elements and attributes
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style'],
    ALLOW_DATA_ATTR: false,
    ...options,
  })
}
