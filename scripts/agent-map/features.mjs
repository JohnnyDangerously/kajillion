import fs from 'node:fs'
import path from 'node:path'

import { listFiles, toRelative } from './files.mjs'

export function listFeatureContracts() {
  return listFiles()
    .filter((filePath) => filePath.endsWith('feature.agent.json'))
    .map((filePath) => {
      const raw = fs.readFileSync(filePath, 'utf8')
      let parsed = {}
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = { parseError: true }
      }
      return {
        path: toRelative(filePath),
        feature: parsed.feature ?? parsed.name ?? path.basename(path.dirname(filePath)),
        purpose: parsed.purpose ?? parsed.description ?? '',
        ownedFiles: parsed.owned_files ?? parsed.owners ?? [],
        publicEntrypoints: parsed.public_entrypoints ?? parsed.entrypoints ?? [],
        verify: parsed.verify ?? []
      }
    })
}
