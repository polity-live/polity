import fs from 'node:fs';
import path from 'node:path';

import { buildTestCaseIndex, validateTestReference } from './accountability-scope.mjs';
import { listRepositoryFiles } from './coverage-scope.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(import.meta.dirname, 'coverage-manifest.json');
const debtPath = path.join(import.meta.dirname, 'coverage-debt-baseline.json');
const failures = [];
const repositoryFiles = listRepositoryFiles(root);
const testCases = buildTestCaseIndex(root, repositoryFiles);
failures.push(...testCases.failures);

if (!fs.existsSync(manifestPath)) failures.push('coverage-manifest.json is missing');
if (!fs.existsSync(debtPath)) failures.push('coverage-debt-baseline.json is missing');

const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { entries: [] };
const baseline = fs.existsSync(debtPath)
  ? JSON.parse(fs.readFileSync(debtPath, 'utf8'))
  : { legacyGaps: [] };

const paths = new Set();
for (const entry of manifest.entries ?? []) {
  if (paths.has(entry.path)) failures.push(`duplicate manifest entry: ${entry.path}`);
  paths.add(entry.path);
  if (!entry.domain) failures.push(`${entry.path}: missing domain`);
  if (!entry.owner) failures.push(`${entry.path}: missing owner`);
  if (!entry.kind) failures.push(`${entry.path}: missing kind`);
  if (!entry.verification) failures.push(`${entry.path}: missing verification`);
  if (!fs.existsSync(path.join(root, entry.path)))
    failures.push(`${entry.path}: source is missing`);
  if (!Array.isArray(entry.testRefs)) failures.push(`${entry.path}: testRefs must be an array`);
  for (const testRef of entry.testRefs ?? []) {
    for (const failure of validateTestReference(testRef, testCases.index)) {
      failures.push(`${entry.path}: ${failure}`);
    }
  }
  if (!Array.isArray(entry.suggestedTestRefs)) {
    failures.push(`${entry.path}: suggestedTestRefs must be an array`);
  }
  for (const suggestion of entry.suggestedTestRefs ?? []) {
    if (!fs.existsSync(path.join(root, suggestion))) {
      failures.push(`${entry.path}: missing suggested test ${suggestion}`);
    }
  }
  if (entry.coverageStatus === 'referenced' && (entry.testRefs ?? []).length === 0) {
    failures.push(`${entry.path}: referenced status has no exact test cases`);
  }
  if (entry.coverageStatus === 'legacy-reference' && (entry.suggestedTestRefs ?? []).length === 0) {
    failures.push(`${entry.path}: legacy-reference status has no suggestion`);
  }
  if (entry.coverageStatus === 'new-gap') failures.push(`${entry.path}: new accountability gap`);
}

const gaps = new Set(
  (manifest.entries ?? [])
    .filter(entry => entry.coverageStatus === 'legacy-gap')
    .map(entry => entry.path)
);
const allowedGaps = new Set(baseline.legacyGaps ?? []);

for (const gap of gaps) {
  if (!allowedGaps.has(gap)) failures.push(`${gap}: new unreferenced executable file`);
}
for (const gap of allowedGaps) {
  if (!gaps.has(gap)) failures.push(`${gap}: stale debt baseline entry; ratchet the baseline`);
}

if (failures.length) {
  console.error(`Coverage accountability failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const counts = Object.groupBy(manifest.entries, entry => entry.kind);
console.info(
  `Coverage accountability valid: ${manifest.entries.length} files, ${gaps.size} referenced-test legacy gaps.`
);
for (const [kind, entries] of Object.entries(counts)) console.info(`- ${kind}: ${entries.length}`);
