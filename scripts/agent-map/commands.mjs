import fs from 'node:fs'
import path from 'node:path'

import { outputDir, root } from './config.mjs'
import { listFeatureContracts } from './features.mjs'
import {
  ensureOutputDir,
  listFiles,
  readLines,
  symbolFilePath,
  toAbsolute,
  toRelative,
  writeJson
} from './files.mjs'
import { normalizeSearchText } from './search.mjs'
import { collectFileSummary } from './symbols.mjs'

export function createRepoMap() {
  ensureOutputDir()
  const files = listFiles().map(collectFileSummary)
  for (const file of files) writeJson(symbolFilePath(file.path), file)

  const featureFiles = listFeatureContracts()
  const map = {
    generatedAt: new Date().toISOString(),
    root,
    files: files.map((file) => ({
      path: file.path,
      extension: file.extension,
      lines: file.lines,
      imports: file.imports,
      symbolCount: file.symbols.length,
      topLevelSymbols: file.symbols
        .filter((symbol) => symbol.depth <= 1)
        .map((symbol) => ({
          kind: symbol.kind,
          name: symbol.name,
          qualifiedName: symbol.qualifiedName,
          exported: symbol.exported,
          startLine: symbol.startLine,
          endLine: symbol.endLine
        }))
    })),
    features: featureFiles
  }
  writeJson(path.join(outputDir, 'repo.json'), map)
  console.log(`Wrote ${toRelative(path.join(outputDir, 'repo.json'))}`)
  console.log(`Wrote ${files.length} symbol files under ${toRelative(path.join(outputDir, 'symbols'))}`)
}

export function printSymbols(fileArg, usage) {
  if (!fileArg) usage(1)
  const filePath = toAbsolute(fileArg)
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${fileArg}`)
  const summary = collectFileSummary(filePath)
  console.log(JSON.stringify(summary, null, 2))
}

export function printRange(fileArg, startArg, endArg, usage) {
  if (!fileArg || !startArg || !endArg) usage(1)
  const filePath = toAbsolute(fileArg)
  const startLine = Number.parseInt(startArg, 10)
  const endLine = Number.parseInt(endArg, 10)
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${fileArg}`)
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new Error(`Invalid range: ${startArg} ${endArg}`)
  }

  const lines = readLines(filePath)
  const width = String(endLine).length
  for (let lineNumber = startLine; lineNumber <= Math.min(endLine, lines.length); lineNumber += 1) {
    const label = String(lineNumber).padStart(width, ' ')
    console.log(`${label}: ${lines[lineNumber - 1]}`)
  }
}

export function printOwners(query = '') {
  const normalizedQuery = normalizeSearchText(query)
  const features = listFeatureContracts().filter((feature) => {
    if (!normalizedQuery) return true
    return normalizeSearchText(JSON.stringify(feature)).includes(normalizedQuery)
  })
  console.log(JSON.stringify(features, null, 2))
}

export function printFind(query, usage) {
  if (!query) usage(1)
  const normalizedQuery = normalizeSearchText(query)
  const matches = []
  for (const filePath of listFiles()) {
    const summary = collectFileSummary(filePath)
    const fileMatches =
      normalizeSearchText(summary.path).includes(normalizedQuery) ||
      summary.imports.some((importPath) => normalizeSearchText(importPath).includes(normalizedQuery))
    const symbolMatches = summary.symbols.filter((symbol) =>
      normalizeSearchText(`${symbol.kind} ${symbol.qualifiedName}`).includes(normalizedQuery)
    )
    if (!fileMatches && symbolMatches.length === 0) continue
    matches.push({
      path: summary.path,
      lines: summary.lines,
      fileMatch: fileMatches,
      symbols: symbolMatches.map((symbol) => ({
        kind: symbol.kind,
        qualifiedName: symbol.qualifiedName,
        startLine: symbol.startLine,
        endLine: symbol.endLine
      }))
    })
  }
  console.log(JSON.stringify(matches, null, 2))
}
