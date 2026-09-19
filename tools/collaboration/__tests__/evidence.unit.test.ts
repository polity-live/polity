import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const io = vi.hoisted(() => ({ read: vi.fn(), exec: vi.fn() }));
vi.mock('node:fs', () => ({ readFileSync: io.read }));
vi.mock('node:child_process', () => ({ execFileSync: io.exec }));
import {
  acceptanceGates,
  assertAcceptance,
  schemaFingerprint,
  sourceFingerprint,
} from '../evidence';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const sql = { query: vi.fn().mockResolvedValue([]) };
let report: Record<string, any>, files: Record<string, string>, dirty: boolean;
beforeEach(async () => {
  vi.unstubAllEnvs();
  io.read.mockReset();
  io.exec.mockReset();
  sql.query.mockReset().mockResolvedValue([]);
  files = { 'src/editor.ts': 'write through transaction', 'pnpm-lock.yaml': 'pinned versions' };
  dirty = true;
  io.exec.mockImplementation((_command: string, args: string[]) => {
    if (args[0] === 'ls-files') return 'src/editor.ts\0pnpm-lock.yaml\0';
    if (args[0] === 'status') return dirty ? ' M src/editor.ts' : '';
    if (args[0] === 'rev-parse') return 'release-commit';
    throw new Error('Unexpected git operation');
  });
  io.read.mockImplementation((path: string) => {
    if (path.endsWith('acceptance.json')) return JSON.stringify(report);
    if (!(path in files)) throw new Error('file missing');
    return files[path];
  });
  report = {
    status: 'passed',
    source: sourceFingerprint(),
    lockfile: hash(files['pnpm-lock.yaml']),
    schema: await schemaFingerprint(sql),
    releaseCommit: 'release-commit',
    gates: Object.fromEntries(acceptanceGates.map(gate => [gate, { status: 'passed' }])),
  };
});
describe('release acceptance evidence', () => {
  it('accepts an exactly tested local working tree without requiring a commit', async () => {
    expect(await assertAcceptance(sql, true)).toEqual(report);
    expect(io.exec.mock.calls.some(([, args]) => args[0] === 'status')).toBe(false);
  });
  it('rejects every missing or failed gate even if the report summary claims success', async () => {
    for (const gate of acceptanceGates) {
      Reflect.deleteProperty(report.gates, gate);
      await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
      report.gates[gate] = { status: 'failed' };
      await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
      report.gates[gate] = { status: 'passed' };
    }
    report.status = 'failed';
    await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
  });
  it('rejects changed source, deleted source, dependency versions and database schema', async () => {
    const original = { ...files };
    files['src/editor.ts'] += ' changed';
    await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
    delete files['src/editor.ts'];
    await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
    files = { ...original, 'pnpm-lock.yaml': 'new version' };
    await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
    files = original;
    sql.query.mockResolvedValue([{ trigger: 'different authority trigger' }]);
    await expect(assertAcceptance(sql, true)).rejects.toThrow('Acceptance evidence');
  });
  it('includes untracked application files while excluding report-only status and unrelated output', () => {
    const baseline = sourceFingerprint();
    io.exec.mockReturnValue(
      'pnpm-lock.yaml\0src/editor.ts\0src/editor.ts\0tools/collaboration/IMPLEMENTATION.md\0tools/collaboration/release-readiness.json\0output/transient.json\0'
    );
    expect(sourceFingerprint()).toBe(baseline);
    io.exec.mockReturnValue('pnpm-lock.yaml\0src/editor.ts\0src/untracked.ts\0');
    files['src/untracked.ts'] = 'new code';
    expect(sourceFingerprint()).not.toBe(baseline);
  });
  it('requires a clean matching release commit and separate production approval', async () => {
    await expect(assertAcceptance(sql, false)).rejects.toThrow('Production needs a clean release');
    dirty = false;
    await expect(assertAcceptance(sql, false)).rejects.toThrow('Production needs a clean release');
    vi.stubEnv('COLLABORATION_PRODUCTION_APPROVAL', 'release-commit');
    expect(await assertAcceptance(sql, false)).toEqual(report);
    report.releaseCommit = 'different';
    await expect(assertAcceptance(sql, false)).rejects.toThrow('Production needs a clean release');
  });
});
