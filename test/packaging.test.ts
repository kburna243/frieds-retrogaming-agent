/**
 * M2: the installed command. A global npm install starts `fagent` through a symlink, so the CLI has to recognize
 * itself behind one; and `fagent --version` must say the version package.json says.
 */

import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { harnessVersion, isEntryPoint, main } from '../src/cli.ts';

describe('packaging (M2)', () => {
  it('recognizes itself when started through a symlink, as npm installs it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fagent-bin-'));
    try {
      const real = join(directory, 'cli.js');
      const link = join(directory, 'fagent');
      writeFileSync(real, '');
      const url = pathToFileURL(real).href;
      expect(isEntryPoint(real, url)).toBe(true);
      try {
        symlinkSync(real, link);
        expect(isEntryPoint(link, url)).toBe(true);
      } catch (error) {
        // Windows without symlink rights (a CI runner): npm uses a .cmd shim there, which starts the real path.
        if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      }
      expect(isEntryPoint(join(directory, 'other.js'), url)).toBe(false);
      expect(isEntryPoint(undefined, url)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('--version and `version` print the package version and need no kit root', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(harnessVersion()).toBe(pkg.version);
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => (written.push(String(chunk)), true)) as typeof process.stdout.write;
    try {
      expect(await main(['--version'])).toBe(0);
      expect(await main(['version'])).toBe(0);
    } finally {
      process.stdout.write = original;
    }
    expect(written).toEqual([`fagent ${pkg.version}\n`, `fagent ${pkg.version}\n`]);
  });

  it('the bin entry is the warning-filtering launcher, and dist carries the schema', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      bin: Record<string, string>;
      files: string[];
      scripts: Record<string, string>;
    };
    expect(pkg.bin).toEqual({ fagent: 'dist/bin.js' });
    expect(pkg.files).toContain('dist');
    expect(pkg.scripts.prepare).toBe('npm run build');
    expect(readFileSync(new URL('../tools/copy-assets.mjs', import.meta.url), 'utf8')).toContain("'db/schema.sql'");
  });
});
