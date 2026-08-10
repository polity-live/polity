import fs from 'node:fs';
import path from 'node:path';

import { loadResolutionLedger } from './accountability-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const ledger = loadResolutionLedger(root);
const uiBaseline = new Set(read('tools/testing/ui-action-debt-baseline.json').legacyGaps ?? []);
const sourceBaseline = new Set(read('tools/testing/coverage-debt-baseline.json').legacyGaps ?? []);
const allowedResolutions = new Set([
  'tested',
  'explicit-ref',
  'alias-of-action',
  'reclassified',
  'removed-dead-code',
]);
const failures = [];

function validateSection(section, baseline, label) {
  for (const key of baseline) {
    const record = section[key];
    if (!record) failures.push(`${label} ${key}: missing resolution-ledger record`);
    else if (record.status !== 'pending') {
      failures.push(`${label} ${key}: resolved record is still present in debt baseline`);
    }
  }
  for (const [key, record] of Object.entries(section)) {
    if (record.status === 'pending') {
      if (!baseline.has(key)) failures.push(`${label} ${key}: orphan pending record`);
      continue;
    }
    if (record.status !== 'resolved') {
      failures.push(`${label} ${key}: invalid status ${record.status}`);
      continue;
    }
    if (baseline.has(key)) failures.push(`${label} ${key}: resolved debt remains in baseline`);
    if (!allowedResolutions.has(record.resolution)) {
      failures.push(`${label} ${key}: invalid resolution ${record.resolution}`);
    }
    if (!record.evidence) failures.push(`${label} ${key}: resolution has no evidence`);
  }
}

validateSection(ledger.uiActions ?? {}, uiBaseline, 'UI action');
validateSection(ledger.sourceReferences ?? {}, sourceBaseline, 'source reference');

if (failures.length) {
  console.error(`Resolution ledger validation failed (${failures.length}):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  process.exit(1);
}

const uiResolved = Object.values(ledger.uiActions).filter(
  record => record.status === 'resolved'
).length;
const sourceResolved = Object.values(ledger.sourceReferences).filter(
  record => record.status === 'resolved'
).length;
console.info(
  `Resolution ledger valid: ${uiBaseline.size} UI and ${sourceBaseline.size} source gaps pending; ${uiResolved} UI and ${sourceResolved} source gaps resolved.`
);
