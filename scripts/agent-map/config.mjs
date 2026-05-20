import path from 'node:path'
import process from 'node:process'

export const root = process.cwd()
export const outputDir = path.join(root, '.agent-map')

export const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs'
])

export const textExtensions = new Set([
  ...sourceExtensions,
  '.wgsl',
  '.vert',
  '.frag',
  '.css',
  '.html',
  '.md',
  '.json'
])

export const ignoredDirs = new Set([
  '.agent-map',
  '.git',
  '.idea',
  '.vite',
  '.claude',
  'dist',
  'node_modules',
  'storybook-static'
])

export const ignoredFiles = new Set([
  '.dependency-cruiser-known-violations.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb'
])
