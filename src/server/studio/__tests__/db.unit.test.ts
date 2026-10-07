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
  it('validates collaboration identifiers and checks current workspace access in the requested transaction', async () => {
    const db = await import('../db');
    const actor = crypto.randomUUID(),
      project = crypto.randomUUID();
    await db.assertStudioCollaborationAccess(actor, project);
    await db.assertStudioCollaborationAccess(actor, project, io.sql as never);
    for (const [userId, projectId] of [
      ['invalid', project],
      [actor, 'invalid'],
    ]) {
      await expect(db.assertStudioCollaborationAccess(userId, projectId)).rejects.toMatchObject({
        status: 400,
        code: 'ai_invalid_identifier',
      });
    }
    for (const result of [[], [{ allowed: false }]]) {
      io.sql.mockResolvedValue(result);
      await expect(db.assertStudioCollaborationAccess(actor, project)).rejects.toMatchObject({
        status: 403,
      });
    }
  });
  it('uses a shared transaction authority lock for read-only work and explicit write access for groups', async () => {
    const db = await import('../db');
    const body = vi.fn(async () => 'read result');
    expect(await db.studioTransaction(body, { readOnly: true })).toBe('read result');
    expect(io.sql.mock.calls[0][0].join('')).toContain('pg_advisory_xact_lock_shared');
    expect(io.sql.mock.invocationCallOrder[0]).toBeLessThan(body.mock.invocationCallOrder[0]);
    await db.assertStudioGroup('actor', 'group', io.sql as never, true);
    expect(io.sql.mock.lastCall?.slice(1)).toEqual(['actor', 'group', true]);
  });
  it('respects canvas preview flags and the V3 development default and explicit disablement', async () => {
    const { canvasEnabled, studioV3Enabled } = await import('../db');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('STUDIO_ENABLED', 'true');
    vi.stubEnv('STUDIO_PILOT_USER_IDS', '');
    vi.stubEnv('STUDIO_V3_ENABLED', '');
    expect(studioV3Enabled('actor')).toBe(true);
    vi.stubEnv('STUDIO_V3_ENABLED', 'false');
    expect(studioV3Enabled('actor')).toBe(false);
    vi.stubEnv('CANVAS_ENABLED', '');
    expect(canvasEnabled()).toBe(true);
    vi.stubEnv('CANVAS_ENABLED', 'false');
    expect(canvasEnabled()).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CANVAS_ENABLED', '');
    expect(canvasEnabled()).toBe(false);
    vi.stubEnv('CANVAS_ENABLED', 'true');
    expect(canvasEnabled()).toBe(true);
  });
  it('uses an explicit studio connection or upstream fallback and reuses its limited pool', async () => {
    vi.stubEnv('STUDIO_DATABASE_URL', 'postgres://studio');
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://upstream');
    let db = await import('../db');
    expect(db.studioSql()).toBe(io.sql);
    db.studioSql();
    expect(io.postgres).toHaveBeenCalledTimes(1);
    expect(io.postgres).toHaveBeenLastCalledWith('postgres://studio', {
      max: 8,
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
  it('locks authority before executing commands and propagates failure', async () => {
    const db = await import('../db');
    const body = vi.fn(async () => ({ saved: true }));
    expect(await db.studioTransaction(body)).toEqual({ saved: true });
    expect(io.sql.mock.calls[0][0].join('')).toContain('pg_advisory_xact_lock');
    body.mockRejectedValueOnce(new Error('write_failed'));
    await expect(db.studioTransaction(body)).rejects.toThrow('write_failed');
  });
  it('respects explicit enablement, production defaults and pilot restrictions', async () => {
    const { studioEnabled, studioV3Enabled } = await import('../db');
    vi.stubEnv('STUDIO_ENABLED', '');
    vi.stubEnv('STUDIO_PILOT_USER_IDS', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(studioEnabled('actor')).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(studioEnabled('actor')).toBe(false);
    expect(studioV3Enabled('actor')).toBe(false);
    vi.stubEnv('STUDIO_ENABLED', 'true');
    expect(studioEnabled('actor')).toBe(true);
    expect(studioV3Enabled('actor')).toBe(false);
    vi.stubEnv('STUDIO_V3_ENABLED', 'true');
    expect(studioV3Enabled('actor')).toBe(true);
    vi.stubEnv('STUDIO_PILOT_USER_IDS', 'pilot,,other');
    expect(studioEnabled('actor')).toBe(false);
    expect(studioEnabled('pilot')).toBe(true);
    vi.stubEnv('STUDIO_ENABLED', 'false');
    vi.stubEnv('NODE_ENV', 'development');
    expect(studioEnabled('pilot')).toBe(false);
    expect(studioV3Enabled('pilot')).toBe(false);
  });
});
