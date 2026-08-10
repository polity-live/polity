import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const coveragePath = path.resolve('coverage/coverage-final.json');
const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;
if (!fs.existsSync(coveragePath)) {
  console.error('Missing coverage/coverage-final.json. Run npm run test:coverage first.');
  process.exit(1);
}

function git(args) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    encoding: 'utf8',
    maxBuffer: GIT_OUTPUT_MAX_BUFFER,
  }).trim();
}

function diffArguments() {
  const explicit = process.env.COVERAGE_BASE_REF;
  if (explicit) return [`${explicit}...HEAD`];
  const baseBranch = process.env.GITHUB_BASE_REF;
  if (baseBranch) return [`origin/${baseBranch}...HEAD`];
  return ['HEAD'];
}

const diff = git([
  'diff',
  '--unified=0',
  '--no-color',
  ...diffArguments(),
  '--',
  '*.ts',
  '*.tsx',
  '*.js',
  '*.mjs',
]);
const changed = new Map();
let currentFile;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6).replaceAll('\\', '/');
    continue;
  }
  const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
  if (!match || !currentFile) continue;
  const start = Number(match[1]);
  const count = match[2] === undefined ? 1 : Number(match[2]);
  const lines = changed.get(currentFile) ?? new Set();
  for (let index = 0; index < count; index += 1) lines.add(start + index);
  changed.set(currentFile, lines);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const accountability = JSON.parse(
  fs.readFileSync(path.resolve('tools/testing/coverage-manifest.json'), 'utf8')
);
const accountableKinds = new Map(accountability.entries.map(entry => [entry.path, entry.kind]));
const untracked = git(['ls-files', '--others', '--exclude-standard'])
  .split('\n')
  .filter(file => /\.(?:ts|tsx|js|mjs)$/.test(file));
for (const relative of untracked) {
  const source = fs.readFileSync(path.resolve(relative), 'utf8');
  changed.set(relative, new Set(source.split(/\r?\n/).map((_line, index) => index + 1)));
}

const failures = [];
let executableChangedLines = 0;
let changedStatements = 0;
let changedFunctions = 0;
let changedBranches = 0;
let coveredChangedBranches = 0;
const uncoveredBranchLocations = [];
function startsOnChangedLine(location, lines) {
  return Boolean(location?.start && lines.has(location.start.line));
}
for (const [relative, lines] of changed) {
  if (!['production-code', 'operational-code'].includes(accountableKinds.get(relative))) continue;
  const absolute = path.resolve(relative);
  const fileCoverage = coverage[absolute] ?? coverage[absolute.replaceAll('\\', '/')];
  if (!fileCoverage) {
    failures.push(`${relative} (missing from instrumented coverage)`);
    continue;
  }
  const lineHits = new Map();
  for (const [statementId, location] of Object.entries(fileCoverage.statementMap)) {
    const hits = fileCoverage.s[statementId];
    for (let line = location.start.line; line <= location.end.line; line += 1) {
      lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
    }
    if (startsOnChangedLine(location, lines)) {
      changedStatements += 1;
      if (hits === 0)
        failures.push(`${relative}:${location.start.line} (changed statement not executed)`);
    }
  }
  for (const line of lines) {
    if (!lineHits.has(line)) continue;
    executableChangedLines += 1;
    if (lineHits.get(line) === 0) failures.push(`${relative}:${line}`);
  }

  for (const [functionId, functionEntry] of Object.entries(fileCoverage.fnMap)) {
    if (!lines.has(functionEntry.decl.start.line) && !lines.has(functionEntry.loc.start.line))
      continue;
    changedFunctions += 1;
    if (fileCoverage.f[functionId] === 0) {
      failures.push(`${relative}:${functionEntry.decl.start.line} (changed function not executed)`);
    }
  }

  for (const [branchId, branchEntry] of Object.entries(fileCoverage.branchMap)) {
    if (
      !startsOnChangedLine(branchEntry.loc, lines) &&
      !(branchEntry.locations ?? []).some(location => startsOnChangedLine(location, lines))
    )
      continue;
    const hits = fileCoverage.b[branchId];
    changedBranches += hits.length;
    coveredChangedBranches += hits.filter(hit => hit > 0).length;
    hits.forEach((hit, index) => {
      if (hit === 0)
        uncoveredBranchLocations.push(
          `${relative}:${branchEntry.loc.start.line} (branch ${index + 1})`
        );
    });
  }
}

const branchPercentage = changedBranches ? (coveredChangedBranches / changedBranches) * 100 : 100;
if (uncoveredBranchLocations.length) {
  failures.push(
    `changed branches: ${coveredChangedBranches}/${changedBranches} (${branchPercentage.toFixed(2)}% < 100%)`
  );
  failures.push(...uncoveredBranchLocations);
}

if (failures.length) {
  console.error(`Changed executable lines without coverage (${failures.length}):`);
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  process.exit(1);
}
console.info(
  `Changed-code coverage valid: ${executableChangedLines} lines, ${changedStatements} statements, ${changedFunctions} functions, ${branchPercentage.toFixed(2)}% branches.`
);
