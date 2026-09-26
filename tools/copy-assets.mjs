#!/usr/bin/env node
// tsc only copies what it compiles. The SQLite schema is read at runtime, so it has to travel to dist/ by hand.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assets = ['db/schema.sql'];
for (const asset of assets) {
  const from = join('src', asset);
  const to = join('dist', asset);
  mkdirSync(join(to, '..'), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${asset}`);
}

// Fail if a future asset exists in src but is not listed above.
const known = new Set(assets);
const extras = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (!/\.(ts|tsx)$/.test(entry.name) && !known.has(path.slice('src/'.length).split('\\').join('/'))) extras.push(path);
  }
};
walk('src');
if (extras.length > 0) {
  console.error(`non-TypeScript files in src/ that are not copied to dist/: ${extras.join(', ')} — add them to this script`);
  process.exit(1);
}
