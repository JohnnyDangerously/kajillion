import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { sourceExtensions } from './config.mjs'
import { readLines, toRelative } from './files.mjs'

function makeSourceFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const scriptKind = scriptKindForFile(filePath)
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind)
}

function scriptKindForFile(filePath) {
  switch (path.extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    default:
      return ts.ScriptKind.TS
  }
}

function lineAndColumn(sourceFile, pos) {
  const point = sourceFile.getLineAndCharacterOfPosition(pos)
  return { line: point.line + 1, column: point.character + 1 }
}

function rangeForNode(sourceFile, node) {
  const start = lineAndColumn(sourceFile, node.getStart(sourceFile))
  const end = lineAndColumn(sourceFile, node.end)
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  }
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind))
}

function isExported(node) {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

function isDefaultExport(node) {
  return (
    hasModifier(node, ts.SyntaxKind.DefaultKeyword) ||
    hasModifier(node.parent, ts.SyntaxKind.DefaultKeyword)
  )
}

function getNodeName(node) {
  if ('name' in node && node.name) return node.name.getText()
  return null
}

function symbolEntriesForNode(sourceFile, node, parentName, depth) {
  const entries = []
  const range = rangeForNode(sourceFile, node)
  const push = (kind, name, targetNode = node) => {
    if (!name) return
    entries.push({
      kind,
      name,
      qualifiedName: parentName ? `${parentName}.${name}` : name,
      parent: parentName,
      depth,
      exported: isExported(targetNode),
      defaultExport: isDefaultExport(targetNode),
      ...rangeForNode(sourceFile, targetNode)
    })
  }

  if (ts.isFunctionDeclaration(node)) push('function', getNodeName(node) ?? 'default')
  if (ts.isClassDeclaration(node)) push('class', getNodeName(node) ?? 'default')
  if (ts.isInterfaceDeclaration(node)) push('interface', getNodeName(node))
  if (ts.isTypeAliasDeclaration(node)) push('type', getNodeName(node))
  if (ts.isEnumDeclaration(node)) push('enum', getNodeName(node))
  if (ts.isModuleDeclaration(node)) push('namespace', getNodeName(node))
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) push('method', getNodeName(node))
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) push('property', getNodeName(node))

  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      const name = declaration.name.getText()
      entries.push({
        kind: isFunctionLikeInitializer(declaration.initializer) ? 'function-variable' : 'variable',
        name,
        qualifiedName: parentName ? `${parentName}.${name}` : name,
        parent: parentName,
        depth,
        exported: isExported(node),
        defaultExport: isDefaultExport(node),
        ...range
      })
    }
  }

  return entries
}

function isFunctionLikeInitializer(initializer) {
  return Boolean(
    initializer &&
      (ts.isArrowFunction(initializer) ||
        ts.isFunctionExpression(initializer) ||
        ts.isClassExpression(initializer))
  )
}

function childParentName(node, entries, parentName) {
  const named = entries.find((entry) =>
    ['class', 'namespace', 'function', 'function-variable'].includes(entry.kind)
  )
  return named?.qualifiedName ?? parentName
}

function collectSymbols(sourceFile) {
  const symbols = []
  const visit = (node, parentName = null, depth = 0) => {
    const entries = symbolEntriesForNode(sourceFile, node, parentName, depth)
    symbols.push(...entries)
    const nextParentName = childParentName(node, entries, parentName)
    ts.forEachChild(node, (child) => visit(child, nextParentName, depth + 1))
  }
  visit(sourceFile)
  return symbols
}

function collectImports(sourceFile) {
  const imports = []
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const moduleText = statement.moduleSpecifier.getText(sourceFile).replace(/^['"]|['"]$/g, '')
    imports.push(moduleText)
  }
  return imports
}

export function collectFileSummary(filePath) {
  const relative = toRelative(filePath)
  const extension = path.extname(filePath)
  const lines = readLines(filePath).length
  if (!sourceExtensions.has(extension)) {
    return {
      path: relative,
      extension,
      lines,
      imports: [],
      symbols: []
    }
  }

  const sourceFile = makeSourceFile(filePath)
  const symbols = collectSymbols(sourceFile)
  return {
    path: relative,
    extension,
    lines,
    imports: collectImports(sourceFile),
    symbols
  }
}
