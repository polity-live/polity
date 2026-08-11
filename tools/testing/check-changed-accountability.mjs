import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function git(args) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function changedFiles() {
  const explicit = process.env.COVERAGE_BASE_REF;
  const baseBranch = process.env.GITHUB_BASE_REF;
  const range = explicit
    ? [`${explicit}...HEAD`]
    : baseBranch
      ? [`origin/${baseBranch}...HEAD`]
      : ['HEAD'];
  const tracked = git(['diff', '--name-only', '--diff-filter=ACMR', ...range])
    .split('\n')
    .filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked].map(file => file.replaceAll('\\', '/')))];
}

const changed = new Set(changedFiles());
const coverage = JSON.parse(
  fs.readFileSync(path.join(root, 'tools/testing/coverage-manifest.json'), 'utf8')
);
const ui = JSON.parse(
  fs.readFileSync(path.join(root, 'tools/testing/ui-action-catalog.json'), 'utf8')
);
const failures = [];
let executableFiles = 0;
let actions = 0;

for (const entry of coverage.entries ?? []) {
  if (!changed.has(entry.path) || entry.verification !== 'instrument') continue;
  executableFiles += 1;
  if (entry.coverageStatus !== 'referenced') {
    failures.push(
      `${entry.path}: changed executable source has ${entry.coverageStatus}, expected an exact test-case reference`
    );
  }
}

for (const entry of ui.entries ?? []) {
  if (!changed.has(entry.file)) continue;
  actions += 1;
  if (
    !['accounted', 'merged-alias', 'resolved-non-canonical'].includes(entry.accountabilityStatus)
  ) {
    failures.push(
      `${entry.key}: changed UI action has ${entry.accountabilityStatus}, expected complete scenario accountability`
    );
  }
}

if (failures.length) {
  console.error(`Changed accountability failed (${failures.length}):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  process.exit(1);
}

console.info(
  `Changed accountability valid: ${executableFiles} executable files and ${actions} UI actions.`
);
