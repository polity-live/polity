import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { projectDocument } from '../../../src/features/collaboration/logic/codec';
const io = vi.hoisted(() => ({
  sql: vi.fn(),
  end: vi.fn(),
  begin: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
  bucket: vi.fn(),
  write: vi.fn(),
  ffmpeg: vi.fn(),
  store: vi.fn(),
  unsafe: vi.fn(),
}));
vi.mock('../../../src/server/collaboration/store', async original => ({
  ...(await original<typeof import('../../../src/server/collaboration/store')>()),
  createStored: io.store,
}));
vi.mock('postgres', () => ({ default: () => io.sql }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { listUsers: io.list, createUser: io.create } },
    storage: { createBucket: io.bucket, from: () => ({ upload: io.upload }) },
  }),
}));
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: io.write,
  readFileSync: () => Buffer.from('synthetic media'),
}));
vi.mock('../../studio/exporters', () => ({ ffmpeg: io.ffmpeg }));
let phase: string, existing: boolean;
const stopped = new Error('seed exit');
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  phase = 'legacy';
  existing = false;
  vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused:unused@127.0.0.1:54322/postgres');
  vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw stopped;
  });
  Object.assign(io.sql, {
    json: (value: unknown) => value,
    begin: io.begin,
    end: io.end,
    unsafe: io.unsafe,
  });
  io.sql.mockImplementation(async (parts: TemplateStringsArray | unknown[]) => {
    if (!('raw' in parts)) return parts;
    const query = parts.join('?');
    return query.startsWith('select phase')
      ? [{ phase }]
      : query.startsWith('select id from document') && existing
        ? [{ id: 'existing' }]
        : [];
  });
  io.begin.mockImplementation(body => body(io.sql));
  io.end.mockResolvedValue(undefined);
  io.list.mockResolvedValue({ data: { users: [] } });
  io.create.mockImplementation(async ({ email }) => ({
    data: { user: { id: crypto.randomUUID(), email } },
    error: null,
  }));
  io.upload.mockResolvedValue({ error: null });
  io.bucket.mockResolvedValue({ error: null });
  io.ffmpeg.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const commands = (prefix: string) =>
  io.sql.mock.calls.filter(([parts]) => Array.isArray(parts) && parts.join('?').startsWith(prefix));
const manifest = () =>
  JSON.parse(io.write.mock.calls.find(([file]) => file === 'output/local-stack/demo.json')![1]);
describe('reproducible local collaboration demo seed', () => {
  it.each(['ZERO_UPSTREAM_DB', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])(
    'requires %s before touching the local database',
    async key => {
      vi.stubEnv(key, undefined);
      await expect(import('../seed')).rejects.toThrow(`${key} is not defined`);
      expect(io.sql).not.toHaveBeenCalled();
    }
  );
  it('builds all six editors, separate proposals, roles, historical voting proof and independent branches', async () => {
    await import('../seed');
    const demo = manifest();
    expect(Object.keys(demo.actors)).toHaveLength(15);
    expect(io.create).toHaveBeenCalledTimes(15);
    expect(io.begin).toHaveBeenCalledTimes(2);
    expect(io.store).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      { kind: 'studio', entityId: demo.ids.studio, branchId: null, workspaceId: null },
      expect.objectContaining({ title: 'Unser gemeinsamer Stadtteil' }),
      demo.actors.owner.id
    );
    const adapter = io.store.mock.calls[0][0];
    await adapter.query('select Studio fixture', []);
    expect(io.unsafe).toHaveBeenCalledWith('select Studio fixture', []);
    expect(io.upload).toHaveBeenCalledTimes(2);
    expect(io.ffmpeg).toHaveBeenCalledTimes(2);
    expect(commands('insert into document(')).toHaveLength(6);
    expect(commands('insert into amendment_process_branch')).toHaveLength(2);
    expect(commands('insert into change_request')).toHaveLength(2);
    expect(commands('insert into document_version')).toHaveLength(1);
    expect(commands('insert into voter')).toHaveLength(3);
    const snapshots = commands('insert into collaboration_legacy_snapshot');
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0][3].objects[0].properties.height).not.toBe(
      snapshots[1][3].objects[0].properties.height
    );
    const studio = commands('insert into studio_state')[0];
    const y = new Y.Doc();
    Y.applyUpdate(y, studio[2]);
    const value = projectDocument('studio', y) as any;
    y.destroy();
    expect(
      value.pages[0].elements.some((element: any) => element.assetId === demo.ids.imageAsset)
    ).toBe(true);
    expect(commands('insert into vote(')[0][0].join('?')).toContain("now()+interval '4 days'");
    expect(commands('insert into change_request')[0][0].join('?')).toContain(
      "now()+interval '7 days'"
    );
    expect(io.end).toHaveBeenCalled();
  });
  it('reuses known demo identities and produces the same domain IDs on repeated fresh setup', async () => {
    const roles = [
      'owner',
      'editor',
      'proposer',
      'reader',
      'outsider',
      ...Array.from({ length: 10 }, (_, i) => `load${i + 1}`),
    ];
    io.list.mockResolvedValue({
      data: {
        users: roles.map(role => ({
          id: crypto.randomUUID(),
          email: `${role}@collaboration.polity.test`,
        })),
      },
    });
    await import('../seed');
    const first = manifest();
    expect(io.create).not.toHaveBeenCalled();
    vi.resetModules();
    io.write.mockClear();
    await import('../seed');
    expect(manifest().ids).toEqual(first.ids);
  });
  it('does not reset an existing demo or mutate an active database', async () => {
    existing = true;
    await expect(import('../seed')).rejects.toBe(stopped);
    expect(io.begin).not.toHaveBeenCalled();
    expect(io.list).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
    vi.resetModules();
    existing = false;
    phase = 'active';
    await expect(import('../seed')).rejects.toThrow('Seed before migration');
    expect(io.create).not.toHaveBeenCalled();
  });
  it('refuses remote databases, wrong local ports or database names and remote authentication endpoints', async () => {
    for (const url of [
      'postgres://unused@example.invalid:54322/postgres',
      'postgres://unused@127.0.0.1:5432/postgres',
      'postgres://unused@127.0.0.1:54322/other',
    ]) {
      vi.resetModules();
      vi.stubEnv('ZERO_UPSTREAM_DB', url);
      await expect(import('../seed')).rejects.toThrow(
        'Demo seed requires the local Polity database'
      );
    }
    vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://unused@127.0.0.1:54322/postgres');
    for (const url of ['https://example.invalid:54321', 'http://localhost:54320']) {
      vi.resetModules();
      vi.stubEnv('SUPABASE_URL', url);
      await expect(import('../seed')).rejects.toThrow('Demo auth must be local');
    }
    expect(io.sql).not.toHaveBeenCalled();
  });
  it('stops before seeding domain rows when account creation fails or returns no account', async () => {
    io.create.mockResolvedValueOnce({ data: { user: null }, error: new Error('auth_unavailable') });
    await expect(import('../seed')).rejects.toThrow('auth_unavailable');
    vi.resetModules();
    io.create.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(import('../seed')).rejects.toThrow('Demo user missing');
    expect(io.begin).not.toHaveBeenCalled();
  });
  it('does not write a successful demo manifest after media upload or database failure', async () => {
    io.upload.mockResolvedValueOnce({ error: new Error('upload_failed') });
    await expect(import('../seed')).rejects.toThrow('upload_failed');
    expect(io.begin).not.toHaveBeenCalled();
    vi.resetModules();
    io.begin.mockRejectedValueOnce(new Error('database_failed'));
    await expect(import('../seed')).rejects.toThrow('database_failed');
    expect(io.write).not.toHaveBeenCalled();
  });
});
