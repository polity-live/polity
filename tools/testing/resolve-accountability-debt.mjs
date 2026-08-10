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
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const kind = args.get('--kind');
const key = args.get('--key');
const resolution = args.get('--resolution');
const evidenceNote = args.get('--evidence');
const allowed = new Set([
  'tested',
  'explicit-ref',
  'alias-of-action',
  'reclassified',
  'removed-dead-code',
]);

if (!['ui', 'source'].includes(kind) || !key || !allowed.has(resolution)) {
  console.error(
    'Usage: node tools/testing/resolve-accountability-debt.mjs --kind <ui|source> --key <key> --resolution <tested|explicit-ref|alias-of-action|reclassified|removed-dead-code> [--evidence <note>]'
  );
  process.exit(2);
}

const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const files = listRepositoryFiles(root);
const accountability = loadAccountabilityManifest(root);
const ledger = loadResolutionLedger(root);
let testCases;
const getTestCases = () => {
  testCases ??= buildTestCaseIndex(root, files);
  return testCases;
};
const baselineRelative =
  kind === 'ui'
    ? 'tools/testing/ui-action-debt-baseline.json'
    : 'tools/testing/coverage-debt-baseline.json';
const baseline = read(baselineRelative);
const section = kind === 'ui' ? ledger.uiActions : ledger.sourceReferences;
const record = section[key];
const failures = [];

if (!record || record.status !== 'pending') failures.push(`${key}: debt is not pending`);
if (!(baseline.legacyGaps ?? []).includes(key)) failures.push(`${key}: debt is not in baseline`);

let evidence;
if (kind === 'ui') {
  const catalog = read('tools/testing/ui-action-catalog.json');
  const entry = catalog.entries.find(candidate => candidate.debtKey === key);
  if (['tested', 'explicit-ref'].includes(resolution)) {
    if (!entry || entry.accountabilityStatus !== 'accounted') {
      failures.push(`${key}: UI action does not yet have complete exact accountability`);
    }
    for (const reference of entry?.testRefs ?? []) {
      failures.push(...validateTestReference(reference, getTestCases().index));
    }
    evidence = { actionKey: entry?.key, testRefs: entry?.testRefs ?? [] };
  } else if (resolution === 'alias-of-action') {
    if (!entry || entry.classification !== 'transparent-wrapper') {
      failures.push(`${key}: scanner does not classify the entry as a transparent wrapper`);
    }
    evidence = {
      scannerClassification: entry?.classification,
      aliasFingerprint: entry?.aliasOfLegacyFingerprint,
    };
  } else if (resolution === 'reclassified') {
    if (entry) failures.push(`${key}: UI entry is still classified as a user action`);
    if (!evidenceNote) failures.push(`${key}: reclassification requires --evidence`);
    evidence = { note: evidenceNote, previousSource: record?.source };
  } else if (resolution === 'removed-dead-code') {
    const file = record?.source?.file ?? key.split('#')[0];
    if (fs.existsSync(path.join(root, file))) failures.push(`${key}: source file still exists`);
    evidence = { removedFile: file };
  }
} else {
  const manifest = read('tools/testing/coverage-manifest.json');
  const entry = manifest.entries.find(candidate => candidate.path === key);
  if (['tested', 'explicit-ref'].includes(resolution)) {
    if (!entry || entry.coverageStatus !== 'referenced') {
      failures.push(`${key}: source does not yet have an explicit test reference`);
    }
    for (const reference of accountability.sourceReferences[key] ?? []) {
      failures.push(...validateTestReference(reference, getTestCases().index));
    }
    evidence = { testRefs: accountability.sourceReferences[key] ?? [] };
  } else if (resolution === 'reclassified') {
    if (!entry || entry.verification === 'instrument') {
      failures.push(`${key}: source is still classified as instrumented executable code`);
    }
    evidence = { kind: entry?.kind, verification: entry?.verification };
  } else if (resolution === 'removed-dead-code') {
    if (fs.existsSync(path.join(root, key))) failures.push(`${key}: source file still exists`);
    evidence = { removedFile: key };
  } else {
    failures.push(`${key}: alias-of-action is not valid for source references`);
  }
}

if (failures.length) {
  console.error(`Debt resolution rejected (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

section[key] = {
  ...record,
  status: 'resolved',
  resolution,
  evidence,
};
baseline.legacyGaps = baseline.legacyGaps.filter(candidate => candidate !== key);
fs.writeFileSync(path.join(root, baselineRelative), serializeJson(baseline));
fs.writeFileSync(
  path.join(root, 'tools/testing/debt-resolution-ledger.json'),
  serializeJson(ledger)
);
console.info(`${kind} debt resolved: ${key} -> ${resolution}`);
