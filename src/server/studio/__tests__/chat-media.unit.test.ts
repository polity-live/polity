import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const io = vi.hoisted(() => ({ query: vi.fn(), copy: vi.fn(), sign: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ storage: { from: () => ({ copy: io.copy, createSignedUrl: io.sign }) } }),
}));
import { importChatMedia } from '../chat-media';
const tx = { location: 'server', dbTransaction: { query: io.query } } as any;
const path = 'editor-uploads/actor/photo.png';
beforeEach(() => {
  vi.clearAllMocks();
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
  io.fetch.mockResolvedValue(
    new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]))
  );
  vi.stubGlobal('fetch', io.fetch);
});
afterEach(() => vi.unstubAllGlobals());
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
