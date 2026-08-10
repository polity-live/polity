import fs from 'node:fs';
import path from 'node:path';

import {
  collectBranchAlternatives,
  flattenBranchDebts,
  isCriticalDomain,
  normalizeBranchResolutions,
  readJson,
} from './coverage-branch-accountability.mjs';

const root = process.cwd();
const files = {
  coverage: path.resolve(root, 'coverage/coverage-final.json'),
  debt: path.resolve(root, 'tools/testing/coverage-branch-debt.json'),
  exceptions: path.resolve(root, 'tools/testing/coverage-branch-exceptions.json'),
  manifest: path.resolve(root, 'tools/testing/coverage-manifest.json'),
  resolutions: path.resolve(root, 'tools/testing/coverage-branch-resolution-ledger.json'),
};
const failures = [];
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) failures.push(`missing ${name}: ${path.relative(root, file)}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const alternatives = collectBranchAlternatives({
  coverage: readJson(files.coverage),
  manifest: readJson(files.manifest),
  root,
});
const all = new Map(alternatives.map(entry => [entry.fingerprint, entry]));
const uncovered = new Map(
  alternatives.filter(entry => !entry.covered).map(entry => [entry.fingerprint, entry])
);
const debt = flattenBranchDebts(readJson(files.debt));
const debtIds = new Set(debt.map(entry => entry.fingerprint));
const resolutions = readJson(files.resolutions).resolutions ?? [];
const resolutionIds = new Set();
for (const resolution of resolutions) {
  if (resolutionIds.has(resolution.fingerprint)) {
    failures.push(`duplicate branch resolution ${resolution.fingerprint}`);
  }
  resolutionIds.add(resolution.fingerprint);
}
try {
  normalizeBranchResolutions(resolutions);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
const exceptions = readJson(files.exceptions).exceptions ?? [];
const exceptionIds = new Set();
const today = new Date().toISOString().slice(0, 10);

for (const exception of exceptions) {
  if (exceptionIds.has(exception.fingerprint)) {
    failures.push(`duplicate exception ${exception.fingerprint}`);
    continue;
  }
  exceptionIds.add(exception.fingerprint);
  const current = all.get(exception.fingerprint);
  if (!current)
    failures.push(`${exception.fingerprint}: exception does not identify a current branch`);
  else {
    if (current.file !== exception.file)
      failures.push(`${exception.fingerprint}: exception path mismatch`);
    if (current.covered)
      failures.push(`${exception.fingerprint}: covered branch has a stale exception`);
    if (isCriticalDomain(current.domain)) {
      failures.push(
        `${exception.fingerprint}: exceptions are forbidden in critical domain ${current.domain}`
      );
    }
  }
  if (!exception.owner?.trim()) failures.push(`${exception.fingerprint}: owner is required`);
  if (!exception.evidence?.trim()) failures.push(`${exception.fingerprint}: evidence is required`);
  if (!exception.issue?.trim()) failures.push(`${exception.fingerprint}: issue is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn ?? '')) {
    failures.push(`${exception.fingerprint}: expiresOn must be YYYY-MM-DD`);
  } else {
    const lifetime =
      (Date.parse(`${exception.expiresOn}T00:00:00Z`) - Date.now()) / (24 * 60 * 60 * 1000);
    if (exception.expiresOn < today) failures.push(`${exception.fingerprint}: exception expired`);
    if (lifetime > 30.5) failures.push(`${exception.fingerprint}: exception exceeds 30 days`);
  }
  if (!(exception.testRefs ?? []).length)
    failures.push(`${exception.fingerprint}: testRefs required`);
}

for (const [fingerprint, entry] of uncovered) {
  if (!debtIds.has(fingerprint) && !exceptionIds.has(fingerprint)) {
    failures.push(`${entry.file}:${entry.line}: new uncovered branch ${fingerprint}`);
  }
}
for (const entry of debt) {
  if (!uncovered.has(entry.fingerprint)) {
    failures.push(`${entry.fingerprint}: verified debt reduction awaits resolver`);
  }
}

if (failures.length) {
  console.error(`Branch coverage accountability failed (${failures.length}):`);
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  process.exit(1);
}

const covered = alternatives.filter(entry => entry.covered).length;
const accountableTotal = alternatives.length - exceptions.length;
const accountableCovered = covered;
const percentage = accountableTotal ? (accountableCovered / accountableTotal) * 100 : 100;
console.info(
  `Branch accountability valid: ${covered}/${alternatives.length} raw; ${debt.length} debt; ${exceptions.length} audited exceptions; ${percentage.toFixed(2)}% accountable.`
);
