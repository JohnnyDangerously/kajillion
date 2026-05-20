import {
  createRepoMap,
  printFind,
  printOwners,
  printRange,
  printSymbols
} from './commands.mjs'

function usage(exitCode = 0) {
  console.log(`Usage:
  npm run agent:map
  npm run agent:symbols -- <file>
  npm run agent:range -- <file> <startLine> <endLine>
  npm run agent:owners -- [query]
  npm run agent:find -- <query>

Examples:
  npm run agent:symbols -- src/modules/Points/index.ts
  npm run agent:range -- src/modules/Points/index.ts 900 1120
  npm run agent:owners -- visible-culling
  npm run agent:find -- prepareGpu`)
  process.exit(exitCode)
}

export function main() {
  const [command, ...args] = process.argv.slice(2)
  try {
    if (!command || command === 'help' || command === '--help') usage(0)
    if (command === 'map') return createRepoMap()
    if (command === 'symbols') return printSymbols(args[0], usage)
    if (command === 'range') return printRange(args[0], args[1], args[2], usage)
    if (command === 'owners') return printOwners(args.join(' '))
    if (command === 'find') return printFind(args.join(' '), usage)
    usage(1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
