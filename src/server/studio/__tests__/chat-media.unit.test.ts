import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const io = vi.hoisted(() => ({
  query: vi.fn(),
  copy: vi.fn(),
  sign: vi.fn(),
  fetch: vi.fn(),
  info: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: { from: () => ({ copy: io.copy, createSignedUrl: io.sign, info: io.info }) },
  }),
}));
import { importChatMedia } from '../chat-media';
const tx = { location: 'server', dbTransaction: { query: io.query } } as any;
const path = 'editor-uploads/actor/photo.png';
beforeEach(() => {
  vi.resetAllMocks();
  io.query.mockImplementation(async (sql: string) =>
    sql.includes('select configuration')
      ? [{ configuration: { sharedAttachments: [{ entityType: 'document', entityId: path }] } }]
      : sql.includes('studio_access')
        ? [{ allowed: true }]
        : sql.includes('storage.objects')
          ? [{ owner_id: 'actor', metadata: { size: 16, mimetype: 'image/png' } }]
          : sql.includes('count(*)')
            ? [{ count: 0, bytes: 0 }]
            : []
  );
  io.sign.mockResolvedValue({ data: { signedUrl: 'https://local.invalid/media' }, error: null });
  io.copy.mockResolvedValue({ error: null });
  io.info.mockResolvedValue({ data: { size: 16 }, error: null });
  io.fetch.mockImplementation(
    async () =>
      new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]))
  );
  vi.stubGlobal('fetch', io.fetch);
});
afterEach(() => vi.unstubAllGlobals());
function overrideRow(fragment: string, result: unknown[]) {
  const original = io.query.getMockImplementation()!;
  io.query.mockImplementation(async (sql: string, ...args: unknown[]) =>
    sql.includes(fragment) ? result : original(sql, ...args)
  );
}
it.each(
  [
    [],
    [{ configuration: {} }],
    [{ configuration: { sharedAttachments: [] } }],
    [{ configuration: { sharedAttachments: [{ entityType: 'event', entityId: path }] } }],
  ].map(rows => ({ rows }))
)(
  'requires a current run and explicitly shared document attachment %j',
  async ({ rows: runRows }) => {
    overrideRow('select configuration', runRows);
    await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
      'not shared'
    );
    expect(io.sign).not.toHaveBeenCalled();
  }
);
it('rejects non-upload paths and missing access results before reading storage objects', async () => {
  await expect(
    importChatMedia(tx, 'actor', 'run', 'project', 'elsewhere/photo.png', 'asset')
  ).rejects.toThrow('not shared');
  overrideRow('studio_access', []);
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'access denied'
  );
  expect(io.sign).not.toHaveBeenCalled();
});
it.each(
  [[], [{ owner_id: 'other', metadata: { size: 16, mimetype: 'image/png' } }]].map(rows => ({
    rows,
  }))
)('rejects missing and foreign storage objects %j', async ({ rows: objects }) => {
  overrideRow('storage.objects', objects);
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'no longer accessible'
  );
  expect(io.copy).not.toHaveBeenCalled();
});
it.each([
  { size: 16, mimetype: 'text/html' },
  { size: 'invalid', mimetype: 'image/png' },
  { size: 0, mimetype: 'image/png' },
  { size: -1, mimetype: 'image/png' },
  { size: 100 * 1024 * 1024 + 1, mimetype: 'image/png' },
])('rejects unsupported media metadata %j before signing or copying', async metadata => {
  overrideRow('storage.objects', [{ owner_id: 'actor', metadata }]);
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'Unsupported media'
  );
  expect(io.sign).not.toHaveBeenCalled();
});
it.each([
  { count: 100, bytes: 0 },
  { count: 1, bytes: 500 * 1024 * 1024 },
])('enforces the project quota %j while holding its database lock', async usage => {
  overrideRow('count(*)', [usage]);
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'quota'
  );
  expect(io.query).toHaveBeenCalledWith(expect.stringContaining('for update'), ['project']);
  expect(io.copy).not.toHaveBeenCalled();
});
it('rejects signing and download failures without creating a ready asset record', async () => {
  io.sign.mockResolvedValueOnce({ error: new Error('sign failed'), data: null });
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'Cannot verify'
  );
  io.fetch.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'signature'
  );
  expect(io.copy).not.toHaveBeenCalled();
  expect(io.query.mock.calls.some(([sql]) => sql.includes('insert into studio_asset'))).toBe(false);
});
it('reuses a successfully copied storage object after a retry only when its size matches', async () => {
  io.copy.mockResolvedValue({ error: new Error('object exists') });
  expect(await importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).toMatchObject({
    status: 'ready',
  });
  expect(io.info).toHaveBeenCalledWith('project/assets/asset');
  io.info.mockResolvedValueOnce({ error: new Error('not found'), data: null });
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'other')).rejects.toThrow(
    'Cannot copy'
  );
  io.info.mockResolvedValueOnce({ error: null, data: { size: 15 } });
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'other')).rejects.toThrow(
    'Cannot copy'
  );
});
it('copies a verified shared upload to project storage and returns its ready asset ID', async () => {
  expect(await importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).toEqual({
    assetId: 'asset',
    mime: 'image/png',
    status: 'ready',
  });
  expect(io.copy).toHaveBeenCalledWith(path, 'project/assets/asset', {
    destinationBucket: 'studio',
  });
  expect(io.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into studio_asset'),
    expect.arrayContaining(['asset', 'project', 'image/png', 16])
  );
});
it('rejects unshared, traversing or unauthorized uploads before touching Storage', async () => {
  await expect(
    importChatMedia(tx, 'actor', 'run', 'project', 'editor-uploads/foreign/photo.png', 'asset')
  ).rejects.toThrow('not shared');
  await expect(
    importChatMedia(tx, 'actor', 'run', 'project', 'editor-uploads/../photo.png', 'asset')
  ).rejects.toThrow('not shared');
  io.query.mockImplementation(async (sql: string) =>
    sql.includes('configuration')
      ? [{ configuration: { sharedAttachments: [{ entityType: 'document', entityId: path }] } }]
      : [{ allowed: false }]
  );
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow(
    'access denied'
  );
  expect(io.copy).not.toHaveBeenCalled();
});
it('reuses a completed media import and rejects a mismatched file signature', async () => {
  const original = io.query.getMockImplementation()!;
  io.query.mockImplementation(async (sql: string, ...args: unknown[]) =>
    sql.includes('select id,mime_type')
      ? [{ id: 'asset', mime_type: 'image/png' }]
      : original(sql, ...args)
  );
  expect(await importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).toMatchObject({
    assetId: 'asset',
    status: 'ready',
  });
  expect(io.copy).not.toHaveBeenCalled();
  io.query.mockImplementation(original);
  io.fetch.mockResolvedValue(new Response('invalid image'));
  await expect(importChatMedia(tx, 'actor', 'run', 'project', path, 'asset')).rejects.toThrow();
  expect(io.copy).not.toHaveBeenCalled();
});
