#!/usr/bin/env node
// Finalizes the catalog snapshot: contract/catalog-v1.json.
// Called by tools/Update-ContractSnapshot.ps1; keeps the formatting deterministic (2 spaces, LF, no BOM).
// Usage: node tools/write-catalog-snapshot.mjs <operations.json> <out.json> <apiVersion> <commit> <kitVersion> <branch> <fetched>
import { readFileSync, writeFileSync } from 'node:fs';

const [raw, out, apiVersion, commit, kitVersion, branch, fetched] = process.argv.slice(2);
if (!raw || !out) {
  console.error('usage: write-catalog-snapshot.mjs <operations.json> <out.json> [apiVersion commit kitVersion branch fetched]');
  process.exit(2);
}

const operations = JSON.parse(readFileSync(raw, 'utf8'));
const list = Array.isArray(operations) ? operations : [operations];

const document = {
  ApiVersion: apiVersion ?? '1.0',
  Source: {
    repository: 'frieds-retrogaming-kit',
    url: 'https://github.com/kburna243/frieds-retrogaming-kit',
    branch: branch ?? 'origin/main',
    commit: commit ?? 'unknown',
    kitVersion: kitVersion ?? 'unknown',
    fetched: fetched ?? new Date().toISOString().slice(0, 10),
  },
  Note: 'Snapshot of the shape of Get-KitOperation (API.md). Development and test fixture only: at run time the harness always reads the live catalog from the kit, never this file.',
  Operations: list.map((o) => ({
    Name: o.Name,
    Kind: o.Kind,
    Suite: o.Suite ?? '',
    Interactive: Boolean(o.Interactive),
    Available: o.Available !== false && !o.Interactive,
    Description: o.Description ?? '',
    Parameters: (o.Parameters ?? []).map((p) => ({
      Name: p.Name,
      Type: p.Type,
      Mandatory: Boolean(p.Mandatory),
    })),
  })),
};

// Stable order by name so a refresh only shows real changes.
document.Operations.sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));

writeFileSync(out, JSON.stringify(document, null, 2) + '\n', 'utf8');
console.log(`wrote ${out}: ${document.Operations.length} operations`);
