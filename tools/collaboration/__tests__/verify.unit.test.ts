import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  source: vi.fn(),
  schema: vi.fn(),
  spawn: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock('node:fs', () => ({
  readFileSync: io.read,
  writeFileSync: io.write,
  mkdirSync: vi.fn(),
  openSync: () => 123,
  closeSync: vi.fn(),
}));
vi.mock('node:child_process', () => ({ execFileSync: () => 'release-commit', spawn: io.spawn }));
vi.mock('../../../src/zero/db-provider', () => ({
  dbProvider: { transaction: (body: (tx: unknown) => unknown) => body({ dbTransaction: {} }) },
}));
vi.mock('../evidence', async original => ({
  ...(await original<typeof import('../evidence')>()),
  sourceFingerprint: io.source,
  schemaFingerprint: io.schema,
}));
const exit = new Error('captured process exit');
const argv = process.argv;
let result: any, exitCode: number | undefined;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('ZERO_UPSTREAM_DB', 'postgresql://unused:unused@127.0.0.1:54322/postgres');
  process.argv = [process.execPath, 'launch.ts', 'verify'];
  result = undefined;
  exitCode = undefined;
  vi.spyOn(process, 'exit').mockImplementation(code => {
    exitCode = Number(code);
    throw exit;
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  io.source.mockReturnValue('source');
  io.schema.mockResolvedValue('schema');
  io.read.mockImplementation((file: string) => {
    if (file.endsWith('pnpm-lock.yaml')) return 'lock';
    if (file.endsWith('.log')) return 'actual child command log';
    throw new Error('No earlier report');
  });
  io.write.mockImplementation((_file: string, data: string) => {
    result = JSON.parse(data);
  });
  io.spawn.mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('exit', 0));
    return child;
  });
});
afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('fingerprinted verification runner', () => {
  it('refuses verification without an explicit local database before running commands', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', undefined);
    await expect(import('../verify')).rejects.toThrow('Invalid URL');
    expect(io.spawn).not.toHaveBeenCalled();
  });
  it('reuses only exact matching earlier gates and refuses unknown gate names', async () => {
    const { createHash } = await import('node:crypto');
    const previous = {
      source: 'source',
      schema: 'schema',
      lockfile: createHash('sha256').update('lock').digest('hex'),
      gates: { types: { status: 'passed' } },
    };
    process.argv.push('lint');
    io.read.mockImplementation((file: string) =>
      file.endsWith('pnpm-lock.yaml')
        ? 'lock'
        : file.endsWith('.log')
          ? 'actual log'
          : JSON.stringify(previous)
    );
    await expect(import('../verify')).rejects.toBe(exit);
    expect(result.gates.types.status).toBe('passed');
    expect(result.status).toBe('incomplete');
    vi.resetModules();
    previous.source = 'different';
    await expect(import('../verify')).rejects.toBe(exit);
    expect(result.gates.types.status).toBe('pending');
    vi.resetModules();
    process.argv.push('invented');
    await expect(import('../verify')).rejects.toThrow('named acceptance gates');
  });
  it('records spawn errors and signal terminations as failed checks', async () => {
    process.argv.push('lint', 'types');
    let attempts = 0;
    io.spawn.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() =>
        ++attempts === 1
          ? child.emit('error', new Error('missing runner'))
          : child.emit('exit', null)
      );
      return child;
    });
    await expect(import('../verify')).rejects.toBe(exit);
    expect(result.gates.lint.exitCode).toBe(1);
    expect(result.gates.types.exitCode).toBe(1);
  });
  it('records every successful command and log fingerprint before producing a complete report', async () => {
    await expect(import('../verify')).rejects.toBe(exit);
    expect(exitCode).toBe(0);
    expect(result.status).toBe('passed');
    expect(result.source).toBe('source');
    expect(result.schema).toBe('schema');
    expect(Object.keys(result.gates)).toHaveLength(14);
    for (const gate of Object.values(result.gates) as any[]) {
      expect(gate.status).toBe('passed');
      expect(gate.exitCode).toBe(0);
      expect(gate.logChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(gate.command).toBeTruthy();
    }
  });
  it('never approves a partial run or a failed command and still records later independent checks', async () => {
    process.argv.push('lint', 'types');
    io.spawn.mockImplementation((command: string) => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', command.includes('lint') ? 1 : 0));
      return child;
    });
    await expect(import('../verify')).rejects.toBe(exit);
    expect(exitCode).toBe(1);
    expect(result.status).toBe('incomplete');
    expect(result.gates.lint.status).toBe('failed');
    expect(result.gates.types.status).toBe('passed');
    expect(result.gates.coverage.status).toBe('pending');
    expect(io.spawn).toHaveBeenCalledTimes(2);
  });
  it('invalidates otherwise successful evidence when source changes during verification', async () => {
    io.source.mockReturnValueOnce('original').mockReturnValue('changed');
    await expect(import('../verify')).rejects.toBe(exit);
    expect(result.status).toBe('invalidated');
    expect(exitCode).toBe(1);
  });
  it('refuses remote databases before spawning a check or writing a report', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgresql://unused:unused@example.invalid:54322/postgres');
    await expect(import('../verify')).rejects.toThrow('only operates on the local Polity stack');
    expect(io.spawn).not.toHaveBeenCalled();
    expect(io.write).not.toHaveBeenCalled();
  });
});
