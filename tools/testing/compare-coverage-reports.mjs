import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  collectBranchAlternatives,
  normalizeCoveragePath,
} from './coverage-branch-accountability.mjs';

function metric(values) {
  return {
    covered: values.filter(value => value > 0).length,
    total: values.length,
  };
}

export function summarizeFileCoverage(fileCoverage) {
  const lineHits = new Map();
  for (const [statementId, hits] of Object.entries(fileCoverage.s ?? {})) {
    const line = fileCoverage.statementMap?.[statementId]?.start?.line;
    if (!line) continue;
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
  }

  return {
    lines: metric([...lineHits.values()]),
    statements: metric(Object.values(fileCoverage.s ?? {})),
    functions: metric(Object.values(fileCoverage.f ?? {})),
    branches: metric(Object.values(fileCoverage.b ?? {}).flat()),
  };
}

function summarizeReport(report, root) {
  return new Map(
    Object.entries(report).map(([file, fileCoverage]) => [
      normalizeCoveragePath(root, file),
      summarizeFileCoverage(fileCoverage),
    ])
  );
}

function compareSummaries(baseline, candidate) {
  const failures = [];
  const files = new Set([...baseline.keys(), ...candidate.keys()]);
  for (const file of [...files].sort()) {
    const expected = baseline.get(file);
    const actual = candidate.get(file);
    if (!expected || !actual) {
      failures.push(`${file}: ${expected ? 'missing from candidate' : 'unexpected in candidate'}`);
      continue;
    }
    for (const name of ['lines', 'statements', 'functions', 'branches']) {
      if (
        expected[name].covered !== actual[name].covered ||
        expected[name].total !== actual[name].total
      ) {
        failures.push(
          `${file}: ${name} expected ${expected[name].covered}/${expected[name].total}, ` +
            `received ${actual[name].covered}/${actual[name].total}`
        );
      }
    }
  }
  return failures;
}

function fingerprintState(report, manifest, root) {
  return new Map(
    collectBranchAlternatives({ coverage: report, manifest, root }).map(branch => [
      branch.fingerprint,
      `${branch.file}:${branch.covered ? 'covered' : 'uncovered'}`,
    ])
  );
}

function compareFingerprints(baseline, candidate) {
  const failures = [];
  const fingerprints = new Set([...baseline.keys(), ...candidate.keys()]);
  for (const fingerprint of fingerprints) {
    const expected = baseline.get(fingerprint);
    const actual = candidate.get(fingerprint);
    if (expected !== actual) {
      failures.push(
        `${fingerprint}: expected ${expected ?? 'absent'}, received ${actual ?? 'absent'}`
      );
    }
  }
  return failures;
}

export function compareCoverageReports({ baseline, candidate, manifest, root = process.cwd() }) {
  return [
    ...compareSummaries(summarizeReport(baseline, root), summarizeReport(candidate, root)),
    ...compareFingerprints(
      fingerprintState(baseline, manifest, root),
      fingerprintState(candidate, manifest, root)
    ),
  ];
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baselinePath = option('--baseline');
  const candidatePath = option('--candidate');
  const manifestPath = option('--manifest') ?? 'tools/testing/coverage-manifest.json';
  if (!baselinePath || !candidatePath) {
    console.error(
      'Usage: node tools/testing/compare-coverage-reports.mjs --baseline <coverage-final.json> ' +
        '--candidate <coverage-final.json> [--manifest <coverage-manifest.json>]'
    );
    process.exit(1);
  }

  const failures = compareCoverageReports({
    baseline: readJson(baselinePath),
    candidate: readJson(candidatePath),
    manifest: readJson(manifestPath),
  });
  if (failures.length) {
    console.error(
      `Coverage shard parity failed (${failures.length}):\n${failures
        .slice(0, 200)
        .map(failure => `- ${failure}`)
        .join('\n')}`
    );
    if (failures.length > 200) console.error(`... ${failures.length - 200} more`);
    process.exit(1);
  }
  console.info('Coverage shard parity passed: per-file metrics and branch fingerprints match.');
}
