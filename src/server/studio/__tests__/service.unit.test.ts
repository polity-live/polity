import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { projectDocument } from '@/features/collaboration/logic/codec';
const io = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  access: vi.fn(),
  group: vi.fn(),
  signUpload: vi.fn(),
  sign: vi.fn(),
  info: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  session: vi.fn(),
  export: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => io.sql,
  studioTransaction: io.transaction,
  assertStudioAccess: io.access,
  assertStudioGroup: io.group,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: io.signUpload,
        createSignedUrl: io.sign,
        info: io.info,
        remove: io.remove,
        copy: io.copy,
      }),
    },
  }),
}));
vi.mock('@/server/collaboration/service', () => ({ openSession: io.session }));
vi.mock('@/server/collaboration/studio-export', () => ({ queueCommittedExport: io.export }));
import {
  assetUrls,
  beginUpload,
  createProject,
  downloadExport,
  duplicateProject,
  finishUpload,
  loadProject,
  queueExport,
  validateAssets,
  validateStudioStatementRefs,
} from '../service';
let asset: any,
  available: any[],
  usage: any,
  current: any[],
  job: any,
  source: any,
  failInsert: boolean;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', io.fetch);
  asset = {
    id: 'asset',
    project_id: 'project',
    storage_path: 'private/asset',
    byte_size: 16,
    mime_type: 'image/png',
    ready: false,
    name: 'Photo',
  };
  available = [];
  usage = { count: 0, bytes: 0 };
  current = [{ ready: false }];
  job = {
    project_id: 'project',
    status: 'completed',
    storage_path: 'private/export',
    file_name: 'Result.png',
  };
  source = { group_id: 'group', document: createDocument('single', 'Original') };
  failInsert = false;
  Object.assign(io.sql, { json: (value: unknown) => value });
  io.sql.mockImplementation(
    async (parts: TemplateStringsArray | string[], ..._values: unknown[]) => {
      if (!('raw' in parts)) return parts;
      const sql = parts.join('?');
      if (sql.startsWith('select count')) return [usage];
      if (sql.startsWith('select ready')) return current;
      if (sql.startsWith('select * from studio_asset where id')) return asset ? [asset] : [];
      if (
        sql.startsWith('select * from studio_asset') ||
        sql.startsWith('select id,name,mime_type') ||
        sql.startsWith('select id from studio_asset')
      )
        return available;
      if (sql.startsWith('select * from studio_export')) return job ? [job] : [];
      if (sql.startsWith('select p.group_id')) return [source];
      if (sql.startsWith('insert') && failInsert) throw new Error('database_down');
      return [];
    }
  );
  io.transaction.mockImplementation(async body => body(io.sql));
  io.access.mockResolvedValue(undefined);
  io.group.mockResolvedValue(undefined);
  io.signUpload.mockResolvedValue({ data: { token: 'upload-token' }, error: null });
  io.sign.mockResolvedValue({
    data: { signedUrl: 'https://storage.example/private' },
    error: null,
  });
  io.info.mockResolvedValue({ data: { size: 16 }, error: null });
  io.remove.mockResolvedValue({ error: null });
  io.copy.mockResolvedValue({ error: null });
  io.fetch.mockResolvedValue(new Response(png));
  io.session.mockResolvedValue({
    phase: 'active',
    session: { id: 'shared-doc', generation: 'current', revision: 3, capabilities: { edit: true } },
  });
  io.export.mockResolvedValue({ id: 'export', revision: 3 });
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const writes = (prefix: string) =>
  io.sql.mock.calls.filter(([parts]) => Array.isArray(parts) && parts.join('?').startsWith(prefix));
describe('Studio shared persistence and media authority', () => {
  it('duplicates a project without inventing a missing brand logo', async () => {
    source.document.brand.logoAssetId = null;
    await duplicateProject('owner', 'original');
    const value = writes('insert into studio_state')[0][3] as any;
    expect(value.brand.logoAssetId).toBeNull();
    expect(io.copy).not.toHaveBeenCalled();
  });
  it('creates editable Yjs documents atomically and rechecks group authority inside the transaction', async () => {
    const value = createDocument('single', 'New project');
    const result = await createProject('owner', 'group', value);
    expect(io.group).toHaveBeenNthCalledWith(1, 'owner', 'group');
    expect(io.group).toHaveBeenNthCalledWith(2, 'owner', 'group', io.sql);
    const row = writes('insert into studio_state')[0];
    const y = new Y.Doc();
    Y.applyUpdate(y, row[2] as Uint8Array);
    expect(projectDocument('studio', y)).toEqual(value);
    y.destroy();
    expect(row[1]).toBe(result.id);
    expect(io.transaction).toHaveBeenCalledTimes(1);
    io.group.mockClear();
    await createProject('owner', null, value);
    expect(io.group).not.toHaveBeenCalled();
  });
  it('rejects foreign media before creating a project and deduplicates legitimate media references', async () => {
    const value = createDocument('single', 'Assets');
    const id = crypto.randomUUID();
    value.brand.logoAssetId = id;
    value.pages[0].elements.push(
      element('image', { assetId: id }),
      element('image', { assetId: id })
    );
    await expect(createProject('owner', null, value)).rejects.toThrow('A media file is missing');
    expect(io.transaction).not.toHaveBeenCalled();
    available = [{ id }];
    await validateAssets('project', value);
    expect(writes('select id from studio_asset').at(-1)![1]).toBe('project');
  });
  it('loads only the common collaboration session and queues exports on the confirmed revision', async () => {
    expect(await loadProject('owner', 'project')).toMatchObject({
      id: 'project',
      collaborationId: 'shared-doc',
      canEdit: true,
      revision: 3,
    });
    expect(io.session).toHaveBeenCalledWith('owner', {
      kind: 'studio',
      entityId: 'project',
      branchId: null,
      workspaceId: null,
    });
    expect(await queueExport('owner', 'project', 'pptx', ['page'], 'encoded')).toEqual({
      id: 'export',
      revision: 3,
    });
    expect(io.export).toHaveBeenCalledWith('owner', 'project', 'pptx', ['page'], 'encoded');
    io.session.mockResolvedValueOnce({ phase: 'maintenance' });
    await expect(loadProject('owner', 'project')).rejects.toThrow('collaboration_unavailable');
    io.session.mockResolvedValueOnce({ phase: 'active' });
    await expect(loadProject('owner', 'project')).rejects.toThrow('collaboration_unavailable');
  });
  it('reserves uploads under current rights and quotas before issuing a signed upload token', async () => {
    const result = await beginUpload('editor', 'project', 'Photo.png', 'image/png', 16);
    expect(result).toMatchObject({ path: `project/assets/${result.id}`, token: 'upload-token' });
    expect(io.access).toHaveBeenNthCalledWith(1, 'editor', 'project', true);
    expect(io.access).toHaveBeenNthCalledWith(2, 'editor', 'project', true, io.sql);
    expect(writes('insert into studio_asset')[0][0].join('?')).toContain('false');
    usage.count = 100;
    await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow(
      'Project media limit'
    );
    usage.count = 0;
    usage.bytes = 500 * 1024 * 1024;
    await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow(
      'Project media limit'
    );
  });
  it('removes the failed reservation when signing fails and denies upload after permission revocation', async () => {
    io.signUpload.mockResolvedValueOnce({ error: new Error('signing_failed') });
    await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow(
      'Cannot prepare upload'
    );
    expect(writes('delete from studio_asset')).toHaveLength(1);
    io.access.mockRejectedValueOnce(new Error('revoked'));
    io.signUpload.mockClear();
    await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow('revoked');
    expect(io.signUpload).not.toHaveBeenCalled();
  });
  it('validates stored size and actual file signatures before marking each supported media type ready', async () => {
    for (const [mime, bytes] of [
      ['image/png', png],
      ['image/jpeg', new Uint8Array([255, 216, 255])],
      ['image/webp', Buffer.from('RIFF0000WEBP')],
      ['video/mp4', Buffer.from('0000ftyp')],
    ] as const) {
      asset.mime_type = mime;
      io.fetch.mockResolvedValueOnce(new Response(bytes));
      expect(await finishUpload('editor', 'asset')).toEqual({ id: 'asset', mime });
      expect(io.fetch).toHaveBeenLastCalledWith('https://storage.example/private', {
        headers: { Range: 'bytes=0-15' },
      });
      expect(io.access).toHaveBeenLastCalledWith('editor', 'project', true, io.sql);
    }
    expect(writes('update studio_asset set ready=true')).toHaveLength(4);
  });
  it('fails media verification on missing or inconsistent object metadata and never makes it ready', async () => {
    io.info.mockResolvedValueOnce({ data: { size: 15 }, error: null });
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('unexpected size');
    io.info.mockResolvedValueOnce({ data: null, error: null });
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('incomplete');
    io.info.mockResolvedValueOnce({ error: new Error('storage_down') });
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('incomplete');
    io.sign.mockResolvedValueOnce({ error: true });
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('Cannot verify upload');
    io.fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('Cannot verify upload');
    io.fetch.mockResolvedValueOnce(new Response('unsupported'));
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('Supported media');
    asset.mime_type = 'image/jpeg';
    io.fetch.mockResolvedValueOnce(new Response(png));
    await expect(finishUpload('editor', 'asset')).rejects.toThrow('does not match');
    expect(writes('update studio_asset')).toHaveLength(0);
  });
  it('treats completed uploads idempotently and cancellation keeps the reservation until token expiry', async () => {
    asset.ready = true;
    expect(await finishUpload('editor', 'asset')).toEqual({ id: 'asset', mime: 'image/png' });
    expect(io.info).not.toHaveBeenCalled();
    asset.ready = false;
    await finishUpload('editor', 'asset', true);
    expect(io.remove).toHaveBeenCalledWith(['private/asset']);
    expect(writes('delete from studio_asset')).toHaveLength(0);
    current = [{ ready: true }];
    await expect(finishUpload('editor', 'asset', true)).rejects.toThrow(
      'Completed media cannot be cancelled'
    );
    current = [];
    await finishUpload('editor', 'asset', true);
    asset = null;
    await expect(finishUpload('editor', 'missing')).rejects.toThrow('Upload not found');
  });
  it('serves short-lived signed media and export links only after access checks', async () => {
    available = [asset];
    expect(await assetUrls('reader', 'project')).toEqual([
      { id: 'asset', name: 'Photo', mime: 'image/png', url: 'https://storage.example/private' },
    ]);
    expect(io.sign).toHaveBeenLastCalledWith('private/asset', 300);
    expect(await downloadExport('reader', 'export')).toEqual({
      url: 'https://storage.example/private',
      name: 'Result.png',
    });
    expect(io.sign).toHaveBeenLastCalledWith('private/export', 60, { download: 'Result.png' });
    io.sign.mockResolvedValueOnce({ error: true });
    await expect(assetUrls('reader', 'project')).rejects.toThrow('Cannot load media');
    io.sign.mockResolvedValueOnce({ error: true });
    await expect(downloadExport('reader', 'export')).rejects.toThrow('Download failed');
    job.status = 'running';
    await expect(downloadExport('reader', 'export')).rejects.toThrow('Export is not ready');
    job.status = 'completed';
    job.storage_path = null;
    await expect(downloadExport('reader', 'export')).rejects.toThrow('Export is not ready');
    job = null;
    await expect(downloadExport('reader', 'missing')).rejects.toThrow('Export not found');
  });
  it('copies private assets before exposing a new project and remaps image and logo references', async () => {
    const image = crypto.randomUUID();
    available = [{ ...asset, id: image }];
    source.document.brand.logoAssetId = image;
    source.document.pages[0].elements.push(element('image', { assetId: image }));
    const result = await duplicateProject('reader', 'original');
    const row = writes('insert into studio_state')[0],
      value = row[3] as any;
    const copiedId = writes('insert into studio_asset')[0][1];
    expect(value.brand.logoAssetId).toBe(copiedId);
    expect(value.pages[0].elements.at(-1).assetId).toBe(copiedId);
    expect(value.title).toBe('Original · Kopie');
    expect(row[1]).toBe(result.id);
    expect(io.access).toHaveBeenLastCalledWith('reader', 'original', false, io.sql);
    expect(io.group).toHaveBeenLastCalledWith('reader', 'group', io.sql);
    expect(io.copy.mock.invocationCallOrder[0]).toBeLessThan(
      io.transaction.mock.invocationCallOrder[0]
    );
  });
  it('cleans partial copies after storage or transaction failure and never exposes the incomplete copy', async () => {
    available = [
      { ...asset, id: crypto.randomUUID() },
      { ...asset, id: crypto.randomUUID() },
    ];
    io.copy.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: true });
    await expect(duplicateProject('reader', 'original')).rejects.toThrow('Cannot copy media');
    expect(io.remove).toHaveBeenCalledWith([expect.stringContaining('/assets/')]);
    expect(io.transaction).not.toHaveBeenCalled();
    io.remove.mockClear();
    failInsert = true;
    await expect(duplicateProject('reader', 'original')).rejects.toThrow('database_down');
    expect(io.remove).toHaveBeenCalledWith([
      expect.stringContaining('/assets/'),
      expect.stringContaining('/assets/'),
    ]);
    io.remove.mockClear();
    available = [];
    await expect(duplicateProject('reader', 'original')).rejects.toThrow('database_down');
    expect(io.remove).not.toHaveBeenCalled();
  });
  it('copies personal templates without group authority and clears references without a matching asset', async () => {
    source.group_id = null;
    source.document.brand.logoAssetId = crypto.randomUUID();
    source.document.pages[0].elements.push(element('image', { assetId: crypto.randomUUID() }));
    await duplicateProject('owner', 'original');
    const value = writes('insert into studio_state')[0][3] as any;
    expect(value.brand.logoAssetId).toBeNull();
    expect(value.pages[0].elements.at(-1).assetId).toBeNull();
    expect(io.group).not.toHaveBeenCalled();
  });
  it('allows publishing only completed Studio exports currently editable by the actor', async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: true }]),
      tx = () => ({ query });
    const id = crypto.randomUUID();
    await validateStudioStatementRefs(
      'editor',
      { image_url: `https://external.example/image`, video_url: null },
      tx
    );
    expect(query).not.toHaveBeenCalled();
    await validateStudioStatementRefs(
      'editor',
      {
        image_url: `/api/studio/published-media/${id}`,
        video_url: `/api/studio/published-media/${id}`,
      },
      tx
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status='completed'"), [
      id,
      'editor',
    ]);
    await expect(
      validateStudioStatementRefs('editor', { image_url: '/api/studio/published-media/bad' }, tx)
    ).rejects.toThrow('Invalid studio media');
    query.mockResolvedValueOnce([]);
    await expect(
      validateStudioStatementRefs('editor', { image_url: `/api/studio/published-media/${id}` }, tx)
    ).rejects.toThrow('Unknown studio export');
    query.mockResolvedValueOnce([{ allowed: false }]);
    await expect(
      validateStudioStatementRefs('reader', { image_url: `/api/studio/published-media/${id}` }, tx)
    ).rejects.toThrow('No access');
  });
});
