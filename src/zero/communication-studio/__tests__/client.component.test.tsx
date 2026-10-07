// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  zero: null as any,
  rows: {} as any,
  receipt: {} as any,
  views: [] as any[],
  upload: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => io.zero }));
vi.mock('../queries', () => ({}));
vi.mock('@/zero/queries', () => ({
  queries: { studio: new Proxy({}, { get: (_t, name) => (args: unknown) => ({ name, args }) }) },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    studio: new Proxy(
      {},
      {
        get: (_t, name) =>
          name === 'canvas'
            ? { command: (args: unknown) => ({ name: 'canvas', args }) }
            : (args: unknown) => ({ name, args }),
      }
    ),
  },
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: io.upload }) } }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: io.toast } }));
import { createStudioClient, useStudioClient } from '../useStudioClient';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { legacyDocumentToV3 } from '@/features/communication-studio/logic/v3-adapter';
let client: ReturnType<typeof createStudioClient>;
const id = crypto.randomUUID();
const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  io.views = [];
  const document = legacyDocumentToV3(createDocument('single', 'Client'));
  const owner = { id: 'actor', first_name: 'Ada', last_name: null };
  io.rows = {
    sessionProject: { id, group_id: null, owner_id: 'actor', owner, collaborators: [] },
    control: { phase: 'edit', generation: id },
    proposals: [{ readers: [{ user_id: 'actor' }] }],
    comments: [],
    history: [{ id, revision: 3, created_at: 1 }],
    manageGroups: [{ id, name: 'Group' }],
    document: { document, content_revision: 3 },
    workspace: {
      document,
      base_document: document,
      revision: 1,
      ai_status: 'ready',
      owner_id: 'actor',
      state: 'draft',
      readers: [],
      resolves_id: null,
    },
    assets: [{ id, name: 'Media', mime_type: 'image/png' }],
    themes: [{ id, current_revision: { id: 'rev' } }, { id: 'bare' }],
    elementSets: [
      { id, name: 'Set', group_id: id, current_revision: { id: 'rev', version: 1 } },
      { id: 'bare', group_id: null },
    ],
    collaborators: [
      { id, user_id: 'collaborator', status: 'active', user: { first_name: 'Peer' } },
    ],
    invitations: [
      { id, project_id: id, project: { title: 'Invite', owner_id: 'owner', owner } },
      { id: 'bare' },
    ],
    libraries: [],
    export: {
      id,
      file_name: 'media.png',
      status: 'completed',
      page_ids: [],
      revision: { document },
    },
    editorActions: [],
  };
  io.receipt = {
    result: { id, path: 'private', token: 'secret', mime: 'image/png' },
    expires_at: null,
  };
  io.zero = {
    context: { userID: 'actor' },
    mutate: vi.fn(() => ({ server: Promise.resolve({ type: 'success' }) })),
    run: vi.fn(async (query: any) => io.rows[query.name]),
    materialize: vi.fn((query: any) => {
      const view = {
        query,
        listener: undefined as any,
        destroy: vi.fn(),
        addListener: (listener: any) => {
          view.listener = listener;
          listener(
            query.name === 'commandReceipt' ||
              query.name === 'canvasReceipt' ||
              query.name === 'operation'
              ? io.receipt
              : io.rows[query.name]
          );
          return () => undefined;
        },
      };
      io.views.push(view);
      return view;
    }),
  };
  io.upload.mockResolvedValue({ error: null });
  client = createStudioClient(io.zero);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('waits for server acknowledgement and a replicated result, retaining identifiers for ambiguous retries', async () => {
  let confirm!: (value: unknown) => void;
  io.zero.mutate.mockReturnValueOnce({
    server: new Promise(resolve => {
      confirm = resolve;
    }),
  });
  io.receipt = undefined;
  const pending = client.create({ groupId: null, title: 'New' } as never);
  expect(io.zero.materialize).not.toHaveBeenCalled();
  confirm({ type: 'success' });
  await flush();
  const first = io.zero.mutate.mock.lastCall[0].args;
  expect(first.id).toBe(first.operationId);
  io.views[0].listener({ result: { id: first.id }, expires_at: null });
  expect(await pending).toEqual({ id: first.id });
  expect(io.views[0].destroy).toHaveBeenCalledOnce();
  vi.useFakeTimers();
  const abandoned = client.duplicate({ id });
  const rejected = expect(abandoned).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(30_000);
  await rejected;
  const previous = io.zero.mutate.mock.lastCall[0].args;
  io.receipt = { result: { id: previous.destinationId }, expires_at: null };
  expect(await createStudioClient(io.zero).duplicate({ id })).toEqual({
    id: previous.destinationId,
  });
  expect(io.zero.mutate.mock.lastCall[0].args).toEqual(previous);
  expect(sessionStorage.length).toBe(0);
});
it('uses every concrete mutator including explicit identifiers and propagates server and expiry failures', async () => {
  for (const name of [
    'create',
    'duplicate',
    'beginUpload',
    'requestExport',
    'setVisibility',
    'setTemplate',
    'delete',
    'inviteCollaborators',
    'respondInvitation',
    'removeCollaborator',
    'finishUpload',
    'cancelUpload',
    'cancelExport',
    'createElementSet',
    'instantiateElementSet',
    'renameElementSet',
    'archiveElementSet',
    'publishElementSet',
    'synchronizeElements',
    'claimEditorActions',
    'completeEditorAction',
  ]) {
    await (client as any)[name]({ id, destinationId: id, operationId: id });
    expect(io.zero.mutate.mock.lastCall[0]).toMatchObject({ name, args: { operationId: id } });
  }
  await client.beginUpload({ projectId: id } as never);
  await client.requestExport({ projectId: id } as never);
  await client.canvas({
    projectId: id,
    action: 'withdraw',
    workspaceId: id,
    generation: id,
    operationId: id,
  });
  expect(io.zero.mutate.mock.lastCall[0].name).toBe('canvas');
  await client.operation({ projectId: id, id });
  expect(io.zero.materialize.mock.lastCall[0].name).toBe('operation');
  io.receipt = { result: {}, expires_at: Date.now() - 1 };
  await expect(client.setTemplate({ id, value: true })).rejects.toThrow('expired');
  io.zero.mutate.mockReturnValueOnce({ server: Promise.reject(new Error('rejected')) });
  await expect(client.delete({ id })).rejects.toThrow('rejected');
});
it('reads authorized document and procedure projections, with no mutations during queries', async () => {
  expect(await client.load({ id })).toMatchObject({ canEdit: true, revision: 3, generation: id });
  expect(await client.session({ projectId: id })).toMatchObject({
    adoptionGroups: [{ id, name: 'Group' }],
    proposals: [{ shared_ids: ['actor'] }],
  });
  expect(await client.assets({ id })).toEqual([
    { id, name: 'Media', mime: 'image/png', url: `/api/studio/media/${id}` },
  ]);
  expect(await client.themes({ groupId: null })).toMatchObject([
    { id, revision_id: 'rev' },
    { id: 'bare' },
  ]);
  expect(await client.elementSets({ groupId: null })).toMatchObject([
    { scope: 'group' },
    { scope: 'personal' },
  ]);
  expect(await client.collaborators({ projectId: id })).toMatchObject([
    { first_name: 'Peer', status: 'active' },
  ]);
  expect(await client.invitations()).toMatchObject([{ title: 'Invite' }, { id: 'bare' }]);
  expect(await client.libraries({ groupId: null })).toEqual([]);
  expect(await client.exportStatus({ id })).toMatchObject({ status: 'completed' });
  expect(await client.loadDraft({ projectId: id, workspaceId: id })).toMatchObject({
    canEdit: true,
  });
  io.rows.control.phase = 'suggest_internal';
  io.rows.workspace.owner_id = 'other';
  io.rows.workspace.readers = [{ user_id: 'actor' }];
  expect((await client.loadDraft({ projectId: id, workspaceId: id })).canEdit).toBe(true);
  io.rows.control.phase = 'vote_internal';
  io.rows.workspace.resolves_id = id;
  expect((await client.loadDraft({ projectId: id, workspaceId: id })).canEdit).toBe(true);
  io.rows.workspace.resolves_id = null;
  expect((await client.loadDraft({ projectId: id, workspaceId: id })).canEdit).toBe(false);
  io.rows.workspace.readers = [];
  io.rows.control.phase = 'edit';
  expect((await client.loadDraft({ projectId: id, workspaceId: id })).canEdit).toBe(false);
  io.rows.workspace.state = 'closed';
  expect((await client.loadDraft({ projectId: id, workspaceId: id })).canEdit).toBe(false);
  io.rows.sessionProject.owner_id = 'other';
  expect((await client.session({ projectId: id })).adoptionGroups).toEqual([]);
  io.rows.sessionProject.group_id = id;
  expect((await client.session({ projectId: id })).adoptionGroups).toEqual([]);
  for (const value of [undefined, { ai_status: 'generating' }]) {
    io.rows.workspace = value;
    await expect(client.loadDraft({ projectId: id, workspaceId: id })).rejects.toThrow(
      'unavailable'
    );
  }
  io.rows.document = undefined;
  await expect(client.load({ id })).rejects.toThrow('unavailable');
  io.rows.control = undefined;
  await expect(client.session({ projectId: id })).rejects.toThrow('unavailable');
  io.rows.sessionProject = undefined;
  await expect(client.session({ projectId: id })).rejects.toThrow('unavailable');
  io.rows.export = undefined;
  await expect(client.exportStatus({ id })).rejects.toThrow('unavailable');
  expect(io.zero.mutate).not.toHaveBeenCalled();
});
it('subscribes to changes and destroys every view when the session, assets or editor unsubscribe', async () => {
  const next = vi.fn(),
    failed = vi.fn();
  const stop = client.watchSession({ projectId: id }, next, failed);
  await flush();
  expect(next).toHaveBeenCalled();
  stop();
  expect(io.views.every(v => v.destroy.mock.calls.length === 1)).toBe(true);
  const changed = vi.fn();
  const stopEditor = client.watchEditorActions({ projectId: id }, changed);
  expect(changed).not.toHaveBeenCalled();
  io.views.at(-1).listener([{}]);
  expect(changed).toHaveBeenCalledOnce();
  stopEditor();
  const stopAssets = client.watchAssets({ id }, changed);
  expect(changed).toHaveBeenCalledTimes(2);
  stopAssets();
  const hook = renderHook(useStudioClient);
  expect(hook.result.current.create).toBeTypeOf('function');
  hook.rerender();
});
it('derives media handoff only from completed single-page or video exports', async () => {
  expect(await client.handoff({ id })).toMatchObject({
    imageUrl: `/api/studio/published-media/${id}`,
    videoUrl: '',
    isStory: false,
  });
  io.rows.export.revision.document = legacyDocumentToV3(createDocument('story', 'Story'));
  expect((await client.handoff({ id })).isStory).toBe(true);
  io.rows.export.page_ids = [id];
  expect((await client.handoff({ id })).isStory).toBe(false);
  io.rows.export.file_name = 'video.mp4';
  io.rows.export.page_ids = [id];
  expect(await client.handoff({ id })).toMatchObject({
    videoUrl: `/api/studio/published-media/${id}`,
    imageUrl: '',
  });
  io.rows.export.file_name = 'many.zip';
  await expect(client.handoff({ id })).rejects.toThrow('single page');
  io.rows.export.status = 'running';
  await expect(client.handoff({ id })).rejects.toThrow('not ready');
  io.rows.export.status = 'completed';
  io.rows.export.file_name = null;
  await expect(client.handoff({ id })).rejects.toThrow('not ready');
  io.rows.export.file_name = 'media.png';
  io.rows.export.revision = null;
  await expect(client.handoff({ id })).rejects.toThrow('not ready');
});
it('uploads directly to signed Storage, cancels failures and preserves the original error', async () => {
  const file = new File(['png'], 'media.png', { type: 'image/png' });
  expect(await client.upload(id, file)).toMatchObject({ id, mime: 'image/png' });
  expect(io.upload).toHaveBeenCalledWith('private', 'secret', file, { contentType: 'image/png' });
  io.upload.mockResolvedValueOnce({ error: new Error('offline') });
  await expect(client.upload(id, file, id)).rejects.toThrow('Media upload failed');
  io.upload.mockRejectedValueOnce(new Error('network'));
  io.zero.mutate.mockImplementation((query: any) => ({
    server:
      query.name === 'cancelUpload'
        ? Promise.reject(new Error('cancel failed'))
        : Promise.resolve({ type: 'success' }),
  }));
  await expect(client.upload(id, file)).rejects.toThrow('network');
  client.notifyError(new Error('Denied'));
  client.notifyError(null);
  expect(io.toast.mock.calls).toEqual([['Denied'], ['Studio request failed']]);
});
