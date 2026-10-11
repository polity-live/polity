import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { CI_TEST_FLAGS, selectCITests } from '../ci-test-selection.mjs';

describe('CI test selection', () => {
  it('applies flags to every workflow job and keeps manual runs defaulting to all', () => {
    const workflow = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
    expect(workflow.on.workflow_dispatch.inputs.tests.default).toBe('all');
    for (const [id, job] of Object.entries(workflow.jobs) as [string, any][]) {
      if (id === 'test-selection') continue;
      expect(job.needs).toContain('test-selection');
      expect(job.if).toMatch(
        /fromJSON\(needs\.test-selection\.outputs\.enabled \|\| '\{\}'\)\.([a-z0-9]+) == true/
      );
      const flag = job.if.match(/\)\.([a-z0-9]+) == true/)[1];
      expect(CI_TEST_FLAGS).toContain(flag);
      if (id.startsWith('zero-')) expect(flag).toBe('performance');
      else expect(flag).not.toBe('performance');
    }
  });
  it('runs every test by default', () => {
    expect(selectCITests()).toEqual(Object.fromEntries(CI_TEST_FLAGS.map(name => [name, true])));
    expect(selectCITests('all')).toEqual(selectCITests());
  });
  it('runs only the performance gate when selected', () => {
    expect(Object.entries(selectCITests('performance')).filter(([, enabled]) => enabled)).toEqual([
      ['performance', true],
    ]);
  });
  it('supports individual flags and retains coverage artifact dependencies', () => {
    const flags = selectCITests(' unit, coverage ');
    expect(flags).toMatchObject({
      unit: true,
      coverage: true,
      browser: true,
      database: true,
      performance: false,
      e2e: false,
    });
  });
  it('rejects typos and empty selections instead of silently skipping checks', () => {
    for (const selection of ['', ' ', 'all,unit', 'performance,unknown', 'unit,', false])
      expect(() => selectCITests(selection as string)).toThrow();
  });
});
