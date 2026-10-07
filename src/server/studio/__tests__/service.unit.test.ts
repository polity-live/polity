import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { element } from '@/features/communication-studio/logic/document';
import { POLITY_THEME } from '@/features/shared/appearance-theme';
import { createThemeSnapshot } from '@/features/communication-studio/logic/theme';
import type { StudioDocumentV3 } from '@/features/communication-studio/logic/document-v3';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '@/features/communication-studio/logic/v3-adapter';
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
  sharing: vi.fn(),
  synchronize: vi.fn(),
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => io.sql,
  studioTransaction: io.transaction,
  assertStudioAccess: io.access,
  assertStudioCollaborationAccess: io.access,
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
vi.mock('@/server/studio/export', () => ({ queueCommittedExport: io.export }));
vi.mock('../ai-sources', () => ({
  assertProjectAiSourceSharing: io.sharing,
}));
vi.mock('../elements', () => ({ synchronizeProjectElementInstances: io.synchronize }));
import {
  beginUpload,
  createProject,
  createProjectFromSelection,
  resolveStudioTheme,
  duplicateProject,
  finishUpload,
  validateAssets,
  validateStudioStatementRefs,
} from '../service';
let asset: any,
  available: any[],
  usage: any,
  current: any[],
  job: any,
  source: any,
  theme: any,
  template: any,
  loaded: any,
  failInsert: boolean;
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
beforeEach(() => {
  vi.resetAllMocks();
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
  source = {
    group_id: 'group',
    document: legacyDocumentToV3(createDocument('single', 'Original')),
  };
  template = { document: structuredClone(source.document), source_references: [] };
  theme = null;
  loaded = { document: source.document, content_revision: '7', can_edit: true, generation: 'live' };
  failInsert = false;
  Object.assign(io.sql, { json: (value: unknown) => value });
  io.sql.mockImplementation(
    async (parts: TemplateStringsArray | string[], ..._values: unknown[]) => {
      if (!('raw' in parts)) return parts;
      const sql = parts.join('?').trim();
      if (sql.includes('from appearance_theme t')) return theme ? [theme] : [];
      if (sql.includes('where p.id=? and p.is_template=true')) return template ? [template] : [];
      if (sql.includes('select s.document,s.content_revision')) return loaded ? [loaded] : [];
      if (sql.startsWith('select owner_id as id')) return [{ id: 'owner' }, { id: 'reader' }];
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
      if (
        sql.startsWith(
          'select project_id,format,status,progress,error,file_name from studio_export'
        )
      )
        return job ? [job] : [];
      if (sql.startsWith('select p.group_id')) return source ? [source] : [];
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
  io.sharing.mockReset().mockResolvedValue(undefined);
  io.synchronize.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const writes = (prefix: string) =>
  io.sql.mock.calls.filter(
    ([parts]) => Array.isArray(parts) && parts.join('?').trim().startsWith(prefix)
  );
const selection = (
  overrides: Partial<Parameters<typeof createProjectFromSelection>[1]> = {}
): Parameters<typeof createProjectFromSelection>[1] => ({
  groupId: null,
  title: 'Selected project',
  kind: 'single',
  themeId: POLITY_THEME.id,
  themeMode: 'dark',
  visibility: 'private',
  template: { kind: 'builtin', id: 'blank' },
  campaign: { weeks: 2, core: 1, stories: 1 },
  ...overrides,
});
const withMediaAndCharts = () => {
  const id = crypto.randomUUID();
  const missing = crypto.randomUUID();
  const legacy = createDocument('single', 'Template');
  legacy.pages[0].elements.push(
    element('image', { assetId: id }),
    element('image', { assetId: missing }),
    element('chart'),
    element('chart'),
    element('chart')
  );
  const document = legacyDocumentToV3(legacy);
  const charts = document.nodes.filter(node => node.type === 'chart');
  charts[0].sourceAssetId = id;
  charts[1].sourceAssetId = missing;
  return { document, id, missing };
};
describe('Studio template selection and authoritative project loading', () => {
  it.each(['light', 'dark'] as const)(
    'resolves the built-in theme in %s mode without database reads',
    async mode => {
      expect(await resolveStudioTheme('owner', null, POLITY_THEME.id, mode)).toEqual(
        createThemeSnapshot(POLITY_THEME, mode)
      );
      expect(io.sql).not.toHaveBeenCalled();
    }
  );
  it.each([null, 'Published personal theme'])(
    'validates a published custom theme with description %s',
    async description => {
      const id = crypto.randomUUID();
      const owner = crypto.randomUUID();
      const revision = crypto.randomUUID();
      theme = {
        id,
        slug: 'custom',
        name: 'Custom',
        description,
        kind: 'personal',
        group_id: null,
        created_by_id: owner,
        version: 2,
        revision_id: revision,
        light_palette: POLITY_THEME.light,
        dark_palette: POLITY_THEME.dark,
        fonts: POLITY_THEME.fonts,
        text_styles: POLITY_THEME.textStyles,
      };
      expect(await resolveStudioTheme(owner, null, id, 'dark')).toMatchObject({
        themeId: id,
        revisionId: revision,
        scope: 'personal',
        name: 'Custom',
        mode: 'dark',
      });
      expect(io.sql).toHaveBeenCalledWith(expect.anything(), id, owner, null);
      expect(io.sql.mock.calls[0][0].join('?')).toContain("r.status='published'");
    }
  );
  it('rejects a missing or invalid custom theme before creating storage objects', async () => {
    await expect(
      createProjectFromSelection('owner', selection({ themeId: crypto.randomUUID() }))
    ).rejects.toThrow('Theme not found or not published');
    theme = { id: 'invalid' };
    await expect(resolveStudioTheme('owner', null, 'custom', 'light')).rejects.toThrow();
    expect(io.transaction).not.toHaveBeenCalled();
    expect(io.copy).not.toHaveBeenCalled();
  });
  it.each([null, 'group'])(
    'creates a built-in project with group %s and the chosen theme',
    async groupId => {
      const result = await createProjectFromSelection('owner', selection({ groupId }));
      const document = writes('insert into studio_state')[0][2] as StudioDocumentV3;
      expect(document).toMatchObject({
        title: 'Selected project',
        kind: 'single',
        theme: {
          themeId: POLITY_THEME.id,
          mode: 'dark',
        },
      });
      expect(writes('insert into studio_project')[0][1]).toBe(result.id);
      expect(io.group).toHaveBeenCalledTimes(groupId ? 2 : 0);
      expect(io.sharing).not.toHaveBeenCalled();
      expect(io.copy).not.toHaveBeenCalled();
    }
  );
  it.each([null, 'group'])(
    'copies a saved template for group %s with media and chart remapping',
    async groupId => {
      const { document, id, missing } = withMediaAndCharts();
      template = { document, source_references: [{ type: 'blog', id: crypto.randomUUID() }] };
      const original = structuredClone(template);
      available = [{ ...asset, id }];
      const result = await createProjectFromSelection(
        'owner',
        selection({
          groupId,
          template: { kind: 'project', id: 'saved-template' },
        })
      );
      const stored = writes('insert into studio_state')[0][2] as StudioDocumentV3;
      const copied = writes('insert into studio_asset')[0];
      expect(stored.nodes.filter(node => node.type === 'media').map(node => node.assetId)).toEqual([
        copied[1],
      ]);
      expect(
        stored.nodes.filter(node => node.type === 'chart').map(node => node.sourceAssetId)
      ).toEqual([copied[1], null, null]);
      expect(stored.nodes.some(node => node.type === 'media' && node.assetId === missing)).toBe(
        false
      );
      expect(copied[2]).toBe(result.id);
      expect(template).toEqual(original);
      expect(io.sharing).toHaveBeenCalledWith(
        'saved-template',
        groupId ? ['owner', 'reader'] : ['owner'],
        'private',
        io.sql
      );
      expect(writes('insert into studio_project')[0][7]).toEqual(template.source_references);
      expect(io.copy.mock.invocationCallOrder[0]).toBeLessThan(
        io.transaction.mock.invocationCallOrder[0]
      );
    }
  );
  it('defaults missing template references to an empty list', async () => {
    template.source_references = null;
    await createProjectFromSelection(
      'owner',
      selection({ template: { kind: 'project', id: 'saved' } })
    );
    expect(writes('insert into studio_project')[0][7]).toEqual([]);
  });
  it('rejects a missing saved template or revoked template and group rights before copying', async () => {
    template = null;
    await expect(
      createProjectFromSelection('owner', selection({ template: { kind: 'project', id: 'gone' } }))
    ).rejects.toThrow('Studio template not found');
    io.access.mockRejectedValueOnce(new Error('revoked'));
    await expect(
      createProjectFromSelection(
        'owner',
        selection({ template: { kind: 'project', id: 'private' } })
      )
    ).rejects.toThrow('revoked');
    io.group.mockRejectedValueOnce(new Error('group revoked'));
    await expect(
      createProjectFromSelection('owner', selection({ groupId: 'group' }))
    ).rejects.toThrow('group revoked');
    expect(io.copy).not.toHaveBeenCalled();
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it('cleans already copied template assets after a later storage failure', async () => {
    available = [
      { ...asset, id: crypto.randomUUID() },
      { ...asset, id: crypto.randomUUID() },
    ];
    io.copy.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: true });
    await expect(
      createProjectFromSelection('owner', selection({ template: { kind: 'project', id: 'saved' } }))
    ).rejects.toThrow('Cannot copy template media');
    expect(io.remove).toHaveBeenCalledWith([expect.stringContaining('/assets/')]);
    expect(io.transaction).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'cleans a failed template transaction with copied assets %s',
    async copy => {
      available = copy ? [{ ...asset, id: crypto.randomUUID() }] : [];
      failInsert = true;
      await expect(
        createProjectFromSelection(
          'owner',
          selection({ template: { kind: 'project', id: 'saved' } })
        )
      ).rejects.toThrow('database_down');
      expect(io.remove).toHaveBeenCalledTimes(copy ? 1 : 0);
    }
  );
  it('cleans template assets when destination audience access changes inside the transaction', async () => {
    available = [{ ...asset, id: crypto.randomUUID() }];
    io.sharing.mockRejectedValueOnce(new Error('private source'));
    await expect(
      createProjectFromSelection('owner', selection({ template: { kind: 'project', id: 'saved' } }))
    ).rejects.toThrow('private source');
    expect(writes('insert into studio_project')).toHaveLength(0);
    expect(io.remove).toHaveBeenCalledTimes(1);
  });

  it('validates chart source assets and ignores charts without a source file', async () => {
    const { document, id, missing } = withMediaAndCharts();
    await expect(validateAssets('project', document)).rejects.toThrow('A media file is missing');
    available = [{ id }, { id: missing }];
    await validateAssets('project', document);
    expect(writes('select id from studio_asset')).toHaveLength(2);
  });
  it('handles upload signing errors without a status code', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      io.signUpload.mockResolvedValueOnce({ error: new Error('down') });
      await expect(beginUpload('editor', 'project', 'photo', 'image/png', 16)).rejects.toThrow(
        'Cannot prepare upload'
      );
      expect(log).toHaveBeenCalledWith('studio.upload.prepare', {
        bucket: 'studio',
        status: undefined,
        error: 'down',
      });
    } finally {
      log.mockRestore();
    }
  });
  it('rejects a deleted duplication source and remaps copied chart data sources', async () => {
    source = null;
    await expect(duplicateProject('owner', 'gone')).rejects.toThrow('Studio project not found');
    const { document, id } = withMediaAndCharts();
    source = { document, source_references: [{ id: 'reference' }] };
    available = [{ ...asset, id }];
    await duplicateProject('owner', 'source');
    const stored = writes('insert into studio_state')[0][2] as StudioDocumentV3;
    const copiedId = writes('insert into studio_asset')[0][1];
    expect(
      stored.nodes.filter(node => node.type === 'chart').map(node => node.sourceAssetId)
    ).toEqual([copiedId, null, null]);
    expect(writes('insert into studio_project')[0][7]).toEqual(source.source_references);
  });
});
describe('Studio shared persistence and media authority', () => {
  it('duplicates a V4 project without reintroducing removed brand data', async () => {
    await duplicateProject('owner', 'original');
    const value = writes('insert into studio_state')[0][2] as any;
    expect(value).not.toHaveProperty('brand');
    expect(io.copy).not.toHaveBeenCalled();
  });
  it('creates editable JSON documents atomically and rechecks group authority inside the transaction', async () => {
    const value = legacyDocumentToV3(createDocument('single', 'New project'));
    const result = await createProject('owner', 'group', value);
    expect(io.group).toHaveBeenNthCalledWith(1, 'owner', 'group', io.sql, true);
    expect(io.group).toHaveBeenNthCalledWith(2, 'owner', 'group', io.sql, true);
    const row = writes('insert into studio_state')[0];
    expect(row[2]).toEqual(value);
    expect(row[1]).toBe(result.id);
    expect(io.transaction).toHaveBeenCalledTimes(1);
    io.group.mockClear();
    await createProject('owner', null, value);
    expect(io.group).not.toHaveBeenCalled();
  });
  it('rejects foreign media before creating a project and deduplicates legitimate media references', async () => {
    const legacy = createDocument('single', 'Assets');
    const id = crypto.randomUUID();
    legacy.brand.logoAssetId = id;
    legacy.pages[0].elements.push(
      element('image', { assetId: id }),
      element('image', { assetId: id })
    );
    const value = legacyDocumentToV3(legacy);
    await expect(createProject('owner', null, value)).rejects.toThrow('A media file is missing');
    expect(io.transaction).not.toHaveBeenCalled();
    available = [{ id }];
    await validateAssets('project', value);
    expect(writes('select id from studio_asset').at(-1)![1]).toBe('project');
  });

  it('reserves uploads under current rights and quotas before issuing a signed upload token', async () => {
    const result = await beginUpload('editor', 'project', 'Photo.png', 'image/png', 16);
    expect(result).toMatchObject({ path: `project/assets/${result.id}`, token: 'upload-token' });
    expect(io.access).toHaveBeenNthCalledWith(1, 'editor', 'project', true, io.sql);
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
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      io.signUpload.mockResolvedValueOnce({
        error: Object.assign(new Error('signing_failed'), { statusCode: '404' }),
      });
      await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow(
        'Cannot prepare upload'
      );
      expect(log).toHaveBeenCalledWith('studio.upload.prepare', {
        bucket: 'studio',
        status: '404',
        error: 'signing_failed',
      });
      expect(writes('delete from studio_asset')).toHaveLength(1);
      io.access.mockRejectedValueOnce(new Error('revoked'));
      io.signUpload.mockClear();
      await expect(beginUpload('editor', 'project', 'p', 'image/png', 16)).rejects.toThrow(
        'revoked'
      );
      expect(io.signUpload).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
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

  it('copies private assets before exposing a new project and remaps media references', async () => {
    const image = crypto.randomUUID();
    available = [{ ...asset, id: image }];
    const legacy = v3DocumentToLegacy(source.document);
    legacy.pages[0].elements.push(element('image', { assetId: image }));
    source.document = legacyDocumentToV3(legacy, source.document);
    const result = await duplicateProject('reader', 'original', 'group');
    const row = writes('insert into studio_state')[0],
      value = row[2] as any;
    const copiedId = writes('insert into studio_asset')[0][1];
    expect(value).not.toHaveProperty('brand');
    expect(value.nodes.find((node: any) => node.type === 'media').assetId).toBe(copiedId);
    expect(value.title).toBe('Original · Kopie');
    expect(row[1]).toBe(result.id);
    expect(io.access).toHaveBeenLastCalledWith('reader', 'original', false, io.sql);
    expect(io.group).toHaveBeenLastCalledWith('reader', 'group', io.sql, true);
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
    const legacy = v3DocumentToLegacy(source.document);
    legacy.pages[0].elements.push(element('image', { assetId: crypto.randomUUID() }));
    source.document = legacyDocumentToV3(legacy, source.document);
    await duplicateProject('owner', 'original');
    const value = writes('insert into studio_state')[0][2] as any;
    expect(value).not.toHaveProperty('brand');
    expect(value.nodes.some((node: any) => node.type === 'media')).toBe(false);
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
