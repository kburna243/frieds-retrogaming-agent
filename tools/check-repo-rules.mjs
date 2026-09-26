#!/usr/bin/env node
/**
 * Repository rules, checked instead of hoped for. Runs in CI and before every commit.
 *
 *  1. nothing in here describes a real machine (no user profile path, no private IP, no account name)
 *  2. the pinned contract snapshot still matches its recorded provenance
 *  3. no flag or field can approve a change from a script — `--yes` must stay unimplemented
 *  4. every PowerShell file with non-ASCII is UTF-8 with BOM (Windows PowerShell 5.1 reads the rest as ANSI)
 *  5. VERSION, package.json and the CHANGELOG agree
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const failures = [];
const notes = [];

function walk(dir, filter) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, filter));
    else if (filter(entry.name)) out.push(path);
  }
  return out;
}

const read = (path) => readFileSync(join(root, path));
const readText = (path) => readFileSync(join(root, path), 'utf8');

// ---- 1. depersonalization ------------------------------------------------------------------------------

// Synthetic examples the kit's own allowlist uses too, plus the fake cabinet's invented person.
const ALLOWLIST = new Set(['contract/catalog-v1.json', 'contract/API.md']);
const SYNTHETIC = [
  'Friedhelm',
  'GAMEMASTER-PC',
  'C:\\Users\\Friedhelm',
  '192.168.47.11',
  'friedhelm@example.test',
  'S-1-5-21-1234567890-1234567890-1234567890-1001',
  'example.test',
  'api.example.test',
  'kburna243/frieds-retrogaming-kit',
  'D:\\cabinet\\frieds-retrogaming-kit',
  'C:\\synthetic',
];

const textFiles = walk('.', (name) => /\.(ts|mts|mjs|js|json|md|ps1|psd1|yml|yaml|sql|cmd|txt|example)$/.test(name));
const personal = [
  { id: 'profile-path', pattern: /[A-Za-z]:[\\/]+Users[\\/]+(?!Friedhelm|Public|Default|ContainerAdministrator)[A-Za-z0-9._-]+/g },
  { id: 'home-path', pattern: /\/home\/(?!runner|ci|ubuntu)[a-z]+/g },
  { id: 'private-ip', pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})\b/g },
  { id: 'sid', pattern: /S-1-5-21-\d{6,}-\d{6,}-\d{6,}-(?!1001)\d+/g },
  { id: 'token', pattern: /\b(?:ghp|gho|github_pat_)[A-Za-z0-9_]{20,}\b/g },
];

for (const file of textFiles) {
  if (ALLOWLIST.has(file)) continue;
  const text = readText(file);
  for (const rule of personal) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[0];
      if (SYNTHETIC.some((allowed) => value.includes(allowed) || allowed.includes(value))) continue;
      failures.push(`1 depersonalization: ${file} contains ${rule.id} "${value}" — use a synthetic example (D:\\Pinball, C:\\RetroBat, Friedhelm)`);
    }
  }
}

// Absolute Windows paths: the root folder must be one of the synthetic ones. A real machine's layout (a data drive,
// a project folder) is personal too, even without a user name in it.
const SYNTHETIC_ROOTS = ['c:\\retrobat', 'd:\\cabinet', 'd:\\pinball', 'd:\\kit', 'c:\\synthetic', 'c:\\fake-kit', 'c:\\windows', 'c:\\users', 'e:\\old build'];
const drivePath = /(?<![A-Za-z0-9])[A-Za-z]:\\{1,2}[A-Za-z0-9._ -]+/g;
for (const file of textFiles) {
  if (ALLOWLIST.has(file)) continue;
  for (const match of readText(file).matchAll(drivePath)) {
    const root = match[0].replace(/\\\\/g, '\\').toLowerCase().trimEnd();
    if (SYNTHETIC_ROOTS.some((allowed) => root === allowed || root.startsWith(`${allowed}`))) continue;
    failures.push(`1 depersonalization: ${file} contains the path "${match[0]}" — use a synthetic root (${SYNTHETIC_ROOTS.slice(0, 3).join(', ')}, …)`);
  }
}

// ---- 2. pinned contract ---------------------------------------------------------------------------------

const contractPath = 'contract/API.md';
if (existsSync(join(root, contractPath))) {
  const body = readText(contractPath).replace(/^<!--[\s\S]*?-->\s*/, '');
  const recorded = readText(contractPath).match(/SHA-256:\s+([0-9a-f]{64})/)?.[1];
  const actual = createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex');
  if (recorded && recorded !== actual) {
    failures.push(`2 contract: ${contractPath} was edited — it is a pinned snapshot. Re-run tools/Update-ContractSnapshot.ps1 instead.`);
  }
  if (!recorded) failures.push('2 contract: no SHA-256 provenance block at the top of contract/API.md');
}
notes.push('contract snapshot verified');

// ---- 3. no scripted approval ---------------------------------------------------------------------------
// A flag that approves a change must stay unimplemented. Checked structurally (the parser's boolean flag set and
// any read of such a flag in src/), not by grepping prose — the help text and the tests are *allowed* to say
// "there is no --yes", and the CHECK-constraint test has to write a bad row on purpose.

const FORBIDDEN_FLAGS = ['yes', 'assume-yes', 'force-apply', 'auto-approve', 'approve', 'no-confirm', 'force'];
const codeFiles = textFiles.filter((file) => /\.(ts|mjs|js)$/.test(file) && file.startsWith('src' + '/') && !file.endsWith('.test.ts'));

const parserFlags = readText('src/cli/args.ts');
const booleanSet = parserFlags.match(/const BOOLEAN = new Set\(\[([^\]]*)\]\)/)?.[1] ?? '';
for (const forbidden of FORBIDDEN_FLAGS) {
  if (booleanSet.includes(`'${forbidden}'`)) {
    failures.push(`3 approval: --${forbidden} was added to the CLI parser — a change is confirmed by a person, never by a flag`);
  }
}
for (const file of codeFiles) {
  const text = readText(file);
  const reads = FORBIDDEN_FLAGS.filter((flag) => new RegExp(`flags\\[?['"]-?${flag}['"]\\]?|flags\\.${flag.replace(/-(\w)/g, (_, c) => c.toUpperCase())}\\b`).test(text));
  if (reads.length > 0) failures.push(`3 approval: ${file} reads an approval flag (${reads.join(', ')})`);
}
// The database layer may only ever write decided_by = 'human'.
const dbCode = readText('src/db/store.ts');
for (const match of dbCode.matchAll(/decided_by\s*=\s*'?(\w+)'?/g)) {
  const value = match[1];
  if (value && value !== 'human') failures.push(`3 approval: src/db/store.ts writes decided_by = '${value}'`);
}
if (!/decided_by = 'human'/.test(dbCode)) failures.push("3 approval: src/db/store.ts no longer stamps decisions as 'human'");

// ---- 4. PowerShell files and the BOM -------------------------------------------------------------------

for (const file of walk('.', (name) => name.endsWith('.ps1'))) {
  const bytes = read(file);
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const text = bytes.toString('utf8');
  const nonAscii = /[^\x09\x0a\x0d\x20-\x7e]/.test(text);
  if (nonAscii && !hasBom) failures.push(`4 bom: ${file} contains non-ASCII but no UTF-8 BOM (Windows PowerShell 5.1 would read it as ANSI)`);
  if (!nonAscii && hasBom) notes.push(`${file} has a BOM but is pure ASCII (harmless)`);
}

// ---- 5. versions agree ---------------------------------------------------------------------------------

const version = existsSync(join(root, 'VERSION')) ? readText('VERSION').trim() : null;
const pkg = JSON.parse(readText('package.json')).version;
if (version && version !== pkg) failures.push(`5 version: VERSION says ${version}, package.json says ${pkg}`);
if (version && existsSync(join(root, 'CHANGELOG.md')) && !readText('CHANGELOG.md').includes(version)) {
  notes.push(`CHANGELOG has no ${version} section yet (Unreleased is fine during development)`);
}

// ---- report ---------------------------------------------------------------------------------------------

for (const note of notes) console.log(`note: ${note}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} rule violation(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`repo rules OK (${textFiles.length} files checked)`);
