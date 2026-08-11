import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildTestCaseIndex,
  loadAccountabilityManifest,
  scenariosCovered,
  validateTestReference,
} from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'ui-action-catalog.json'), 'utf8')
);
const baseline = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'ui-action-debt-baseline.json'), 'utf8')
);
const accountability = loadAccountabilityManifest(root);
const failures = [];
const keys = new Set();
const debtKeys = new Set();
const testCases = buildTestCaseIndex(root, listRepositoryFiles(root));
failures.push(...testCases.failures);
const accountedCanonicalKeys = new Set(
  (catalog.entries ?? [])
    .filter(
      entry =>
        entry.classification === 'canonical-action' && entry.accountabilityStatus === 'accounted'
    )
    .map(entry => entry.key)
);
const usedDeclarationKeys = new Set();

for (const entry of catalog.entries ?? []) {
  if (entry.classification === 'canonical-action') {
    if (keys.has(entry.key)) failures.push(`duplicate canonical action key: ${entry.key}`);
    keys.add(entry.key);
  }
  if (debtKeys.has(entry.debtKey)) failures.push(`duplicate action debt key: ${entry.debtKey}`);
  debtKeys.add(entry.debtKey);
  if (!fs.existsSync(path.join(root, entry.file)))
    failures.push(`missing action source: ${entry.file}`);
  if (!entry.roles?.length) failures.push(`${entry.key}: no roles`);
  if (!entry.scenarios?.length) failures.push(`${entry.key}: no applicable scenarios`);
  if (!Array.isArray(entry.testRefs)) failures.push(`${entry.key}: testRefs must be an array`);
  if (entry.identifierSource === 'manifest-declaration') {
    if (!entry.declarationKey) failures.push(`${entry.key}: manifest declaration key is missing`);
    else usedDeclarationKeys.add(entry.declarationKey);
  }
  for (const testRef of entry.testRefs ?? []) {
    for (const failure of validateTestReference(testRef, testCases.index)) {
      failures.push(`${entry.key}: ${failure}`);
    }
  }
  for (const suggestion of entry.suggestedTestRefs ?? []) {
    if (!fs.existsSync(path.join(root, suggestion))) {
      failures.push(`${entry.key}: missing suggested test ${suggestion}`);
    }
  }
  if (entry.accountabilityStatus === 'accounted') {
    if (!entry.actionId) failures.push(`${entry.key}: accounted action has no stable actionId`);
    if (entry.classification !== 'canonical-action') {
      failures.push(`${entry.key}: only canonical actions can be accounted`);
    }
    if (!scenariosCovered(entry.scenarios ?? [], entry.testRefs ?? [])) {
      failures.push(`${entry.key}: exact test cases do not cover every applicable scenario`);
    }
    if (entry.accessibilityIssues?.length) {
      failures.push(`${entry.key}: ${entry.accessibilityIssues.join(', ')}`);
    }
  }
  if (entry.accountabilityStatus === 'merged-alias') {
    if (entry.classification !== 'transparent-wrapper') {
      failures.push(`${entry.key}: only transparent wrappers can be merged aliases`);
    }
    if (!entry.actionId) failures.push(`${entry.key}: merged alias has no stable actionId`);
    if (!accountedCanonicalKeys.has(entry.key)) {
      failures.push(`${entry.key}: merged alias has no accounted canonical action`);
    }
  }
  if (entry.accountabilityStatus === 'resolved-non-canonical') {
    if (entry.resolution?.status !== 'resolved') {
      failures.push(`${entry.key}: resolved status has no ledger evidence`);
    }
    if (
      entry.resolution?.resolution === 'alias-of-action' &&
      entry.classification !== 'transparent-wrapper'
    ) {
      failures.push(`${entry.key}: alias resolution is not a transparent wrapper`);
    }
  }
  if (entry.accountabilityStatus === 'new-gap') failures.push(`${entry.key}: new UI action debt`);
}

for (const [declarationKey, declaration] of Object.entries(
  accountability.actionDeclarations ?? {}
)) {
  const actionId = typeof declaration === 'string' ? declaration : declaration?.actionId;
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+){3,}$/.test(actionId ?? '')) {
    failures.push(`${declarationKey}: declared actionId must use domain.surface.verb.variant format`);
  }
  if (!usedDeclarationKeys.has(declarationKey)) {
    failures.push(`${declarationKey}: stale action declaration`);
  }
}

const gaps = new Set(
  catalog.entries
    .filter(entry => entry.accountabilityStatus === 'legacy-gap')
    .map(entry => entry.debtKey)
);
const allowed = new Set(baseline.legacyGaps ?? []);
for (const gap of gaps) if (!allowed.has(gap)) failures.push(`${gap}: new UI action debt`);
for (const gap of allowed) if (!gaps.has(gap)) failures.push(`${gap}: stale UI debt baseline`);

const baseBranch = process.env.GITHUB_BASE_REF;
const base = process.env.COVERAGE_BASE_REF ?? (baseBranch ? `origin/${baseBranch}` : undefined);
if (base) {
  try {
    const previous = JSON.parse(
      execFileSync('git', ['show', `${base}:tools/testing/ui-action-debt-baseline.json`], {
        encoding: 'utf8',
      })
    ).legacyGaps;
    const previousSet = new Set(previous);
    for (const gap of allowed) if (!previousSet.has(gap)) failures.push(`${gap}: UI debt addition`);
  } catch {
    console.info('UI action debt bootstrap accepted; the base has no baseline.');
  }
}

if (failures.length) {
  console.error(`UI action accountability failed (${failures.length}):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  process.exit(1);
}
console.info(`UI action accountability valid: ${keys.size} actions, ${gaps.size} legacy gaps.`);
