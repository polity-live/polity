import fs from 'node:fs';
import path from 'node:path';

import {
  buildTestCaseIndex,
  loadResolutionLedger,
  serializeJson,
  validateTestReference,
} from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const sourcePrefix = args.get('--source-prefix');
const limit = Number(args.get('--limit') ?? 100);
if (!sourcePrefix || !Number.isInteger(limit) || limit < 1 || limit > 100) {
  console.error(
    'Usage: node tools/testing/resolve-accountability-domain.mjs --source-prefix <path> [--limit <1..100>]'
  );
  process.exit(2);
}

const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const baseline = read('tools/testing/ui-action-debt-baseline.json');
const ledger = loadResolutionLedger(root);
const candidates = (baseline.legacyGaps ?? [])
  .filter(key => ledger.uiActions[key]?.status === 'pending')
  .filter(key =>
    (ledger.uiActions[key]?.source?.file ?? key.split('#')[0]).startsWith(sourcePrefix)
  )
  .slice(0, limit);

if (!candidates.length) {
  console.info(`No pending UI debt under ${sourcePrefix}.`);
  process.exit(0);
}

const catalog = read('tools/testing/ui-action-catalog.json');
const testCases = buildTestCaseIndex(root, listRepositoryFiles(root));
const failures = [...testCases.failures];
const byDebtKey = new Map((catalog.entries ?? []).map(entry => [entry.debtKey, entry]));
const resolutions = [];
for (const key of candidates) {
  const record = ledger.uiActions[key];
  const entry = byDebtKey.get(key);
  if (!entry) {
    failures.push(`${key}: scanner entry is absent; use the evidence-bearing single resolver`);
    continue;
  }
  if (entry.classification === 'canonical-action') {
    if (entry.accountabilityStatus !== 'accounted') {
      failures.push(`${key}: canonical action has ${entry.accountabilityStatus}`);
      continue;
    }
    if (entry.accessibilityIssues?.length) {
      failures.push(`${key}: ${entry.accessibilityIssues.join(', ')}`);
      continue;
    }
    for (const reference of entry.testRefs ?? []) {
      failures.push(...validateTestReference(reference, testCases.index));
    }
    resolutions.push({
      key,
      record,
      resolution: 'tested',
      evidence: { actionKey: entry.key, testRefs: entry.testRefs ?? [] },
    });
  } else if (entry.classification === 'transparent-wrapper') {
    resolutions.push({
      key,
      record,
      resolution: 'alias-of-action',
      evidence: {
        scannerClassification: entry.classification,
        aliasFingerprint: entry.aliasOfLegacyFingerprint,
      },
    });
  } else {
    failures.push(`${key}: unsupported scanner classification ${entry.classification}`);
  }
}

if (failures.length) {
  console.error(`Domain debt resolution rejected (${failures.length}):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  process.exit(1);
}

const resolvedKeys = new Set();
for (const item of resolutions) {
  ledger.uiActions[item.key] = {
    ...item.record,
    status: 'resolved',
    resolution: item.resolution,
    evidence: item.evidence,
  };
  resolvedKeys.add(item.key);
}
baseline.legacyGaps = baseline.legacyGaps.filter(key => !resolvedKeys.has(key));
fs.writeFileSync(
  path.join(root, 'tools/testing/ui-action-debt-baseline.json'),
  serializeJson(baseline)
);
fs.writeFileSync(
  path.join(root, 'tools/testing/debt-resolution-ledger.json'),
  serializeJson(ledger)
);
console.info(
  `Resolved ${resolutions.length} UI debts under ${sourcePrefix}; ${baseline.legacyGaps.length} remain.`
);
