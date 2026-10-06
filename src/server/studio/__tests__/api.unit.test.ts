import { beforeEach, describe, it, expect, vi } from 'vitest';
import { StudioError as CollaborationError } from '../db';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  enabled: vi.fn(),
  transaction: vi.fn(),
  sql: vi.fn(),
  group: vi.fn(),
  access: vi.fn(),
  load: vi.fn(),
  assets: vi.fn(),
  createSelection: vi.fn(),
  download: vi.fn(),
  exportStatus: vi.fn(),
  export: vi.fn(),
  duplicate: vi.fn(),
  beginUpload: vi.fn(),
  finishUpload: vi.fn(),
  catalog: vi.fn(),
  model: vi.fn(),
  preferred: vi.fn(),
  generate: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.session }));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioEnabled: mocks.enabled,
  studioTransaction: mocks.transaction,
  assertStudioGroup: mocks.group,
  assertStudioAccess: mocks.access,
  assertStudioCollaborationAccess: mocks.access,
}));
vi.mock('../service', () => ({
  loadProject: mocks.load,
  assetUrls: mocks.assets,
  createProjectFromSelection: mocks.createSelection,
  downloadExport: mocks.download,
  exportStatus: mocks.exportStatus,
  queueExport: mocks.export,
  duplicateProject: mocks.duplicate,
  beginUpload: mocks.beginUpload,
  finishUpload: mocks.finishUpload,
}));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: mocks.catalog,
  resolveLanguageModelForUser: mocks.model,
}));
vi.mock('@/lib/ai/models', () => ({
  getPreferredDefaultAiModel: mocks.preferred,
  toAiModelDescriptor: (model: unknown) => model,
}));
vi.mock('ai', () => ({ generateText: mocks.generate }));
import { handleStudio } from '../api';
import { StudioError } from '../db';
const id = '0c386bc0-aed7-4d94-ac67-e3fb1bbcfce1';
const request = (body: object, headers?: Record<string, string>) =>
  handleStudio(
    new Request('http://localhost:3000/api/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'actor' } });
  mocks.enabled.mockReturnValue(true);
  mocks.transaction.mockImplementation(body => body(mocks.sql));
  mocks.sql.mockResolvedValue([]);
  mocks.access.mockResolvedValue(undefined);
  mocks.group.mockResolvedValue(undefined);
  for (const handler of [
    mocks.createSelection,
    mocks.download,
    mocks.exportStatus,
    mocks.export,
    mocks.duplicate,
    mocks.beginUpload,
    mocks.finishUpload,
  ])
    handler.mockResolvedValue({ id });
  mocks.catalog.mockResolvedValue({ models: ['configured'] });
  mocks.preferred.mockReturnValue('configured');
  mocks.model.mockResolvedValue({ model: 'language-model', providerOptions: {} });
});
describe('Studio HTTP authorization and transactional operations', () => {
  it('validates commands and forwards only the authenticated actor to shared project and media services', async () => {
    expect(await (await request({ operation: 'config' })).json()).toEqual({ enabled: true });
    const createInput = {
      groupId: null,
      title: 'API draft',
      kind: 'single',
      themeId: '00000000-0000-4000-8000-000000000001',
      themeMode: 'light',
      template: { kind: 'builtin', id: 'announcement' },
      campaign: { weeks: 4, core: 3, stories: 2 },
    } as const;
    for (const [operation, handler, extra, args] of [
      [
        'beginUpload',
        mocks.beginUpload,
        { projectId: id, name: 'image.png', mime: 'image/png', size: 16 },
        ['actor', id, 'image.png', 'image/png', 16, undefined],
      ],
      ['finishUpload', mocks.finishUpload, {}, ['actor', id, false]],
      ['cancelUpload', mocks.finishUpload, {}, ['actor', id, true]],
      [
        'create',
        mocks.createSelection,
        createInput,
        ['actor', { ...createInput, visibility: 'private' }],
      ],
      ['assets', mocks.assets, {}, ['actor', id, undefined]],
      ['load', mocks.load, {}, ['actor', id]],
      ['duplicate', mocks.duplicate, {}, ['actor', id, null, 'private']],
      ['download', mocks.download, {}, ['actor', id]],
      ['exportStatus', mocks.exportStatus, {}, ['actor', id]],
      [
        'export',
        mocks.export,
        { projectId: id, format: 'pptx', revision: 0 },
        ['actor', id, 'pptx', [], 0],
      ],
    ] as const) {
      handler.mockResolvedValue({ id });
      const response = await request({ operation, id, ...extra, userId: 'forged' });
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenLastCalledWith(...args);
      expect(await response.json()).toEqual({ id });
    }
  });
  it('forwards clone destination and visibility after validation', async () => {
    const destination = '00000000-0000-4000-8000-000000000002';
    const response = await request({
      operation: 'duplicate',
      id,
      groupId: destination,
      visibility: 'authenticated',
    });
    expect(response.status).toBe(200);
    expect(mocks.duplicate).toHaveBeenCalledWith('actor', id, destination, 'authenticated');
  });
  it('hands off only completed single image or video exports using their immutable revision and story pages', async () => {
    const legacy = createDocument('story', 'Story');
    const document = legacyDocumentToV3(legacy);
    const page = legacy.pages[0].id;
    for (const [name, pageIds] of [
      ['preview.png', []],
      ['video.mp4', [page]],
    ] as const) {
      mocks.sql
        .mockResolvedValueOnce([
          { id, project_id: id, file_name: name, revision_id: id, page_ids: pageIds },
        ])
        .mockResolvedValueOnce([{ document }]);
      const response = await request({ operation: 'handoff', id });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        imageUrl: name.endsWith('png') ? `/api/studio/published-media/${id}` : '',
        videoUrl: name.endsWith('mp4') ? `/api/studio/published-media/${id}` : '',
        isStory: true,
      });
      expect(mocks.access).toHaveBeenLastCalledWith('actor', id, true, mocks.sql);
    }
    for (const rows of [[], [{ project_id: id, file_name: 'campaign.zip' }]]) {
      mocks.sql.mockResolvedValueOnce(rows);
      expect((await request({ operation: 'handoff', id })).status).toBe(400);
    }
    const single = legacyDocumentToV3(createDocument('single', 'Single'));
    mocks.sql
      .mockResolvedValueOnce([
        { id, project_id: id, file_name: 'preview.png', revision_id: id, page_ids: [] },
      ])
      .mockResolvedValueOnce([{ document: single }]);
    expect(await (await request({ operation: 'handoff', id })).json()).toMatchObject({
      isStory: false,
    });
    mocks.sql.mockResolvedValueOnce([]);
    expect((await request({ operation: 'cancel', id })).status).toBe(404);
  });
  it('does not expose the retired direct AI generation endpoint', async () => {
    const response = await request({ operation: 'generate', prompt: 'Nur bereitgestellte Fakten' });
    expect(response.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createSelection).not.toHaveBeenCalled();
  });
  it('does not disclose internal service failures in public error responses', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      for (const error of [new Error('private database detail'), 'non-error rejection']) {
        mocks.load.mockRejectedValueOnce(error);
        const response = await request({ operation: 'load', id });
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error: 'Studio request failed. Please try again.',
        });
      }
    } finally {
      log.mockRestore();
    }
  });
  it('preserves shared collaboration denials and revision conflicts at the Studio HTTP boundary', async () => {
    for (const [code, status] of [
      ['access_denied', 403],
      ['wait_for_saved_revision', 409],
      ['collaboration_unavailable', 503],
    ] as const) {
      mocks.load.mockRejectedValueOnce(new CollaborationError(code, status));
      const response = await request({ operation: 'load', id });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code });
    }
  });
  it('returns published group themes from the same transaction that checks access', async () => {
    const themes = [{ id, name: 'Group brand', revision_id: id, fonts: { heading: 'Newsreader' } }];
    mocks.sql.mockResolvedValue(themes);
    const response = await request({ operation: 'themes', groupId: id });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(themes);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.group).toHaveBeenCalledWith('actor', id, mocks.sql);
    expect(mocks.sql.mock.calls[0][0].join('')).toContain("r.status='published'");
  });
  it('rejects group access before querying themes and never serializes an undefined success', async () => {
    mocks.group.mockRejectedValue(new StudioError('No access', 403));
    const response = await request({ operation: 'themes', groupId: id });
    expect(response.status).toBe(403);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('rejects cross-origin, anonymous, disabled and malformed operations before writes', async () => {
    expect(
      (await request({ operation: 'config' }, { origin: 'https://elsewhere.invalid' })).status
    ).toBe(403);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.session.mockResolvedValueOnce(null);
    expect((await request({ operation: 'config' })).status).toBe(401);
    mocks.enabled.mockReturnValueOnce(false);
    expect((await request({ operation: 'config' })).status).toBe(404);
    for (const body of [
      {},
      null,
      { operation: 'unknown' },
      { operation: 'themes', groupId: 'invalid' },
    ])
      expect((await request(body as object)).status).toBe(400);
    expect(
      (
        await handleStudio(
          new Request('http://localhost:3000/api/studio', { method: 'POST', body: 'invalid JSON' })
        )
      ).status
    ).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it('serializes export cancellation and template changes with current project rights', async () => {
    mocks.sql.mockResolvedValueOnce([{ project_id: id }]).mockResolvedValueOnce([]);
    expect((await request({ operation: 'cancel', id })).status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith('actor', id, true, mocks.sql);
    expect(mocks.sql.mock.calls[1][0].join('')).toContain("status in ('queued','running')");
    mocks.sql.mockResolvedValueOnce([{ owner_id: 'actor', group_id: null }]);
    expect((await request({ operation: 'template', id, value: true })).status).toBe(200);
    mocks.access.mockRejectedValueOnce(new StudioError('Revoked', 403));
    const before = mocks.sql.mock.calls.length;
    expect((await request({ operation: 'template', id, value: false })).status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(before);
  });
  it('preserves projects whose media is published or whose export is still running', async () => {
    mocks.sql
      .mockResolvedValueOnce([{ owner_id: 'actor', group_id: null }])
      .mockResolvedValueOnce([{ id }]);
    expect((await request({ operation: 'delete', id })).status).toBe(400);
    mocks.sql
      .mockResolvedValueOnce([{ owner_id: 'actor', group_id: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id }]);
    expect((await request({ operation: 'delete', id })).status).toBe(400);
    expect(mocks.sql.mock.calls.every(([sql]) => !sql.join('').includes('delete from'))).toBe(true);
    mocks.sql.mockResolvedValue([]);
    mocks.sql.mockResolvedValueOnce([{ owner_id: 'actor', group_id: null }]);
    expect((await request({ operation: 'delete', id })).status).toBe(200);
    expect(mocks.sql.mock.lastCall?.[0].join('')).toContain('delete from studio_project');
  });
  it('does not let an active personal collaborator manage the project', async () => {
    mocks.sql.mockResolvedValueOnce([{ owner_id: 'owner', group_id: null }]);
    expect((await request({ operation: 'template', id, value: true })).status).toBe(403);
    mocks.sql.mockResolvedValueOnce([{ owner_id: 'owner', group_id: null }]);
    expect((await request({ operation: 'delete', id })).status).toBe(403);
    expect(
      mocks.sql.mock.calls.every(([sql]) => !sql.join('').includes('delete from studio_project'))
    ).toBe(true);
  });
});
