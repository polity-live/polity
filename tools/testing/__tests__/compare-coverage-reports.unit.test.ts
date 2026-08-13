import { describe, expect, it } from 'vitest';

import { compareCoverageReports, summarizeFileCoverage } from '../compare-coverage-reports.mjs';

const root = process.cwd();
const source = `${root}/src/example.ts`;
const fileCoverage = {
  path: source,
  statementMap: {
    0: { start: { line: 1, column: 0 }, end: { line: 1, column: 4 } },
    1: { start: { line: 1, column: 5 }, end: { line: 1, column: 9 } },
  },
  fnMap: { 0: { name: 'example', decl: {}, loc: {}, line: 1 } },
  branchMap: {
    0: {
      type: 'if',
      line: 1,
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 9 } },
      locations: [
        { start: { line: 1, column: 0 }, end: { line: 1, column: 4 } },
        { start: { line: 1, column: 5 }, end: { line: 1, column: 9 } },
      ],
    },
  },
  s: { 0: 1, 1: 0 },
  f: { 0: 1 },
  b: { 0: [1, 0] },
};
const manifest = {
  entries: [{ path: 'src/example.ts', kind: 'production-code', domain: 'example', owner: 'test' }],
};

describe('coverage shard parity', () => {
  it('uses the highest statement hit count for line coverage', () => {
    expect(summarizeFileCoverage(fileCoverage)).toEqual({
      lines: { covered: 1, total: 1 },
      statements: { covered: 1, total: 2 },
      functions: { covered: 1, total: 1 },
      branches: { covered: 1, total: 2 },
    });
  });

  it('accepts an identical merged report', () => {
    expect(
      compareCoverageReports({
        baseline: { [source]: fileCoverage },
        candidate: { [source]: structuredClone(fileCoverage) },
        manifest,
        root,
      })
    ).toEqual([]);
  });

  it('rejects per-file metric or branch-state drift', () => {
    const candidate = structuredClone(fileCoverage);
    candidate.b[0][1] = 1;
    expect(
      compareCoverageReports({
        baseline: { [source]: fileCoverage },
        candidate: { [source]: candidate },
        manifest,
        root,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('branches expected 1/2, received 2/2'),
        expect.stringContaining('uncovered'),
      ])
    );
  });
});
