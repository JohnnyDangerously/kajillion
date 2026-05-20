#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const COMMANDS = [
  ['npm', ['run', 'check:source-size']],
  ['npm', ['run', 'check:wgsl']],
  ['npm', ['run', 'typecheck']],
];

for (const [command, args] of COMMANDS) {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
