#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = Number.parseInt(process.env.MAX_SOURCE_LINES ?? '190', 10);
const SOURCE_ROOTS = ['src', 'demo/src', 'benchmarks/src', 'scripts'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.css', '.html']);
const IGNORE_PARTS = new Set([
  '.git',
  '.agent-map',
  '.claude',
  'dist',
  'node_modules',
  'storybook-static',
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(ROOT, absolutePath);
    const parts = relativePath.split(path.sep);

    if (parts.some(part => IGNORE_PARTS.has(part))) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function countLines(contents) {
  if (contents.length === 0) {
    return 0;
  }

  return contents.split('\n').length;
}

const allFiles = [];

for (const sourceRoot of SOURCE_ROOTS) {
  try {
    allFiles.push(...await listFiles(path.join(ROOT, sourceRoot)));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

const oversized = [];

for (const filePath of allFiles) {
  const contents = await readFile(filePath, 'utf8');
  const lineCount = countLines(contents);

  if (lineCount > MAX_LINES) {
    oversized.push({
      lineCount,
      relativePath: path.relative(ROOT, filePath),
    });
  }
}

oversized.sort((a, b) => b.lineCount - a.lineCount);

if (oversized.length > 0) {
  console.error(`[check:source-size] ${oversized.length} files exceed ${MAX_LINES} lines:`);

  for (const entry of oversized.slice(0, 40)) {
    console.error(`  ${String(entry.lineCount).padStart(4, ' ')}  ${entry.relativePath}`);
  }

  if (oversized.length > 40) {
    console.error(`  ... ${oversized.length - 40} more`);
  }

  process.exit(1);
}

console.log(`[check:source-size] ${allFiles.length} files are <= ${MAX_LINES} lines.`);
