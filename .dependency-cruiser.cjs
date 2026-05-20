/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-unresolved-imports',
      severity: 'error',
      from: { path: '^(src|demo/src|benchmarks/src|scripts)' },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-packages',
      severity: 'error',
      from: { path: '^(src|demo/src|benchmarks/src|scripts)' },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'runtime-src-not-to-dev-deps',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/stories/', '[.]d[.]ts$'],
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: ['^node_modules/@types/'],
      },
    },
    {
      name: 'runtime-src-not-to-demo-or-tools',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/stories/'],
      },
      to: { path: '^(demo|benchmarks|scripts|src/stories)/' },
    },
    {
      name: 'no-dist-imports',
      severity: 'error',
      from: { path: '^(src|demo/src|benchmarks/src|scripts)' },
      to: { path: '^dist/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: { path: '^(src|demo/src|benchmarks/src|scripts)' },
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$',
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:vite|eslint|storybook)[.]config[.](?:js|cjs|mjs|ts)$',
          '^scripts/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts', '.json'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      archi: {
        collapsePattern: '^(src|demo/src|benchmarks/src|scripts)/[^/]+',
      },
      dot: {
        collapsePattern: '^(src|demo/src|benchmarks/src|scripts)/[^/]+',
      },
      text: { highlightFocused: true },
    },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
