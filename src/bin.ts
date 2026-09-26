#!/usr/bin/env node
/**
 * The installed `fagent` command (package.json `bin`).
 *
 * It only does two things before handing over to `cli.ts`: it drops the one experimental warning `node:sqlite`
 * prints on every start — noise for a cabinet owner, and nothing they can act on — and it keeps every other warning
 * exactly as Node would print it. The CLI is loaded afterwards, so the listener is in place before SQLite loads.
 */

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite/i.test(warning.message)) return;
  process.stderr.write(`(node) ${warning.name}: ${warning.message}\n`);
});

const { main } = await import('./cli.ts');
process.exitCode = await main();
