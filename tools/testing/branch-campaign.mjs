import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ACCOUNTABLE_KINDS,
  collectBranchAlternatives,
  normalizeCoveragePath,
} from './coverage-branch-accountability.mjs';

export const CAMPAIGN_AGENT_IDS = Array.from(
  { length: 10 },
  (_, index) => `A${String(index + 1).padStart(2, '0')}`
);

const AGENT_CONTEXT = {
  A01: 'Shared Plate plugins: suggestion, AI, slash and browser interaction states.',
  A02: 'Shared Plate plugins: discussions, comments, tables and navigation debt.',
  A03: 'Editor hooks plus Zero document, group and agenda actions.',
  A04: 'Editor logic/UI, amendments, documents, docs, timeline and small Zero domains.',
  A05: 'Messages UI, Zero messages and Search UI.',
  A06: 'Messages and Search hooks, controllers and logic.',
  A07: 'Users, public surfaces, preferences, roles and i18n.',
  A08: 'Authentication, payments, notifications, events and calendar.',
  A09: 'Todos, PQL, file upload, create, groups, network and discussions.',
  A10: 'Blogs, statements, remaining decision domains, routes and server.',
};

const TEST_PREFIXES = {
  A01: ['src/features/shared/ui/ui-platejs/'],
  A02: ['src/features/shared/', 'src/features/navigation/'],
  A03: [
    'src/features/editor/hooks/',
    'src/zero/documents/',
    'src/zero/groups/',
    'src/zero/agendas/',
  ],
  A04: [
    'src/features/editor/',
    'src/features/amendments/',
    'src/features/documents/',
    'src/features/docs/',
    'src/features/timeline/',
    'src/zero/amendments/',
    'src/zero/appearance-themes/',
    'src/zero/calendar-subscriptions/',
  ],
  A05: ['src/features/messages/ui/', 'src/features/search/ui/', 'src/zero/messages/'],
  A06: ['src/features/messages/', 'src/features/search/'],
  A07: [
    'src/features/users/',
    'src/features/public-landing/',
    'src/features/public-pages/',
    'src/features/app-tutorial/',
    'src/features/roles/',
    'src/i18n/',
    'src/zero/users/',
    'src/zero/preferences/',
  ],
  A08: [
    'src/features/auth/',
    'src/features/payments/',
    'src/features/notifications/',
    'src/features/events/',
    'src/features/calendar/',
    'src/zero/payments/',
    'src/zero/notifications/',
  ],
  A09: [
    'src/features/todos/',
    'src/features/pql/',
    'src/features/file-upload/',
    'src/features/create/',
    'src/features/groups/',
    'src/features/network/',
    'src/features/discussions/',
    'src/zero/todos/',
    'src/zero/pql/',
  ],
  A10: [
    'src/features/blogs/',
    'src/features/statements/',
    'src/features/agendas/',
    'src/features/decision-terminal/',
    'src/features/charts/',
    'src/features/change-requests/',
    'src/features/meet/',
    'src/zero/blogs/',
    'src/zero/statements/',
    'src/zero/votes/',
    'src/zero/elections/',
    'src/zero/accreditation/',
    'src/zero/delegates/',
    'src/routes/',
    'src/server/',
  ],
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHash(root, file) {
  return sha256(fs.readFileSync(path.resolve(root, file)));
}

function metric(total, uncovered) {
  return { total, uncovered };
}

function fileCoverageDebt({ coverageFile, fileCoverage, branches, root }) {
  const file = normalizeCoveragePath(root, coverageFile);
  const statements = Object.values(fileCoverage.s ?? {});
  const functions = Object.values(fileCoverage.f ?? {});
  const lineHits = new Map();
  for (const [statementId, hits] of Object.entries(fileCoverage.s ?? {})) {
    const line = fileCoverage.statementMap?.[statementId]?.start?.line;
    if (line) lineHits.set(line, (lineHits.get(line) ?? 0) + hits);
  }
  const lines = [...lineHits.values()];
  const branchAlternatives = branches.get(file) ?? [];
  return {
    path: file,
    sourceSha256: sourceHash(root, file),
    metrics: {
      branches: metric(
        branchAlternatives.length,
        branchAlternatives.filter(entry => !entry.covered).length
      ),
      lines: metric(lines.length, lines.filter(hits => hits === 0).length),
      statements: metric(statements.length, statements.filter(hits => hits === 0).length),
      functions: metric(functions.length, functions.filter(hits => hits === 0).length),
    },
    branchFingerprints: branchAlternatives
      .filter(entry => !entry.covered)
      .map(entry => ({
        fingerprint: entry.fingerprint,
        type: entry.type,
        line: entry.line,
        column: entry.column,
        index: entry.index,
      })),
  };
}

function uncoveredScore(file) {
  return Object.values(file.metrics).reduce((sum, entry) => sum + entry.uncovered, 0);
}

function startsWithAny(file, prefixes) {
  return prefixes.some(prefix => file.startsWith(prefix));
}

export function fixedAgentForFile(file) {
  if (file.startsWith('src/features/navigation/')) return 'A02';
  if (file.startsWith('src/features/editor/hooks/')) return 'A03';
  if (startsWithAny(file, ['src/zero/documents/', 'src/zero/groups/', 'src/zero/agendas/']))
    return 'A03';
  if (
    startsWithAny(file, [
      'src/features/editor/',
      'src/features/amendments/',
      'src/features/documents/',
      'src/features/docs/',
      'src/features/timeline/',
      'src/zero/amendments/',
      'src/zero/appearance-themes/',
      'src/zero/calendar-subscriptions/',
    ])
  )
    return 'A04';
  if (
    startsWithAny(file, [
      'src/features/messages/ui/',
      'src/features/search/ui/',
      'src/zero/messages/',
    ])
  )
    return 'A05';
  if (startsWithAny(file, ['src/features/messages/', 'src/features/search/'])) return 'A06';
  if (startsWithAny(file, TEST_PREFIXES.A07)) return 'A07';
  if (startsWithAny(file, TEST_PREFIXES.A08)) return 'A08';
  if (startsWithAny(file, TEST_PREFIXES.A09)) return 'A09';
  if (startsWithAny(file, TEST_PREFIXES.A10)) return 'A10';
  return undefined;
}

export function assignSharedFiles(files) {
  const buckets = {
    A01: { branchDebt: 0, score: 0, files: [] },
    A02: { branchDebt: 0, score: 0, files: [] },
  };
  const branchFiles = files
    .filter(file => file.metrics.branches.uncovered > 0)
    .sort(
      (left, right) =>
        right.metrics.branches.uncovered - left.metrics.branches.uncovered ||
        left.path.localeCompare(right.path)
    );
  for (const file of branchFiles) {
    const owner = buckets.A01.branchDebt <= buckets.A02.branchDebt ? 'A01' : 'A02';
    buckets[owner].files.push(file);
    buckets[owner].branchDebt += file.metrics.branches.uncovered;
    buckets[owner].score += uncoveredScore(file);
  }
  const branchless = files
    .filter(file => file.metrics.branches.uncovered === 0)
    .sort(
      (left, right) =>
        uncoveredScore(right) - uncoveredScore(left) || left.path.localeCompare(right.path)
    );
  for (const file of branchless) {
    const owner = buckets.A01.score <= buckets.A02.score ? 'A01' : 'A02';
    buckets[owner].files.push(file);
    buckets[owner].score += uncoveredScore(file);
  }
  return new Map(
    Object.entries(buckets).flatMap(([owner, bucket]) =>
      bucket.files.map(file => [file.path, owner])
    )
  );
}

export function buildCampaignAssignments({
  coverage,
  manifest,
  root = process.cwd(),
  coverageSha256 = sha256(JSON.stringify(coverage)),
}) {
  const accountable = new Map(
    manifest.entries
      .filter(entry => ACCOUNTABLE_KINDS.has(entry.kind))
      .map(entry => [entry.path, entry])
  );
  const alternatives = collectBranchAlternatives({ coverage, manifest, root });
  const branches = new Map();
  for (const alternative of alternatives) {
    const entries = branches.get(alternative.file) ?? [];
    entries.push(alternative);
    branches.set(alternative.file, entries);
  }
  const debtFiles = Object.entries(coverage)
    .map(([coverageFile, fileCoverage]) => {
      const file = normalizeCoveragePath(root, coverageFile);
      if (!accountable.has(file)) return undefined;
      return fileCoverageDebt({ coverageFile, fileCoverage, branches, root });
    })
    .filter(Boolean)
    .filter(file => uncoveredScore(file) > 0)
    .sort((left, right) => left.path.localeCompare(right.path));

  const sharedFiles = debtFiles.filter(file => file.path.startsWith('src/features/shared/'));
  const sharedAssignments = assignSharedFiles(sharedFiles);
  const assignments = Object.fromEntries(CAMPAIGN_AGENT_IDS.map(id => [id, []]));
  const unmatched = [];
  for (const file of debtFiles) {
    const owner = sharedAssignments.get(file.path) ?? fixedAgentForFile(file.path);
    if (!owner) unmatched.push(file.path);
    else assignments[owner].push(file);
  }
  if (unmatched.length) {
    throw new Error(`Unassigned coverage debt files:\n${unmatched.join('\n')}`);
  }

  const agents = CAMPAIGN_AGENT_IDS.map(id => {
    const ownedFiles = assignments[id].sort((left, right) => left.path.localeCompare(right.path));
    const totals = { branches: 0, lines: 0, statements: 0, functions: 0 };
    for (const file of ownedFiles) {
      for (const name of Object.keys(totals)) totals[name] += file.metrics[name].uncovered;
    }
    const allowedExistingTests = [
      ...new Set(
        ownedFiles.flatMap(file => {
          const entry = accountable.get(file.path);
          return [...(entry?.testRefs ?? []), ...(entry?.suggestedTestRefs ?? [])];
        })
      ),
    ].sort();
    return {
      id,
      context: AGENT_CONTEXT[id],
      allowedTestPrefixes: TEST_PREFIXES[id],
      allowedExistingTests,
      totals,
      branchFiles: ownedFiles.filter(file => file.metrics.branches.uncovered > 0).length,
      ownedFiles,
    };
  });
  const sourceSnapshotSha256 = sha256(
    agents
      .flatMap(agent => agent.ownedFiles.map(file => `${file.path}\0${file.sourceSha256}`))
      .sort()
      .join('\n')
  );
  const totals = agents.reduce(
    (result, agent) => {
      for (const name of Object.keys(result)) result[name] += agent.totals[name];
      return result;
    },
    { branches: 0, lines: 0, statements: 0, functions: 0 }
  );

  return {
    version: 1,
    baseline: {
      coverageSha256,
      sourceSnapshotSha256,
      accountableAlternatives: alternatives.length,
      debtFiles: debtFiles.length,
      totals,
    },
    policy: {
      maxBranchesPerBatch: 150,
      maxFocusedCoverageWorkers: 1,
      maxConcurrentLocalCoverageRuns: 3,
      artifactEnvironmentVariable: 'BRANCH_CAMPAIGN_ARTIFACT_DIR',
      targetPercent: { branches: 100, lines: 100, statements: 100, functions: 100 },
    },
    agents,
  };
}

export function serializeCampaign(assignments) {
  return `${JSON.stringify(assignments, null, 2)}\n`;
}
