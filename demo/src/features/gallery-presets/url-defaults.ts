import type { GalleryPalette } from './types'

export function parsePaletteParam (value: string | null): GalleryPalette {
  return value === 'ion' ||
    value === 'ember' ||
    value === 'signal' ||
    value === 'tokyo' ||
    value === 'subnet' ||
    value === 'analyst' ||
    value === 'insight' ||
    value === 'fintech' ||
    value === 'influence' ||
    value === 'talent' ||
    value === 'cosmic'
    ? value
    : 'category'
}

export function isGalleryPalette (palette: GalleryPalette): boolean {
  return palette !== 'category'
}

export function galleryPresetUrlDefaults (palette: GalleryPalette): Record<string, string | null> {
  if (palette === 'cosmic') {
    return {
      n: '100000',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '1',
      sim: '0',
      blend: 'add',
      msaa: '1',
      tilt: '0',
    }
  }
  if (palette === 'signal') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'tokyo') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'insight') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'fintech') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'influence') {
    return {
      n: '10000',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'talent') {
    return {
      n: '500',
      data: 'cosmo',
      theme: 'dark',
      renderLinks: '0',
      density: '0',
      lod: '0',
      lanes: '0',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'subnet') {
    return {
      n: '500',
      data: 'work',
      theme: 'light',
      renderLinks: '1',
      density: '0',
      lod: '0',
      lanes: '1',
      sim: '0',
      blend: 'normal',
    }
  }
  if (palette === 'analyst') {
    return {
      n: '4000',
      data: 'work',
      theme: 'light',
      renderLinks: '1',
      density: '1',
      lod: '1',
      lanes: '1',
      sim: '0',
      blend: 'normal',
      msaa: '4',
      tilt: '0',
    }
  }
  return { theme: 'dark' }
}
