import fs from 'node:fs';
import path from 'node:path';

import {
  buildTestCaseIndex,
  loadAccountabilityManifest,
  loadResolutionLedger,
  serializeJson,
  validateTestReference,
} from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const accountability = loadAccountabilityManifest(root);
const ledger = loadResolutionLedger(root);
const baseline = read('tools/testing/coverage-debt-baseline.json');
const manifest = read('tools/testing/coverage-manifest.json');
const entries = new Map(manifest.entries.map(entry => [entry.path, entry]));
const testCases = buildTestCaseIndex(root, listRepositoryFiles(root));
const failures = [...testCases.failures];
const resolvable = [];

for (const key of baseline.legacyGaps ?? []) {
  const references = accountability.sourceReferences[key] ?? [];
  if (!references.length) continue;
  const entry = entries.get(key);
  if (entry?.coverageStatus !== 'referenced') {
    failures.push(
      `${key}: manifest has ${entry?.coverageStatus ?? 'no entry'}, expected referenced`
    );
    continue;
  }
  for (const reference of references) {
    for (const failure of validateTestReference(reference, testCases.index)) {
      failures.push(`${key}: ${failure}`);
    }
  }
  resolvable.push({ key, references });
}

if (failures.length) {
  console.error(`Bulk source resolution rejected (${failures.length}):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  process.exit(1);
}

const resolvedKeys = new Set(resolvable.map(item => item.key));
for (const { key, references } of resolvable) {
  const record = ledger.sourceReferences[key];
  if (!record || record.status !== 'pending') {
    console.error(`${key}: missing pending ledger record`);
    process.exit(1);
  }
  ledger.sourceReferences[key] = {
    ...record,
    status: 'resolved',
    resolution: 'explicit-ref',
    evidence: { testRefs: references },
  };
}
baseline.legacyGaps = baseline.legacyGaps.filter(key => !resolvedKeys.has(key));
fs.writeFileSync(
  path.join(root, 'tools/testing/coverage-debt-baseline.json'),
  serializeJson(baseline)
);
fs.writeFileSync(
  path.join(root, 'tools/testing/debt-resolution-ledger.json'),
  serializeJson(ledger)
);
console.info(`Resolved ${resolvable.length} adopted source references.`);
