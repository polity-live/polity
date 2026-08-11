import fs from 'node:fs';
import path from 'node:path';

import {
  emptyResolutionLedger,
  loadResolutionLedger,
  serializeJson,
} from './accountability-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const ledger = loadResolutionLedger(root) ?? emptyResolutionLedger();
const uiBaseline = read('tools/testing/ui-action-debt-baseline.json');
const sourceBaseline = read('tools/testing/coverage-debt-baseline.json');
const uiCatalog = read('tools/testing/ui-action-catalog.json');
const coverageManifest = read('tools/testing/coverage-manifest.json');
const uiEntries = new Map(uiCatalog.entries.map(entry => [entry.debtKey ?? entry.key, entry]));
const sourceEntries = new Map(coverageManifest.entries.map(entry => [entry.path, entry]));

for (const key of uiBaseline.legacyGaps ?? []) {
  if (ledger.uiActions[key]) continue;
  const entry = uiEntries.get(key);
  ledger.uiActions[key] = {
    status: 'pending',
    introducedBy: 'ui-action-debt-baseline-v1',
    source: entry
      ? {
          file: entry.file,
          tag: entry.tag,
          line: entry.line,
          identifierSource: entry.identifierSource,
        }
      : { file: key.split('#')[0] },
  };
}

for (const key of sourceBaseline.legacyGaps ?? []) {
  if (ledger.sourceReferences[key]) continue;
  const entry = sourceEntries.get(key);
  ledger.sourceReferences[key] = {
    status: 'pending',
    introducedBy: 'coverage-debt-baseline-v1',
    source: entry
      ? {
          path: entry.path,
          domain: entry.domain,
          kind: entry.kind,
          verification: entry.verification,
        }
      : { path: key },
  };
}

fs.writeFileSync(
  path.join(root, 'tools/testing/debt-resolution-ledger.json'),
  serializeJson(ledger)
);
console.info(
  `Resolution ledger bootstrapped: ${Object.keys(ledger.uiActions).length} UI actions, ${Object.keys(ledger.sourceReferences).length} source references.`
);
