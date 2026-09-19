import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  manifest: vi.fn(),
  convert: vi.fn(),
  activate: vi.fn(),
  lifecycle: vi.fn(),
}));
vi.mock('../../../src/zero/db-provider', () => ({ dbProvider: { transaction: io.transaction } }));
vi.mock('../../../src/server/collaboration/migration', () => ({
  governanceManifest: io.manifest,
  migrateDocuments: io.convert,
  activateMigration: io.activate,
}));
vi.mock('../../e2e/collaboration/lifecycle', () => ({ rehearseLifecycle: io.lifecycle }));
const exited = new Error('captured exit');
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused@127.0.0.1:54322/postgres');
  vi.stubEnv('COLLABORATION_REHEARSAL_COMMIT', '');
  vi.stubEnv('COLLABORATION_REHEARSAL_LIFECYCLE', '');
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw exited;
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  io.transaction.mockImplementation(body => body({ dbTransaction: { query: io.query } }));
  io.manifest.mockResolvedValue({ votes: ['unchanged'], deadlines: [123] });
  io.convert.mockResolvedValue({ documents: 6, verified: true });
  io.activate.mockResolvedValue(undefined);
  io.lifecycle.mockResolvedValue({ passed: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('migration rehearsal transaction boundary', () => {
  it('refuses a rehearsal without a database before opening a transaction', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', undefined);
    await expect(import('../rehearsal')).rejects.toThrow('Invalid URL');
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it('actually converts and activates within one transaction but intentionally rolls back a dry run', async () => {
    await expect(import('../rehearsal')).rejects.toBe(exited);
    expect(io.transaction).toHaveBeenCalledTimes(1);
    expect(io.convert).toHaveBeenCalledWith(
      expect.objectContaining({ query: io.query }),
      expect.any(String)
    );
    expect(io.activate.mock.calls[0][1]).toBe(io.convert.mock.calls[0][1]);
    expect(io.manifest).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
      report: { documents: 6 },
      rolledBack: true,
      transactionRollbackOnly: true,
    });
  });
  it('commits only explicitly named acceptance copies', async () => {
    vi.stubEnv('COLLABORATION_REHEARSAL_COMMIT', '1');
    await expect(import('../rehearsal')).rejects.toThrow('dedicated acceptance database');
    expect(io.transaction).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv(
      'ZERO_UPSTREAM_DB',
      'postgres://unused@localhost:54322/polity_collaboration_acceptance_123'
    );
    await expect(import('../rehearsal')).rejects.toBe(exited);
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toMatchObject({
      rolledBack: false,
      database: '/polity_collaboration_acceptance_123',
    });
  });
  it('refuses remote copies and propagates conversion or governance errors instead of swallowing them as rollback', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused@example.invalid/postgres');
    await expect(import('../rehearsal')).rejects.toThrow('isolated local database');
    expect(io.transaction).not.toHaveBeenCalled();
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused@localhost:54322/postgres');
    vi.resetModules();
    io.convert.mockRejectedValueOnce(new Error('ambiguous_ballot'));
    await expect(import('../rehearsal')).rejects.toThrow('ambiguous_ballot');
    expect(io.activate).not.toHaveBeenCalled();
    vi.resetModules();
    io.manifest
      .mockResolvedValueOnce({ votes: ['before'] })
      .mockResolvedValueOnce({ votes: ['after'] });
    await expect(import('../rehearsal')).rejects.toThrow('Governance changed');
    expect(console.log).not.toHaveBeenCalled();
  });
  it('dispatches the committed lifecycle fixture to its independently guarded runner', async () => {
    vi.stubEnv('COLLABORATION_REHEARSAL_LIFECYCLE', '1');
    await expect(import('../rehearsal')).rejects.toBe(exited);
    expect(io.lifecycle).toHaveBeenCalledTimes(1);
    expect(io.transaction).not.toHaveBeenCalled();
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({ passed: true });
  });
});
