import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
const io = vi.hoisted(() => ({
  sql: vi.fn(),
  unsafe: vi.fn(),
  end: vi.fn(),
  postgres: vi.fn(),
  auth: vi.fn(),
  read: vi.fn(),
  committed: vi.fn(),
  diagnostics: vi.fn(),
  failure: vi.fn(),
  guard: vi.fn(),
  delivery: vi.fn(),
  protocol: vi.fn(),
  listen: vi.fn(),
  destroy: vi.fn(),
  config: {} as any,
  rooms: new Map<string, any>(),
  leaderOptions: {} as any,
}));
vi.mock('@hocuspocus/server', () => ({
  Server: class {
    hocuspocus = { documents: io.rooms };
    listen = io.listen;
    destroy = io.destroy;
    constructor(config: unknown) {
      io.config = config;
    }
  },
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: io.auth } }) }));
vi.mock('postgres', () => ({ default: io.postgres }));
vi.mock('../../../src/server/collaboration/service', () => ({
  readSession: io.read,
  committedState: io.committed,
}));
vi.mock('../../../src/server/collaboration/protocol', () => ({
  commitBeforeSync: () => io.protocol,
}));
vi.mock('../../../src/server/collaboration/diagnostics', () => ({
  collaborationDiagnostics: io.diagnostics,
  recordCollaborationFailure: io.failure,
}));
vi.mock('../../../src/server/collaboration/delivery', () => ({
  installDeliveryGuard: io.guard,
  waitForDelivery: io.delivery,
}));
const id = '11111111-1111-4111-8111-111111111111',
  generation = '22222222-2222-4222-8222-222222222222';
let timer: () => void, signals: Record<string, () => void>, events: any[], acquired: boolean;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  io.rooms.clear();
  events = [];
  acquired = true;
  signals = {};
  vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-key');
  vi.stubEnv('ZERO_UPSTREAM_DB', 'postgres://local');
  vi.stubEnv('PORT', '');
  vi.spyOn(process, 'once').mockImplementation(((event: string, callback: () => void) => {
    signals[event] = callback;
    return process;
  }) as any);
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('setInterval', (callback: () => void) => {
    timer = callback;
    return 1;
  });
  vi.stubGlobal('clearInterval', vi.fn());
  Object.assign(io.sql, { unsafe: io.unsafe, end: io.end });
  io.postgres.mockImplementation((_url, options) => {
    io.leaderOptions = options;
    return io.sql;
  });
  io.sql.mockImplementation(async (parts: TemplateStringsArray | number[]) => {
    if (!('raw' in parts)) return parts;
    const query = parts.join('?');
    return query.startsWith('select pg_try')
      ? [{ acquired }]
      : query.startsWith('select o.id')
        ? events
        : [];
  });
  io.auth.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null });
  io.read.mockResolvedValue({ capabilities: { edit: true } });
  io.committed.mockResolvedValue({ bytes: new Uint8Array([0, 0]) });
  io.listen.mockResolvedValue(undefined);
  io.destroy.mockResolvedValue(undefined);
  io.end.mockResolvedValue(undefined);
  io.delivery.mockResolvedValue(undefined);
  io.unsafe.mockResolvedValue([{ row: 1 }]);
  io.diagnostics.mockImplementation(async sql => {
    expect(await sql.query('health', [])).toEqual([{ row: 1 }]);
    return { phase: 'active', writeReady: true };
  });
});
afterEach(() => {
  for (const doc of io.rooms.values()) doc.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const context = () => ({ userId: 'actor', id, generation, expires: Date.now() + 60000 });
const connection = () => ({ context: context(), readOnly: false, close: vi.fn() });
function room(key: string, connections: any[]) {
  const doc = Object.assign(new Y.Doc(), {
    name: key,
    flush: vi.fn(),
    broadcastStateless: vi.fn(),
    getConnections: () => connections,
  });
  io.rooms.set(key, doc);
  return doc;
}
describe('shared Hocuspocus service lifecycle', () => {
  it('never falls back to an implicit PostgreSQL database when configuration is missing', async () => {
    vi.stubEnv('ZERO_UPSTREAM_DB', undefined);
    await expect(import('../server')).rejects.toThrow('ZERO_UPSTREAM_DB is required');
    expect(io.postgres).not.toHaveBeenCalled();
    expect(io.listen).not.toHaveBeenCalled();
  });
  it('requires configuration and exclusive database leadership before listening', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    await expect(import('../server')).rejects.toThrow('Supabase configuration is required');
    expect(io.postgres).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
    acquired = false;
    await expect(import('../server')).rejects.toThrow('already active');
    expect(io.end).toHaveBeenCalled();
    expect(io.listen).not.toHaveBeenCalled();
    io.leaderOptions.onclose();
    expect(process.exit).not.toHaveBeenCalled();
  });
  it('authenticates each room generation and rechecks token identity and current write capability', async () => {
    vi.stubEnv('PORT', '1236');
    await import('../server');
    expect(io.config.port).toBe(1236);
    expect(io.config.beforeSync).toBe(io.protocol);
    expect(io.guard).toHaveBeenCalled();
    const connectionConfig = { readOnly: true };
    const ctx = await io.config.onAuthenticate({
      token: 'token',
      documentName: `${id}:${generation}`,
      connectionConfig,
    });
    expect(ctx).toMatchObject({ userId: 'actor', id, generation });
    expect(connectionConfig.readOnly).toBe(false);
    io.read.mockResolvedValueOnce({ capabilities: { edit: false } });
    const conn = connection();
    await io.config.onTokenSync({ token: 'renewal', context: ctx, connection: conn });
    expect(conn.readOnly).toBe(true);
    io.auth.mockResolvedValueOnce({ data: { user: { id: 'different-user' } }, error: null });
    await expect(
      io.config.onTokenSync({ token: 'swapped', context: ctx, connection: conn })
    ).rejects.toThrow('Unauthorized');
    io.auth.mockResolvedValueOnce({ data: { user: null }, error: true });
    await expect(
      io.config.onAuthenticate({
        token: 'invalid',
        documentName: `${id}:${generation}`,
        connectionConfig,
      })
    ).rejects.toThrow('Unauthorized');
  });
  it('loads only committed bytes and denies subsequent messages after session expiry or revocation', async () => {
    await import('../server');
    const doc = new Y.Doc();
    expect(await io.config.onLoadDocument({ context: context(), document: doc })).toBe(doc);
    doc.destroy();
    expect(io.committed).toHaveBeenCalledWith('actor', id, generation);
    const conn = connection();
    await io.config.beforeHandleMessage({ context: conn.context, connection: conn });
    expect(conn.readOnly).toBe(false);
    await expect(
      io.config.beforeHandleMessage({ context: { ...context(), expires: 0 }, connection: conn })
    ).rejects.toThrow('Session expired');
    const error = new Error('access_denied');
    io.read.mockRejectedValueOnce(error);
    await expect(
      io.config.beforeHandleMessage({ context: context(), connection: conn })
    ).rejects.toThrow('access_denied');
    expect(io.failure).toHaveBeenCalledWith(error);
  });
  it('exposes health diagnostics without letting Hocuspocus append a second response', async () => {
    await import('../server');
    const response = { writeHead: vi.fn(), end: vi.fn() };
    await io.config.onRequest({ request: { url: '/other' }, response });
    expect(response.end).not.toHaveBeenCalled();
    await expect(io.config.onRequest({ request: { url: '/health' }, response })).rejects.toBeNull();
    expect(JSON.parse(response.end.mock.lastCall![0])).toMatchObject({
      ready: true,
      leader: true,
      phase: 'active',
    });
    io.diagnostics.mockRejectedValueOnce(new Error('database_down'));
    await expect(io.config.onRequest({ request: { url: '/health' }, response })).rejects.toBeNull();
    expect(response.writeHead).toHaveBeenLastCalledWith(503);
  });
  it('removes private awareness fields and binds every displayed identity to its authenticated connection', async () => {
    await import('../server');
    const states = new Map([
      [
        1,
        {
          user: { id: 'forged', name: 'x'.repeat(100), color: '#123ABC' },
          cursor: {
            pageId: id,
            anchor: 'encoded-anchor',
            focus: 'x'.repeat(2049),
            x: 4,
            y: Infinity,
            privateText: 'secret',
          },
          secret: 'private',
        } as any,
      ],
      [2, { user: { name: '', color: 'invalid' }, cursor: { pageId: 'bad', anchor: 5 } }],
      [3, { cursor: 4 }],
    ]);
    await io.config.beforeHandleAwareness({ context: context(), states });
    expect(states.get(1)).toEqual({
      user: { id: 'actor', name: 'x'.repeat(80), color: '#123ABC' },
      cursor: { pageId: id, anchor: 'encoded-anchor', x: 4 },
    });
    expect(states.get(2)).toEqual({ user: { id: 'actor', name: '', color: '#B88A3B' } });
    expect(states.get(3)).toEqual({});
    const anonymous = new Map([
      [1, { user: { name: 'hidden' }, cursor: { y: 3, focus: 'valid' } }],
    ]);
    await io.config.beforeHandleAwareness({ context: null, states: anonymous });
    expect(anonymous.get(1)).toEqual({ cursor: { y: 3, focus: 'valid' } });
  });
  it('coalesces committed outbox rows, delivers the latest state once and acknowledges only captured IDs', async () => {
    await import('../server');
    const conn = connection();
    const doc = room(`${id}:${generation}`, [conn]);
    const update = new Y.Doc();
    update.getMap('test').set('confirmed', true);
    const bytes = Y.encodeStateAsUpdate(update);
    update.destroy();
    events = [1, 2].map(outboxId => ({
      id: outboxId,
      document_id: id,
      generation,
      state: bytes,
      revision: 3,
      checksum: 'hash',
    }));
    timer();
    timer();
    await settle();
    expect(doc.getMap('test').get('confirmed')).toBe(true);
    expect(doc.flush).toHaveBeenCalledTimes(1);
    expect(doc.broadcastStateless).toHaveBeenCalledWith(
      JSON.stringify({ type: 'committed', revision: 3, generation, checksum: 'hash' })
    );
    expect(io.delivery).toHaveBeenCalledWith(conn);
    expect(
      io.sql.mock.calls.filter(
        ([parts]) =>
          Array.isArray(parts) && parts.join('?').startsWith('update collaboration_outbox')
      )
    ).toHaveLength(1);
    events = [];
    timer();
    await settle();
    expect(doc.flush).toHaveBeenCalledTimes(1);
  });
  it('retires obsolete rooms, skips unrelated documents and evicts revoked or expired sessions', async () => {
    await import('../server');
    const old = connection(),
      other = connection();
    other.context.expires = 0;
    room(`${id}:${generation}`, [old]);
    room(`33333333-3333-4333-8333-333333333333:${generation}`, [other]);
    io.read.mockRejectedValueOnce(new Error('revoked'));
    events = [
      {
        id: 1,
        document_id: id,
        generation: '44444444-4444-4444-8444-444444444444',
        state: new Uint8Array([0, 0]),
      },
    ];
    timer();
    await settle();
    expect(old.close).toHaveBeenCalledWith(expect.objectContaining({ code: 4403 }));
    expect(old.close).toHaveBeenCalledWith(expect.objectContaining({ code: 4409 }));
    expect(other.close).toHaveBeenCalledWith(expect.objectContaining({ code: 4403 }));
  });
  it('stops on lost leadership or outbox failure and never continues as a second writer', async () => {
    await import('../server');
    io.leaderOptions.onclose();
    expect(process.exit).toHaveBeenCalledWith(1);
    io.sql.mockRejectedValueOnce(new Error('database_lost'));
    timer();
    await settle();
    expect(io.destroy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenLastCalledWith(1);
  });
  it('releases timers and the database lease on either shutdown signal', async () => {
    await import('../server');
    signals.SIGINT();
    await settle();
    expect(io.destroy).toHaveBeenCalled();
    expect(io.end).toHaveBeenCalled();
    expect(process.exit).toHaveBeenLastCalledWith(0);
    io.leaderOptions.onclose();
    expect(process.exit).toHaveBeenLastCalledWith(0);
    signals.SIGTERM();
    await settle();
    expect(clearInterval).toHaveBeenCalledTimes(2);
  });
});
