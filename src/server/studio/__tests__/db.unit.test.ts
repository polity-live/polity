import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  postgres: vi.fn(),
  sql: vi.fn(),
  begin: vi.fn(),
  unsafe: vi.fn(),
  initialize: vi.fn(),
  json: vi.fn(),
}));
vi.mock('postgres', () => ({ default: io.postgres }));
vi.mock('@/server/collaboration/finalize', () => ({
  initializeTransactionDocuments: io.initialize,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  Object.assign(io.sql, { begin: io.begin, unsafe: io.unsafe, json: io.json });
  io.postgres.mockReturnValue(io.sql);
  io.begin.mockImplementation(body => body(io.sql));
  io.sql.mockResolvedValue([{ phase: 'active', allowed: true }]);
  io.unsafe.mockResolvedValue([{ id: 'record' }]);
  io.json.mockImplementation(value => ({ json: value }));
  io.initialize.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe('Studio database authority boundary', () => {
  it('uses an explicit studio connection or upstream fallback and reuses its limited pool', async () => {
    vi.stubEnv('STUDIO_DATABASE_URL', 'postgres://studio');
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://upstream');
    let db = await import('../db');
    expect(db.studioSql()).toBe(io.sql);
    db.studioSql();
    expect(io.postgres).toHaveBeenCalledTimes(1);
    expect(io.postgres).toHaveBeenLastCalledWith('postgres://studio', {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    vi.resetModules();
    vi.stubEnv('STUDIO_DATABASE_URL', '');
    db = await import('../db');
    db.studioSql();
    expect(io.postgres.mock.lastCall![0]).toBe('postgres://upstream');
    vi.resetModules();
    vi.stubEnv('ZERO_UPSTREAM_DB', '');
    db = await import('../db');
    db.studioSql();
    expect(io.postgres.mock.lastCall![0]).toBe('');
  });
  it('requires current project or group access on the chosen transaction', async () => {
    const db = await import('../db');
    await db.assertStudioAccess('actor', 'project');
    await db.assertStudioAccess('actor', 'project', true, io.sql as never);
    await db.assertStudioGroup('actor', 'group');
    await db.assertStudioGroup('actor', 'group', io.sql as never);
    for (const result of [[], [{ allowed: false }]]) {
      io.sql.mockResolvedValue(result);
      await expect(db.assertStudioAccess('outsider', 'project')).rejects.toMatchObject({
        status: 403,
      });
      await expect(db.assertStudioGroup('outsider', 'group')).rejects.toMatchObject({
        status: 403,
      });
    }
  });
  it('locks authority, executes the command, and initializes new shared documents before commit', async () => {
    const db = await import('../db');
    const body = vi.fn(async transaction => {
      expect(transaction).toBe(io.sql);
      return { saved: true };
    });
    io.initialize.mockImplementation(async sql => {
      expect(await sql.query('query', [null, 3, 'text', { a: 1 }, new Uint8Array([1])])).toEqual([
        { id: 'record' },
      ]);
    });
    expect(await db.studioTransaction(body)).toEqual({ saved: true });
    expect(io.sql.mock.calls[0][0].join('')).toContain('pg_advisory_xact_lock');
    expect(body.mock.invocationCallOrder[0]).toBeLessThan(
      io.initialize.mock.invocationCallOrder[0]
    );
    expect(io.unsafe).toHaveBeenCalledWith('query', [
      null,
      3,
      'text',
      { json: { a: 1 } },
      new Uint8Array([1]),
    ]);
  });
  it('blocks commands during maintenance and propagates failure instead of initializing partial content', async () => {
    const db = await import('../db');
    io.sql.mockResolvedValue([{ phase: 'maintenance' }]);
    const body = vi.fn();
    await expect(db.studioTransaction(body)).rejects.toMatchObject({ status: 503 });
    expect(body).not.toHaveBeenCalled();
    expect(io.initialize).not.toHaveBeenCalled();
    io.sql.mockResolvedValue([]);
    body.mockRejectedValueOnce(new Error('write_failed'));
    await expect(db.studioTransaction(body)).rejects.toThrow('write_failed');
    expect(io.initialize).not.toHaveBeenCalled();
  });
  it('respects explicit enablement, production defaults and pilot restrictions', async () => {
    const { studioEnabled } = await import('../db');
    vi.stubEnv('STUDIO_ENABLED', '');
    vi.stubEnv('STUDIO_PILOT_USER_IDS', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(studioEnabled('actor')).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(studioEnabled('actor')).toBe(false);
    vi.stubEnv('STUDIO_ENABLED', 'true');
    expect(studioEnabled('actor')).toBe(true);
    vi.stubEnv('STUDIO_PILOT_USER_IDS', 'pilot,,other');
    expect(studioEnabled('actor')).toBe(false);
    expect(studioEnabled('pilot')).toBe(true);
    vi.stubEnv('STUDIO_ENABLED', 'false');
    vi.stubEnv('NODE_ENV', 'development');
    expect(studioEnabled('pilot')).toBe(false);
  });
});
