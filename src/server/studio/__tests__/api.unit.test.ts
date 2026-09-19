import { beforeEach, describe, it, expect, vi } from 'vitest';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { createDocument } from '@/features/communication-studio/logic/templates';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  enabled: vi.fn(),
  transaction: vi.fn(),
  sql: vi.fn(),
  group: vi.fn(),
  access: vi.fn(),
  load: vi.fn(),
  assets: vi.fn(),
  create: vi.fn(),
  download: vi.fn(),
  export: vi.fn(),
  duplicate: vi.fn(),
  beginUpload: vi.fn(),
  finishUpload: vi.fn(),
  source: vi.fn(),
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
}));
vi.mock('../service', () => ({
  loadProject: mocks.load,
  assetUrls: mocks.assets,
  createProject: mocks.create,
  downloadExport: mocks.download,
  queueExport: mocks.export,
  duplicateProject: mocks.duplicate,
  beginUpload: mocks.beginUpload,
  finishUpload: mocks.finishUpload,
}));
vi.mock('../sources', () => ({ studioSource: mocks.source }));
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
    mocks.create,
    mocks.download,
    mocks.export,
    mocks.duplicate,
    mocks.beginUpload,
    mocks.finishUpload,
    mocks.source,
  ])
    handler.mockResolvedValue({ id });
  mocks.catalog.mockResolvedValue({ models: ['configured'] });
  mocks.preferred.mockReturnValue('configured');
  mocks.model.mockResolvedValue({ model: 'language-model', providerOptions: {} });
});
describe('Studio HTTP authorization and transactional operations', () => {
  it('validates commands and forwards only the authenticated actor to shared project and media services', async () => {
    expect(await (await request({ operation: 'config' })).json()).toEqual({ enabled: true });
    const document = createDocument('single', 'API draft');
    for (const [operation, handler, extra, args] of [
      [
        'beginUpload',
        mocks.beginUpload,
        { projectId: id, name: 'image.png', mime: 'image/png', size: 16 },
        ['actor', id, 'image.png', 'image/png', 16],
      ],
      ['finishUpload', mocks.finishUpload, {}, ['actor', id, false]],
      ['cancelUpload', mocks.finishUpload, {}, ['actor', id, true]],
      ['create', mocks.create, { groupId: null, document }, ['actor', null, document]],
      ['assets', mocks.assets, {}, ['actor', id]],
      ['load', mocks.load, {}, ['actor', id]],
      ['duplicate', mocks.duplicate, {}, ['actor', id]],
      ['download', mocks.download, {}, ['actor', id]],
      [
        'export',
        mocks.export,
        { projectId: id, format: 'pptx', state: 'saved' },
        ['actor', id, 'pptx', [], 'saved'],
      ],
      ['sources', mocks.source, { type: 'event' }, ['actor', 'event', id]],
    ] as const) {
      handler.mockResolvedValue({ id });
      const response = await request({ operation, id, ...extra, userId: 'forged' });
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenLastCalledWith(...args);
      expect(await response.json()).toEqual({ id });
    }
    await request({ operation: 'sources', type: 'statement' });
    expect(mocks.source).toHaveBeenLastCalledWith('actor', 'statement', undefined);
  });
  it('hands off only completed single image or video exports using their immutable revision and story pages', async () => {
    const document = createDocument('story', 'Story');
    const page = document.pages[0].id;
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
    const single = createDocument('single', 'Single');
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
  it('returns AI output only as a validated draft and never writes generated content without user adoption', async () => {
    const draft = {
      title: 'Entwurf',
      posts: [
        {
          title: 'Termin',
          action: '[TODO]',
          instagram: 'Kurz',
          linkedin: 'Ausführlich',
          facebook: 'Gespräch',
          slides: [{ title: 'Titel', text: 'Text' }],
        },
      ],
    };
    mocks.generate.mockResolvedValue({ text: '```json\n' + JSON.stringify(draft) + '\n```' });
    const response = await request({ operation: 'generate', prompt: 'Nur bereitgestellte Fakten' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(draft);
    expect(mocks.model).toHaveBeenCalledWith('actor', 'configured', 'low');
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Nur bereitgestellte Fakten',
        model: 'language-model',
        maxOutputTokens: 6000,
      })
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.preferred.mockReturnValueOnce(null);
    expect((await request({ operation: 'generate', prompt: 'Missing model' })).status).toBe(400);
    mocks.generate.mockResolvedValueOnce({ text: '{"title":5,"posts":[]}' });
    expect((await request({ operation: 'generate', prompt: 'Invalid output' })).status).toBe(400);
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
    expect((await request({ operation: 'template', id, value: true })).status).toBe(200);
    mocks.access.mockRejectedValueOnce(new StudioError('Revoked', 403));
    const before = mocks.sql.mock.calls.length;
    expect((await request({ operation: 'template', id, value: false })).status).toBe(403);
    expect(mocks.sql).toHaveBeenCalledTimes(before);
  });
  it('preserves projects whose media is published or whose export is still running', async () => {
    mocks.sql.mockResolvedValueOnce([{ id }]);
    expect((await request({ operation: 'delete', id })).status).toBe(400);
    mocks.sql.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id }]);
    expect((await request({ operation: 'delete', id })).status).toBe(400);
    expect(mocks.sql.mock.calls.every(([sql]) => !sql.join('').includes('delete from'))).toBe(true);
    mocks.sql.mockResolvedValue([]);
    expect((await request({ operation: 'delete', id })).status).toBe(200);
    expect(mocks.sql.mock.lastCall?.[0].join('')).toContain('delete from studio_project');
  });
});
