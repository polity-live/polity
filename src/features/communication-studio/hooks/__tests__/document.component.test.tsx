/* @vitest-environment jsdom */
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { vi, beforeEach, afterEach, it, expect } from 'vitest';
import { createDocument } from '../../logic/templates';
import { mergeStudioV3 } from '../../logic/operations';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { studioDocumentV3Schema } from '../../logic/document-v3';
const io = vi.hoisted(() => ({
  remote: undefined as any,
  server: undefined as any,
  revision: 0,
  receipt: undefined as any,
  mutate: vi.fn(),
  request: vi.fn(),
  fetch: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: (query: { workspaceId?: string } | undefined) => [
    query ? io.remote : undefined,
    query?.workspaceId ? { type: 'complete' } : undefined,
  ],
}));
vi.mock('@/zero/queries', () => ({
  queries: { studio: { document: (v: unknown) => v, workspace: (v: unknown) => v } },
}));
vi.mock('@/zero/mutators', () => ({ mutators: { studio: { apply: (v: unknown) => v } } }));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ studioRequest: io.request }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) },
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channel: () => {
      const c = {
        on: () => c,
        subscribe: () => c,
        track: vi.fn(),
        unsubscribe: vi.fn(),
        send: vi.fn(),
        presenceState: () => ({}),
      };
      return c;
    },
  }),
}));
import { useStudioDocument } from '../useStudioDocument';
const id = '10000000-0000-4000-8000-000000000001',
  user = { id: '10000000-0000-4000-8000-000000000002', name: 'User' };
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', io.fetch);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: io.createObjectURL,
    revokeObjectURL: io.revokeObjectURL,
  });
  io.fetch.mockReset();
  io.createObjectURL.mockReset().mockReturnValue('blob:studio-media');
  io.revokeObjectURL.mockReset();
  io.server = legacyDocumentToV3(createDocument('single', 'Initial'));
  io.remote = undefined;
  io.revision = 0;
  io.mutate.mockReset().mockImplementation(args => {
    const merged = mergeStudioV3(io.server, args.changes);
    if (!merged.conflicts.length) {
      io.server = merged.value;
      io.revision++;
    }
    io.receipt = {
      status: merged.conflicts.length ? 'conflict' : 'applied',
      document: io.server,
      revision: io.revision,
      conflicts: merged.conflicts,
    };
    return { server: Promise.resolve({ type: 'success' }) };
  });
  io.request
    .mockReset()
    .mockImplementation(async op =>
      op === 'load'
        ? { document: structuredClone(io.server), revision: io.revision, canEdit: true }
        : op === 'canvasPresence'
          ? { peers: [] }
          : op === 'receipt'
            ? io.receipt
            : []
    );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps a server-authorized draft editable while its Zero workspace query is still empty', async () => {
  io.request.mockImplementation(async op =>
    op === 'canvas'
      ? { document: structuredClone(io.server), revision: 0, generation: 'test', canEdit: true }
      : op === 'assets'
        ? []
        : op === 'canvasPresence'
          ? { peers: [] }
          : []
  );
  const workspaceId = crypto.randomUUID();
  const hook = renderHook(() => useStudioDocument(id, user, workspaceId));
  await waitFor(() => expect(hook.result.current.value?.title).toBe('Initial'));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  expect(hook.result.current.status).not.toBe('unavailable');
});
it('saves through Zero and waits for the durable receipt', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.value?.title).toBe('Initial'));
  act(() => hook.result.current.meta('title', 'Saved'));
  expect(hook.result.current.status).toBe('unsaved');
  await act(() => hook.result.current.commit());
  expect(io.server.title).toBe('Saved');
  await waitFor(() => expect(hook.result.current.status).toBe('saved'));
  expect(io.mutate).toHaveBeenCalledTimes(1);
});
it('keeps a failed draft and retries the same operation ID', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Draft'));
  io.mutate.mockImplementationOnce(() => ({
    server: Promise.reject(new Error('connection lost')),
  }));
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow();
  });
  const first = io.mutate.mock.calls[0][0].operationId;
  expect(localStorage.getItem(`studio:v4:${user.id}:${id}:canonical`)).toContain('Draft');
  await act(() => hook.result.current.commit());
  expect(io.mutate.mock.calls[1][0].operationId).toBe(first);
});
it('shows a conflict and can choose the saved value', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Local'));
  io.server.title = 'Remote';
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow();
  });
  expect(hook.result.current.conflicts).toHaveLength(1);
  await act(() => hook.result.current.resolveConflicts(false));
  expect(hook.result.current.value?.title).toBe('Remote');
});
it('undos only local properties', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Changed'));
  await act(() => hook.result.current.commit());
  act(() => hook.result.current.undo());
  await act(() => hook.result.current.commit());
  expect(io.server.title).toBe('Initial');
});
it('persists V3-only frame settings without losing the legacy canvas projection', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const frameId = hook.result.current.value?.pages[0].id;
  act(() =>
    hook.result.current.transactV3(document => {
      const frame = document.nodes.find(node => node.id === frameId);
      if (frame?.type !== 'frame') throw new Error('Frame missing');
      frame.grid = { enabled: true, size: 16, snap: false };
      frame.layout = { ...frame.layout, mode: 'wrap', padding: 24, gap: 12 };
      frame.clipContent = false;
    })
  );
  const frame = hook.result.current.v3Value?.nodes.find(node => node.id === frameId);
  expect(frame).toMatchObject({
    type: 'frame',
    grid: { enabled: true, size: 16, snap: false },
    layout: { mode: 'wrap', padding: 24, gap: 12 },
    clipContent: false,
  });
  expect(hook.result.current.value?.pages[0].id).toBe(frameId);
  await act(() => hook.result.current.commit());
  expect(
    studioDocumentV3Schema.parse(io.server).nodes.find(node => node.id === frameId)
  ).toMatchObject({
    grid: { size: 16, snap: false },
    layout: { mode: 'wrap', padding: 24, gap: 12 },
    clipContent: false,
  });
});

it('loads private media with the session token and exposes only revocable object URLs', async () => {
  const asset = {
    id: crypto.randomUUID(),
    name: 'Photo.png',
    mime: 'image/png',
    url: `/api/studio/media/${crypto.randomUUID()}`,
  };
  io.request.mockImplementation(async op =>
    op === 'load'
      ? {
          document: structuredClone(io.server),
          revision: io.revision,
          generation: 'current',
          canEdit: true,
        }
      : op === 'assets'
        ? [asset]
        : op === 'canvasPresence'
          ? { peers: [] }
          : []
  );
  io.fetch.mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' })));
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.assets).toHaveLength(1));
  expect(io.fetch).toHaveBeenCalledWith(asset.url, {
    headers: { Authorization: 'Bearer test' },
  });
  expect(hook.result.current.assets[0]).toEqual({ ...asset, url: 'blob:studio-media' });
  expect(io.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  await act(() => hook.result.current.refreshAssets());
  expect(io.fetch).toHaveBeenCalledTimes(1);
  hook.unmount();
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:studio-media');
});
