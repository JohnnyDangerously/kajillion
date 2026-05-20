import fs from 'node:fs'
import path from 'node:path'

import { ignoredDirs, ignoredFiles, outputDir, root, textExtensions } from './config.mjs'

export function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(path.join(outputDir, 'symbols'), { recursive: true })
}

export function toRelative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

export function toAbsolute(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
}

export function listFiles(dir = root, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue
    if (ignoredFiles.has(entry.name)) continue
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      listFiles(absolute, files)
      continue
    }
    if (!entry.isFile()) continue
    if (textExtensions.has(path.extname(entry.name))) files.push(absolute)
  }
  return files.sort((a, b) => toRelative(a).localeCompare(toRelative(b)))
}

export function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
}

export function symbolFilePath(relativePath) {
  return path.join(outputDir, 'symbols', `${relativePath.replaceAll('/', '__')}.json`)
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}
