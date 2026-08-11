import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ACCOUNTABLE_KINDS = new Set(['production-code', 'operational-code']);
export const CRITICAL_DOMAIN_PREFIXES = [
  'features:agendas',
  'features:amendments',
  'features:auth',
  'features:decision-terminal',
  'features:events',
  'features:groups',
  'features:network',
  'server:',
  'zero:',
];

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function normalizeCoveragePath(root, file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function sourceSlice(source, location) {
  if (!location?.start || !location?.end) return '';
  const lines = source.split(/\r?\n/);
  const startLine = Math.max(0, location.start.line - 1);
  const endLine = Math.max(startLine, location.end.line - 1);
  if (startLine === endLine) {
    return (lines[startLine] ?? '').slice(location.start.column, location.end.column).trim();
  }
  return [
    (lines[startLine] ?? '').slice(location.start.column),
    ...lines.slice(startLine + 1, endLine),
    (lines[endLine] ?? '').slice(0, location.end.column),
  ]
    .join('\n')
    .trim();
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function collectBranchAlternatives({ coverage, manifest, root = process.cwd() }) {
  const entries = new Map(manifest.entries.map(entry => [entry.path, entry]));
  const alternatives = [];
  const signatureOccurrences = new Map();

  for (const [coverageFile, fileCoverage] of Object.entries(coverage)) {
    const file = normalizeCoveragePath(root, coverageFile);
    const manifestEntry = entries.get(file);
    if (!manifestEntry || !ACCOUNTABLE_KINDS.has(manifestEntry.kind)) continue;
    const absolute = path.resolve(root, file);
    const source = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';

    for (const [branchId, branch] of Object.entries(fileCoverage.branchMap ?? {})) {
      const hits = fileCoverage.b?.[branchId] ?? [];
      const branchText = sourceSlice(source, branch.loc);
      hits.forEach((hit, index) => {
        const alternativeLocation = branch.locations?.[index] ?? branch.loc;
        const alternativeText = sourceSlice(source, alternativeLocation);
        const signature = [file, branch.type, branchText, index, alternativeText].join('\0');
        const occurrence = signatureOccurrences.get(signature) ?? 0;
        signatureOccurrences.set(signature, occurrence + 1);
        alternatives.push({
          fingerprint: `br_${hash(`${signature}\0${occurrence}`)}`,
          file,
          domain: manifestEntry.domain,
          owner: manifestEntry.owner,
          type: branch.type ?? 'unknown',
          line: alternativeLocation?.start?.line ?? branch.loc?.start?.line ?? 0,
          column: alternativeLocation?.start?.column ?? branch.loc?.start?.column ?? 0,
          index,
          covered: hit > 0,
          hits: hit,
          testRefs: manifestEntry.testRefs ?? [],
        });
      });
    }
  }

  return alternatives.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.index - right.index
  );
}

export function buildBranchDebtInventory(alternatives, exceptions = []) {
  const exceptionIds = new Set(exceptions.map(entry => entry.fingerprint));
  const debts = alternatives
    .filter(entry => !entry.covered && !exceptionIds.has(entry.fingerprint))
    .map(({ covered: _covered, hits: _hits, ...entry }) => entry);
  const byType = {};
  const byDomain = {};
  const files = new Map();
  for (const debt of debts) {
    byType[debt.type] = (byType[debt.type] ?? 0) + 1;
    byDomain[debt.domain] = (byDomain[debt.domain] ?? 0) + 1;
    const file = files.get(debt.file) ?? {
      file: debt.file,
      domain: debt.domain,
      owner: debt.owner,
      testRefs: debt.testRefs,
      branches: [],
    };
    file.branches.push({
      fingerprint: debt.fingerprint,
      type: debt.type,
      line: debt.line,
      column: debt.column,
      index: debt.index,
    });
    files.set(debt.file, file);
  }
  return {
    version: 1,
    baseline: {
      totalAlternatives: alternatives.length,
      coveredAlternatives: alternatives.filter(entry => entry.covered).length,
      uncoveredAlternatives: debts.length,
      exceptionAlternatives: exceptions.length,
    },
    byType: Object.fromEntries(Object.entries(byType).sort()),
    byDomain: Object.fromEntries(Object.entries(byDomain).sort()),
    files: [...files.values()],
  };
}

export function flattenBranchDebts(inventory) {
  return (inventory.files ?? []).flatMap(file =>
    (file.branches ?? []).map(branch => ({
      ...branch,
      file: file.file,
      domain: file.domain,
      owner: file.owner,
      testRefs: file.testRefs ?? [],
    }))
  );
}

export function diffBranchDebt({ alternatives, previousDebts, exceptions = [] }) {
  const previousIds = new Set(previousDebts.map(entry => entry.fingerprint));
  const exceptionIds = new Set(exceptions.map(entry => entry.fingerprint));
  const uncovered = alternatives.filter(entry => !entry.covered);
  const uncoveredIds = new Set(uncovered.map(entry => entry.fingerprint));

  return {
    newUncovered: uncovered.filter(
      entry => !previousIds.has(entry.fingerprint) && !exceptionIds.has(entry.fingerprint)
    ),
    resolved: previousDebts.filter(entry => !uncoveredIds.has(entry.fingerprint)),
  };
}

export function normalizeBranchResolutions(resolutions = []) {
  const unique = new Map();
  for (const resolution of resolutions) {
    const existing = unique.get(resolution.fingerprint);
    if (!existing) {
      unique.set(resolution.fingerprint, resolution);
      continue;
    }
    if (JSON.stringify(existing) !== JSON.stringify(resolution)) {
      throw new Error(`conflicting branch resolutions for ${resolution.fingerprint}`);
    }
  }
  return [...unique.values()].sort((left, right) =>
    left.fingerprint.localeCompare(right.fingerprint)
  );
}

export function isCriticalDomain(domain) {
  return CRITICAL_DOMAIN_PREFIXES.some(prefix => domain.startsWith(prefix));
}
