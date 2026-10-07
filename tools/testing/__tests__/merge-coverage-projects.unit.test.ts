import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mergeCoverageProjects } from '../merge-coverage-projects.mjs';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-coverage-merge-'));
  temporaryDirectories.push(directory);
  const source = path.join(directory, 'source.ts');
  const location = { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } };
  const reports = [
    [1, 0],
    [0, 1],
    [0, 0],
  ].map((hits, index) => {
    const report = path.join(directory, `${index}.json`);
    fs.writeFileSync(
      report,
      JSON.stringify({
        [source]: {
          path: source,
          statementMap: { 0: location },
          fnMap: { 0: { name: 'choose', decl: location, loc: location, line: 1 } },
          branchMap: { 0: { type: 'if', line: 1, loc: location, locations: [location, location] } },
          s: { 0: hits[0] + hits[1] },
          f: { 0: hits[0] + hits[1] },
          b: { 0: hits },
        },
      })
    );
    return report;
  });
  return { directory, reports, source, output: path.join(directory, 'merged') };
}
describe('project coverage aggregation', () => {
  it('merges complementary real branch hits and keeps file summaries and counters', () => {
    const { reports, source, output } = fixture();
    const total = mergeCoverageProjects(reports, output);
    expect(total.branches).toMatchObject({ total: 2, covered: 2, pct: 100 });
    const merged = JSON.parse(fs.readFileSync(path.join(output, 'coverage-final.json'), 'utf8'));
    expect(merged[source].b[0]).toEqual([1, 1]);
    expect(merged[source].s[0]).toBe(2);
    const summary = JSON.parse(fs.readFileSync(path.join(output, 'coverage-summary.json'), 'utf8'));
    expect(summary[source].functions.pct).toBe(100);
    expect(summary.total).toEqual(total);
  });
  it('rejects incomplete, missing, malformed and empty project reports', () => {
    const { directory, reports, output } = fixture();
    expect(() => mergeCoverageProjects(reports.slice(0, 2), output)).toThrow('required');
    expect(() =>
      mergeCoverageProjects([...reports.slice(0, 2), path.join(directory, 'missing.json')], output)
    ).toThrow();
    fs.writeFileSync(reports[2], '{');
    expect(() => mergeCoverageProjects(reports, output)).toThrow();
    fs.writeFileSync(reports[2], '{}');
    expect(() => mergeCoverageProjects(reports, output)).toThrow('Empty coverage report');
    expect(fs.existsSync(output)).toBe(false);
  });
  it('writes aggregate reports when invoked from the CI command line', () => {
    const { reports, output } = fixture();
    execFileSync(
      process.execPath,
      ['tools/testing/merge-coverage-projects.mjs', output, ...reports],
      { windowsHide: true }
    );
    expect(
      JSON.parse(fs.readFileSync(path.join(output, 'coverage-summary.json'), 'utf8')).total.lines
        .pct
    ).toBe(100);
  });
  it('executes the CLI entry point with the same reports and supports embedding without a script argument', async () => {
    const { reports, output } = fixture();
    const previousArgv = process.argv;
    try {
      process.argv = [
        process.execPath,
        path.resolve('tools/testing/merge-coverage-projects.mjs'),
        output,
        ...reports,
      ];
      vi.resetModules();
      await import('../merge-coverage-projects.mjs');
      expect(
        JSON.parse(fs.readFileSync(path.join(output, 'coverage-summary.json'), 'utf8')).total
          .branches.pct
      ).toBe(100);
      process.argv = [process.execPath];
      vi.resetModules();
      expect((await import('../merge-coverage-projects.mjs')).mergeCoverageProjects).toBeTypeOf(
        'function'
      );
    } finally {
      process.argv = previousArgv;
    }
  });
});
