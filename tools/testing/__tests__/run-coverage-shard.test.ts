import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COVERAGE_SHARD_USAGE,
  buildVitestShardArguments,
  parseCoverageShardOptions,
  runCoverageShard,
} from '../run-coverage-shard.mjs';

const roots: string[] = [];

function createRunnerRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-coverage-shard-test-'));
  const cli = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, '');
  roots.push(root);
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('coverage shard runner contracts', () => {
  it('accepts direct named and equals-style options', () => {
    expect(
      parseCoverageShardOptions({
        argv: ['--shard=2/4', '--max-workers', '3', '--reports-directory=reports/two'],
        env: {},
      })
    ).toMatchObject({ shard: '2/4', index: 2, count: 4, maxWorkers: '3' });
  });

  it('accepts npm 11 stripped options as positional values', () => {
    const result = parseCoverageShardOptions({
      argv: ['3/4', '2', 'reports/three'],
      env: {},
    });
    expect(result).toMatchObject({ shard: '3/4', index: 3, count: 4, maxWorkers: '2' });
    expect(result.reportsDirectory).toBe(path.resolve('reports/three'));
  });

  it('accepts environment values and defaults reports to an isolated shard directory', () => {
    const result = parseCoverageShardOptions({
      argv: [],
      env: { COVERAGE_SHARD: '1/4', COVERAGE_SHARD_ARTIFACT_DIR: 'artifacts' },
      tempDirectory: 'unused',
    });
    expect(result.maxWorkers).toBe('2');
    expect(result.reportsDirectory).toBe(path.resolve('artifacts/1-of-4'));
  });

  it('supports a package-friendly positional help command', () => {
    expect(parseCoverageShardOptions({ argv: ['help'], env: {} })).toEqual({ help: true });
    expect(COVERAGE_SHARD_USAGE).toContain('npm run test:coverage:shard');
  });

  it.each([
    [[], 'required'],
    [['0/4'], 'Invalid Vitest shard'],
    [['5/4'], 'Invalid Vitest shard'],
    [['1/4', '0'], 'worker count'],
    [['--unknown'], 'Unknown option'],
    [['--shard'], 'Missing value'],
    [['1/4', '2', 'reports', 'extra'], 'Unexpected positional'],
  ])('rejects invalid arguments %j', (argv, message) => {
    expect(() => parseCoverageShardOptions({ argv, env: {} })).toThrow(message);
  });

  it('builds the exact three-project Vitest coverage command', () => {
    expect(
      buildVitestShardArguments({
        shard: '4/4',
        maxWorkers: '2',
        reportsDirectory: 'reports/four',
      })
    ).toEqual(
      expect.arrayContaining([
        '--project',
        'unit',
        'component',
        'integration',
        '--coverage',
        '--reporter=blob',
        '--shard=4/4',
        '--maxWorkers=2',
        '--coverage.reportsDirectory=reports/four',
      ])
    );
  });

  it('runs through a fake Vitest process and creates only the assigned report directory', () => {
    const root = createRunnerRoot();
    const reportsDirectory = path.join(root, 'reports');
    const spawn = vi.fn(() => ({ status: 0 }));
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    expect(
      runCoverageShard({
        argv: ['1/4', '1', reportsDirectory],
        env: {},
        root,
        spawn: spawn as never,
      })
    ).toBe(0);
    expect(fs.existsSync(reportsDirectory)).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--shard=1/4', '--maxWorkers=1']),
      { cwd: root, stdio: 'inherit', shell: false }
    );
  });

  it('returns fail-closed statuses for parser, installation, spawn, and child failures', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(runCoverageShard({ argv: [], env: {}, root: 'missing' })).toBe(1);
    expect(runCoverageShard({ argv: ['1/1'], env: {}, root: 'missing' })).toBe(1);

    const root = createRunnerRoot();
    expect(
      runCoverageShard({
        argv: ['1/1'],
        env: {},
        root,
        spawn: (() => ({ error: new Error('spawn failed') })) as never,
      })
    ).toBe(1);
    expect(
      runCoverageShard({
        argv: ['1/1'],
        env: {},
        root,
        spawn: (() => ({ status: 7 })) as never,
      })
    ).toBe(7);
    expect(
      runCoverageShard({
        argv: ['1/1'],
        env: {},
        root,
        spawn: (() => ({ status: null })) as never,
      })
    ).toBe(1);
  });

  it('prints help without resolving Vitest', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(runCoverageShard({ argv: ['help'], env: {}, root: 'missing' })).toBe(0);
    expect(info).toHaveBeenCalledWith(COVERAGE_SHARD_USAGE);
  });
});
