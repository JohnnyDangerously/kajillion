#!/usr/bin/env node

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WgslReflect } from '../node_modules/wgsl_reflect/wgsl_reflect.module.js';

const ROOT = process.cwd();

const GENERATED_SHADER_SPECS = [
  ['src/modules/ForceLink/force-spring.wgsl.ts', 'forceSpringWgsl', [256]],
  ['src/modules/ForceLink/force-spring.compute.wgsl.ts', 'forceSpringComputeWgsl', [256]],
  ['src/modules/ForceManyBody/force-many-body.compute.wgsl.ts', 'forceManyBodyComputeWgsl', [64]],
  ['src/modules/Points/update-position.compute.wgsl.ts', 'updatePositionComputeWgsl', []],
  ['src/modules/Points/sync-position-storage.compute.wgsl.ts', 'syncPositionStorageWgsl', []],
  ['src/modules/Points/drag-point.compute.wgsl.ts', 'dragPointComputeWgsl', []],
  ['src/modules/Points/cull-visible-points.compute.wgsl.ts', 'cullVisiblePointsComputeWgsl', []],
  ['src/modules/Points/prefix-visible-points.compute.wgsl.ts', 'prefixVisiblePointsComputeWgsl', []],
  [
    'src/modules/Points/clear-visible-point-tile-budget.compute.wgsl.ts',
    'clearVisiblePointTileBudgetComputeWgsl',
    [],
  ],
  ['src/modules/Points/shaders/draw-points.wgsl.ts', 'drawPointsWgsl', []],
  ['src/modules/Points/draw-culled-points.wgsl.ts', 'drawCulledPointsWgsl', []],
  ['src/modules/Points/bin-tile-impostors.compute.wgsl.ts', 'binTileImpostorsComputeWgsl', []],
  ['src/modules/Points/clear-tile-impostors.compute.wgsl.ts', 'clearTileImpostorsComputeWgsl', []],
  ['src/modules/Points/resolve-tile-impostors.compute.wgsl.ts', 'resolveTileImpostorsComputeWgsl', []],
  ['src/modules/Points/clear-hybrid-anchors.compute.wgsl.ts', 'clearHybridAnchorsComputeWgsl', []],
  ['src/modules/Points/fill-hybrid-anchors.compute.wgsl.ts', 'fillHybridAnchorsComputeWgsl', []],
  [
    'src/modules/Points/materialize-hybrid-anchors.compute.wgsl.ts',
    'materializeHybridAnchorsComputeWgsl',
    [],
  ],
  ['src/modules/Lines/draw-curve-line.wgsl.ts', 'drawCurveLineWgslSource', []],
  ['src/modules/Lines/draw-curve-line-instanced.wgsl.ts', 'drawCurveLineInstancedWgslSource', []],
  ['src/modules/Lines/draw-straight-line.wgsl.ts', 'drawStraightLineWgslSource', []],
  ['src/modules/Lines/draw-culled-curve-lines.wgsl.ts', 'drawCulledCurveLinesWgsl', []],
  ['src/modules/Lines/cull-visible-lines.compute.wgsl.ts', 'cullVisibleLinesComputeWgsl', []],
  ['src/modules/Lines/clear-visible-lines.compute.wgsl.ts', 'clearVisibleLinesComputeWgsl', []],
  ['src/modules/Lines/precompute-line-instances.compute.wgsl.ts', 'precomputeLineInstancesWgsl', []],
];

async function listWgslFiles(directory) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listWgslFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.wgsl')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function validateWgsl(name, source) {
  try {
    new WgslReflect(source);
    return null;
  } catch (error) {
    return {
      message: error?.message ?? String(error),
      name,
    };
  }
}

async function loadGeneratedShaders() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'kajillion-wgsl-check-'));
  const entryPath = path.join(tempDirectory, 'generated-shaders.mjs');
  const outPath = path.join(tempDirectory, 'generated-shaders.bundle.mjs');

  try {
    const imports = GENERATED_SHADER_SPECS.map(([filePath], index) => {
      return `import * as shader${index} from ${JSON.stringify(path.join(ROOT, filePath))};`;
    }).join('\n');

    const entries = GENERATED_SHADER_SPECS.map(([filePath, exportName, args], index) => {
      const argsJson = JSON.stringify(args);
      const entryName = JSON.stringify(`${filePath}:${exportName}`);
      const exportNameJson = JSON.stringify(exportName);

      return [
        `const value${index} = shader${index}[${exportNameJson}];`,
        `entries.push({`,
        `  name: ${entryName},`,
        `  source: typeof value${index} === 'function' ? value${index}(...${argsJson}) : value${index},`,
        `});`,
      ].join('\n');
    }).join('\n');

    await writeFile(
      entryPath,
      [
        imports,
        'const entries = [];',
        entries,
        'export default entries;',
      ].join('\n'),
    );

    await build({
      bundle: true,
      entryPoints: [entryPath],
      format: 'esm',
      logLevel: 'silent',
      outfile: outPath,
      platform: 'node',
    });

    const module = await import(pathToFileURL(outPath).href);
    return module.default;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

const failures = [];
const rawFiles = await listWgslFiles(path.join(ROOT, 'src'));

for (const filePath of rawFiles) {
  const source = await readFile(filePath, 'utf8');
  const failure = validateWgsl(path.relative(ROOT, filePath), source);

  if (failure !== null) {
    failures.push(failure);
  }
}

const generatedShaders = await loadGeneratedShaders();

for (const shader of generatedShaders) {
  if (typeof shader.source !== 'string') {
    failures.push({
      message: `expected string source, got ${typeof shader.source}`,
      name: shader.name,
    });
    continue;
  }

  const failure = validateWgsl(shader.name, shader.source);

  if (failure !== null) {
    failures.push(failure);
  }
}

if (failures.length > 0) {
  console.error(`[check:wgsl] ${failures.length} shader validation failures:`);

  for (const failure of failures) {
    console.error(`\n${failure.name}\n  ${failure.message}`);
  }

  process.exit(1);
}

console.log(
  `[check:wgsl] parsed ${rawFiles.length} raw WGSL files and ${generatedShaders.length} generated shader entrypoints.`,
);
