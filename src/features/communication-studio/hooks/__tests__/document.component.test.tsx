/* @vitest-environment jsdom */
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { vi, beforeEach, afterEach, it, expect } from 'vitest';
import { flushSync } from 'react-dom';
import { createDocument } from '../../logic/templates';
import { mergeStudioV3 } from '../../logic/operations';
import { legacyDocumentToV3 } from '../../logic/v3-adapter';
import { studioDocumentV3Schema } from '../../logic/document-v3';
import { applyStudioCommandV3 } from '../../logic/commands-v3';
import { element } from '../../logic/document';
import { makePage } from '../../logic/templates';
const io = vi.hoisted(() => ({
  authority: undefined as any,
  mediaChanged: undefined as any,
  remote: undefined as any,
  server: undefined as any,
  revision: 0,
  receipt: undefined as any,
  mutate: vi.fn(),
  request: vi.fn(),
  fetch: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  session: null as { access_token: string } | null,
  getSession: vi.fn(),
  setAuth: vi.fn(),
  removeChannel: vi.fn(),
  channels: [] as any[],
  remoteStatus: undefined as any,
  workspaceRemote: undefined as any,
  workspaceStatus: 'complete',
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: (query: { workspaceId?: string } | undefined) => [
    query?.workspaceId ? io.workspaceRemote : query ? io.remote : undefined,
    query?.workspaceId ? { type: io.workspaceStatus } : io.remoteStatus,
  ],
}));
vi.mock('@/zero/queries', () => ({
  queries: { studio: { document: (v: unknown) => v, workspace: (v: unknown) => v } },
}));
vi.mock('@/zero/mutators', () => ({ mutators: { studio: { apply: (v: unknown) => v } } }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return {
    useStudioClient: () =>
      Object.assign(studioClientFixture(io), {
        watchSession: (_input: unknown, next: unknown) => {
          io.authority = next;
          return () => undefined;
        },
        watchAssets: (_input: unknown, next: unknown) => {
          io.mediaChanged = next;
          return () => undefined;
        },
      }),
  };
});
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: io.getSession },
    realtime: { setAuth: io.setAuth },
    removeChannel: io.removeChannel,
    channel: () => {
      const c = {
        listeners: new Map(),
        on: vi.fn((type: string, filter: { event: string }, listener: unknown) => {
          c.listeners.set(`${type}:${filter.event}`, listener);
          return c;
        }),
        subscribe: vi.fn((_listener: (status: string) => void) => c),
        track: vi.fn(),
        unsubscribe: vi.fn(),
        send: vi.fn(),
        presenceState: vi.fn(() => ({})),
      };
      io.channels.push(c);
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
  io.remoteStatus = undefined;
  io.workspaceRemote = undefined;
  io.workspaceStatus = 'complete';
  io.channels = [];
  io.session = { access_token: 'test' };
  io.getSession.mockReset().mockImplementation(async () => ({ data: { session: io.session } }));
  io.setAuth.mockReset().mockResolvedValue(undefined);
  io.removeChannel.mockReset().mockResolvedValue(undefined);
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
  vi.restoreAllMocks();
  vi.useRealTimers();
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

it.each(['frame', 'richText'] as const)(
  'persists a renamed %s, undoes it in one step, and reloads it',
  async type => {
    const hook = renderHook(() => useStudioDocument(id, user));
    await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
    const original = structuredClone(
      hook.result.current.v3Value!.nodes.find(node => node.type === type)!
    );
    act(() =>
      hook.result.current.transactV3(document => {
        Object.assign(
          document,
          applyStudioCommandV3(document, {
            type: 'updateNode',
            nodeId: original.id,
            patch: { name: 'Renamed layer' },
          })
        );
      })
    );
    expect(hook.result.current.v3Value!.nodes.find(node => node.id === original.id)).toEqual({
      ...original,
      name: 'Renamed layer',
    });
    await act(() => hook.result.current.commit());
    expect(io.server.nodes.find((node: { id: string }) => node.id === original.id).name).toBe(
      'Renamed layer'
    );
    act(() => expect(hook.result.current.undo()).toBe(true));
    expect(hook.result.current.v3Value!.nodes.find(node => node.id === original.id)?.name).toBe(
      original.name
    );
    expect(hook.result.current.canUndo).toBe(false);
    act(() => expect(hook.result.current.redo()).toBe(true));
    expect(hook.result.current.v3Value!.nodes.find(node => node.id === original.id)?.name).toBe(
      'Renamed layer'
    );
    expect(hook.result.current.canRedo).toBe(false);
    await act(() => hook.result.current.commit());
    hook.unmount();
    localStorage.clear();
    const reloaded = renderHook(() => useStudioDocument(id, user));
    await waitFor(() => expect(reloaded.result.current.canEdit).toBe(true));
    expect(reloaded.result.current.v3Value!.nodes.find(node => node.id === original.id)?.name).toBe(
      'Renamed layer'
    );
    if (type === 'richText') {
      const frameId = reloaded.result.current.value!.pages[0].id;
      act(() =>
        reloaded.result.current.patchElement(frameId, original.id, { text: 'Edited content' })
      );
      await act(() => reloaded.result.current.commit());
      expect(io.server.nodes.find((node: { id: string }) => node.id === original.id).name).toBe(
        'Renamed layer'
      );
      expect(
        reloaded.result.current.value!.pages[0].elements.find(element => element.id === original.id)
          ?.text
      ).toBe('Edited content');
    }
  }
);

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
it('does not create a draft or publish operations without a project', async () => {
  const hook = renderHook(() => useStudioDocument(undefined, user));
  expect(hook.result.current.value).toBeNull();
  expect(hook.result.current.recovery).toBeNull();
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Studio not loaded');
    await expect(hook.result.current.recoverAsProposal()).rejects.toThrow('No draft');
    await hook.result.current.resolveConflicts(true);
    await hook.result.current.refreshAssets();
  });
  act(() => {
    hook.result.current.transact(() => {
      throw new Error('Unexpected edit');
    });
    hook.result.current.transactV3(() => {
      throw new Error('Unexpected edit');
    });
    hook.result.current.downloadLocalDraft();
    hook.result.current.cursor('frame', 1, 2);
    expect(hook.result.current.undo()).toBe(false);
    expect(hook.result.current.redo()).toBe(false);
  });
  expect(io.request).not.toHaveBeenCalled();
  expect(io.createObjectURL).not.toHaveBeenCalled();
});
it('keeps a read-only document unchanged and rechecks server authority on confirmation', async () => {
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (...args) =>
    args[0] === 'load'
      ? { document: structuredClone(io.server), revision: io.revision, canEdit: false }
      : request(...args)
  );
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.value?.title).toBe('Initial'));
  act(() => {
    hook.result.current.meta('title', 'Rejected');
    hook.result.current.transactV3(d => {
      d.title = 'Rejected';
    });
    expect(hook.result.current.undo()).toBe(false);
  });
  expect(hook.result.current.value?.title).toBe('Initial');
  await act(() => hook.result.current.commit());
  expect(io.mutate).not.toHaveBeenCalled();
  expect(io.request.mock.calls.filter(([op]) => op === 'load')).toHaveLength(3);
});
it.each([true, false])(
  'reports failed document loading with online state %s and ignores late results after unmount',
  async online => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
    io.request.mockRejectedValue(new Error('Access denied'));
    const hook = renderHook(() => useStudioDocument(id, user));
    await waitFor(() =>
      expect(hook.result.current.status).toBe(online ? 'unavailable' : 'offline')
    );
    expect(hook.result.current.error).toContain('Access denied');
    expect(hook.result.current.canEdit).toBe(false);
    hook.unmount();
    let resolve!: (result: unknown) => void;
    io.request.mockReturnValue(
      new Promise(result => {
        resolve = result;
      })
    );
    const pending = renderHook(() => useStudioDocument(id, user));
    pending.unmount();
    await act(async () => resolve({ document: io.server, revision: 0, canEdit: true }));
    expect(io.channels).toHaveLength(0);
    let reject!: (error: Error) => void;
    io.request.mockReturnValue(
      new Promise((_resolve, failure) => {
        reject = failure;
      })
    );
    const failed = renderHook(() => useStudioDocument(id, user));
    failed.unmount();
    await act(async () => reject(new Error('Late failure')));
  }
);
it('rejects invalid edits, ignores no-op transactions and exposes a complete local undo and redo history', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => {
    hook.result.current.transact(() => undefined);
    hook.result.current.transactV3(() => undefined);
    expect(hook.result.current.undo()).toBe(false);
  });
  expect(hook.result.current.canUndo).toBe(false);
  act(() =>
    hook.result.current.transact(d => {
      d.title = '';
    })
  );
  expect(hook.result.current.error).not.toBe('');
  expect(hook.result.current.value?.title).toBe('Initial');
  act(() =>
    hook.result.current.transactV3(d => {
      d.title = '';
    })
  );
  expect(hook.result.current.v3Value?.title).toBe('Initial');
  act(() =>
    hook.result.current.transact(d => {
      d.title = 'Untracked';
    }, false)
  );
  expect(hook.result.current.canUndo).toBe(false);
  act(() =>
    hook.result.current.transactV3(d => {
      d.title = 'Tracked';
    })
  );
  act(() => expect(hook.result.current.undo()).toBe(true));
  expect(hook.result.current.value?.title).toBe('Untracked');
  act(() => expect(hook.result.current.redo()).toBe(true));
  expect(hook.result.current.value?.title).toBe('Tracked');
});
it('updates page, post and element helpers without losing canonical object identities', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const page = hook.result.current.value!.pages[0];
  const post = hook.result.current.value!.posts[0];
  const added = element('rect', { x: 10, y: 10, order: 20 });
  act(() => hook.result.current.patchPage(page.id, { name: 'Changed page' }));
  act(() => hook.result.current.patchPost(post.id, { title: 'Changed post' }));
  act(() => hook.result.current.insertElement(page.id, added));
  expect(hook.result.current.value!.pages[0]).toMatchObject({ id: page.id, name: 'Changed page' });
  expect(hook.result.current.value!.posts[0].title).toBe('Changed post');
  expect(hook.result.current.value!.pages[0].elements.some(e => e.id === added.id)).toBe(true);
  act(() => hook.result.current.removeElement(page.id, added.id));
  const next = makePage('Second', 'feed', hook.result.current.value!.brand, 1, 'blank');
  act(() => hook.result.current.addPage(next));
  expect(hook.result.current.value!.pages.map(p => p.id)).toEqual([page.id, next.id]);
  expect(hook.result.current.value!.pages[0].elements.some(e => e.id === added.id)).toBe(false);
  await act(() => hook.result.current.retry());
  expect(io.server.nodes.some((node: { id: string }) => node.id === next.id)).toBe(true);
});
it('retains offline changes and saves them when the browser reconnects', async () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  online.mockReturnValue(false);
  act(() => hook.result.current.meta('title', 'Offline edit'));
  expect(hook.result.current.status).toBe('offline');
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Offline');
  });
  expect(io.mutate).not.toHaveBeenCalled();
  online.mockReturnValue(true);
  await act(async () => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(hook.result.current.status).toBe('saved'));
  expect(io.server.title).toBe('Offline edit');
});
it('downloads and recovers an old-generation draft into a new proposal without overwriting the current document', async () => {
  const local = structuredClone(io.server);
  local.title = 'Recovered content';
  const key = `studio:v4:${user.id}:${id}:canonical`;
  localStorage.setItem(
    key,
    JSON.stringify({ base: io.server, value: local, revision: 0, generation: 'old', canEdit: true })
  );
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) =>
    op === 'load'
      ? { document: structuredClone(io.server), revision: 7, generation: 'current', canEdit: true }
      : op === 'canvas' && args.action === 'createDraft'
        ? { workspaceId: 'recovered' }
        : op === 'canvas'
          ? {}
          : request(op, args)
  );
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.status).toBe('conflict'));
  expect(hook.result.current.value?.title).toBe('Recovered content');
  expect(hook.result.current.canEdit).toBe(false);
  await act(async () => {
    await expect(hook.result.current.resolveConflicts(true)).rejects.toThrow(
      'old-generation draft'
    );
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.useFakeTimers();
  act(() => hook.result.current.downloadLocalDraft());
  expect(click.mock.instances[0]).toMatchObject({
    download: `polity-draft-${id}.json`,
    href: 'blob:studio-media',
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:studio-media');
  let recovered: string | undefined;
  await act(async () => {
    recovered = await hook.result.current.recoverAsProposal();
  });
  expect(recovered).toBe('recovered');
  expect(io.request).toHaveBeenCalledWith(
    'canvas',
    expect.objectContaining({
      action: 'saveDraft',
      workspaceId: 'recovered',
      revision: 0,
      generation: 'current',
      changes: expect.any(Array),
    })
  );
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(`${key}:archived:old`)).toContain('Recovered content');
  expect(io.mutate).not.toHaveBeenCalled();
});

it('revokes replaced and removed private media URLs without downloading cached media twice', async () => {
  const asset = {
    id: crypto.randomUUID(),
    name: 'Photo',
    mime: 'image/png',
    url: '/api/media/first',
  };
  let assets = [asset];
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) => (op === 'assets' ? assets : request(op, args)));
  io.createObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
  io.fetch.mockImplementation(async () => new Response(new Blob(['image'])));
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.assets[0]?.url).toBe('blob:first'));
  await act(() => hook.result.current.refreshAssets());
  expect(io.fetch).toHaveBeenCalledOnce();
  assets = [{ ...asset, url: '/api/media/second' }];
  await act(() => hook.result.current.refreshAssets());
  expect(hook.result.current.assets[0].url).toBe('blob:second');
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:first');
  assets = [];
  await act(() => hook.result.current.refreshAssets());
  expect(hook.result.current.assets).toEqual([]);
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:second');
});
it('rejects private media without a session or a successful response and cleans partial object URLs', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const assets = [1, 2].map(index => ({
    id: crypto.randomUUID(),
    name: `Photo ${index}`,
    mime: 'image/png',
    url: `/api/media/${index}`,
  }));
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) => (op === 'assets' ? assets : request(op, args)));
  io.session = null;
  await act(async () => {
    await expect(hook.result.current.refreshAssets()).rejects.toThrow('Please sign in');
  });
  expect(io.fetch).not.toHaveBeenCalled();
  io.session = { access_token: 'test' };
  io.fetch
    .mockResolvedValueOnce(new Response(new Blob(['image'])))
    .mockImplementationOnce(async () => {
      await Promise.resolve();
      await Promise.resolve();
      return new Response('Forbidden', { status: 403 });
    });
  await act(async () => {
    await expect(hook.result.current.refreshAssets()).rejects.toThrow('Cannot load media');
  });
  expect(hook.result.current.assets).toEqual([]);
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:studio-media');
});
it('revokes an in-flight media response when the active project changes', async () => {
  const asset = {
    id: crypto.randomUUID(),
    name: 'Old photo',
    mime: 'image/png',
    url: '/api/media/old',
  };
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) =>
    op === 'assets' ? (args.id === id ? [asset] : []) : request(op, args)
  );
  let resolve!: (value: Response) => void;
  io.fetch.mockReturnValue(
    new Promise(complete => {
      resolve = complete;
    })
  );
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(io.fetch).toHaveBeenCalledOnce());
  hook.rerender({ project: crypto.randomUUID() });
  await act(async () => resolve(new Response(new Blob(['late image']))));
  expect(hook.result.current.assets).toEqual([]);
  expect(io.revokeObjectURL).toHaveBeenCalledWith('blob:studio-media');
});
it('merges later Zero revisions with independent local changes and refuses a conflicting undo', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Local'));
  const remote = structuredClone(io.server);
  remote.campaign.startDate = '2026-10-01';
  io.remote = { document: remote, content_revision: 1 };
  hook.rerender();
  await waitFor(() => expect(hook.result.current.v3Value?.campaign.startDate).toBe('2026-10-01'));
  expect(hook.result.current.value?.title).toBe('Local');
  act(() =>
    hook.result.current.transactV3(d => {
      d.title = 'Untracked replacement';
    }, false)
  );
  act(() => expect(hook.result.current.undo()).toBe(false));
  expect(hook.result.current.error).toBe('Undo conflicts with a later edit');
  expect(hook.result.current.value?.title).toBe('Untracked replacement');
});
it('exposes conflicts from Zero updates and rebases chosen local transforms onto the latest revision', async () => {
  vi.useFakeTimers();
  const hook = renderHook(() => useStudioDocument(id, user));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(hook.result.current.canEdit).toBe(true);
  const target = hook.result.current.v3Value!.nodes[0].id;
  act(() =>
    hook.result.current.transactV3(d => {
      d.nodes[0].transform.x = 50;
      d.campaign.startDate = '2026-10-01';
    })
  );
  io.server.nodes[0].transform.x = 70;
  io.revision = 2;
  io.remote = { document: structuredClone(io.server), content_revision: 2 };
  hook.rerender();
  expect(hook.result.current.status).toBe('conflict');
  await act(async () => io.authority({ generation: undefined }));
  expect(hook.result.current.status).toBe('conflict');
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Resolve Studio conflicts first');
  });
  await act(() => hook.result.current.resolveConflicts(true));
  expect(io.server.nodes.find((node: { id: string }) => node.id === target).transform.x).toBe(50);
  expect(io.server.campaign.startDate).toBe('2026-10-01');
  expect(hook.result.current.conflicts).toEqual([]);
  expect(hook.result.current.status).toBe('saved');
});
it('checks canonical query authority and workspace authority before accepting more edits', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  io.remoteStatus = { type: 'complete' };
  hook.rerender();
  await waitFor(() => expect(hook.result.current.status).toBe('unavailable'));
  expect(hook.result.current.canEdit).toBe(false);
  hook.unmount();
  io.remoteStatus = undefined;
  io.workspaceStatus = 'loading';
  const request = io.request.getMockImplementation()!;
  let allowed = true;
  io.request.mockImplementation(async (op, args) =>
    op === 'canvas'
      ? {
          document: structuredClone(io.server),
          revision: io.revision,
          generation: 'current',
          canEdit: allowed,
        }
      : request(op, args)
  );
  const workspaceId = crypto.randomUUID();
  const workspace = renderHook(() => useStudioDocument(id, user, workspaceId));
  await waitFor(() => expect(workspace.result.current.canEdit).toBe(true));
  allowed = false;
  io.workspaceStatus = 'complete';
  workspace.rerender();
  await waitFor(() => expect(workspace.result.current.status).toBe('unavailable'));
  expect(workspace.result.current.canEdit).toBe(false);
  expect(workspace.result.current.peers).toEqual([]);
});
it('saves workspace changes through the review API and keeps canonical Zero mutations untouched', async () => {
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) => {
    if (op !== 'canvas') return request(op, args);
    if (args.action === 'saveDraft') {
      const merged = mergeStudioV3(io.server, args.changes);
      io.server = merged.value;
      io.revision++;
      return { status: 'applied', document: io.server, revision: io.revision, conflicts: [] };
    }
    return {
      document: structuredClone(io.server),
      revision: io.revision,
      generation: 'current',
      canEdit: true,
    };
  });
  const workspaceId = crypto.randomUUID();
  const hook = renderHook(() => useStudioDocument(id, user, workspaceId));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Workspace edit'));
  await act(() => hook.result.current.commit());
  expect(io.server.title).toBe('Workspace edit');
  expect(io.request).toHaveBeenCalledWith(
    'canvas',
    expect.objectContaining({
      action: 'saveDraft',
      projectId: id,
      workspaceId,
      generation: 'current',
      revision: 0,
      operationId: expect.any(String),
    })
  );
  expect(io.mutate).not.toHaveBeenCalled();
});
it('restores a cached offline draft and ignores corrupt cache data', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const key = `studio:v4:${user.id}:${id}:canonical`;
  localStorage.setItem(key, '{broken');
  io.request.mockRejectedValue(new Error('Network offline'));
  const corrupt = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(corrupt.result.current.status).toBe('offline'));
  expect(corrupt.result.current.value).toBeNull();
  corrupt.unmount();
  const local = structuredClone(io.server);
  local.title = 'Cached offline';
  localStorage.setItem(
    key,
    JSON.stringify({ base: io.server, value: local, revision: 0, canEdit: true })
  );
  const restored = renderHook(() => useStudioDocument(id, user));
  expect(restored.result.current.value?.title).toBe('Cached offline');
  await waitFor(() => expect(restored.result.current.error).toContain('Network offline'));
  expect(restored.result.current.status).toBe('offline');
  expect(localStorage.getItem(key)).toContain('Cached offline');
});
it('serializes overlapping confirmations and preserves edits made while a confirmation is pending', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const request = io.request.getMockImplementation()!;
  let resolve!: (value: unknown) => void;
  io.request.mockImplementationOnce(
    () =>
      new Promise(complete => {
        resolve = complete;
      })
  );
  let first!: Promise<number>, second!: Promise<number>;
  act(() => {
    first = hook.result.current.commit();
    second = hook.result.current.commit();
  });
  act(() => hook.result.current.meta('title', 'While confirming'));
  await act(async () => {
    resolve({ document: structuredClone(io.server), revision: 0, canEdit: true });
    await Promise.all([first, second]);
  });
  expect(io.server.title).toBe('While confirming');
  expect(io.mutate).toHaveBeenCalledOnce();
  expect(hook.result.current.status).toBe('saved');
  expect(io.request.getMockImplementation()).toBe(request);
});
it('rejects a changed generation during a clean confirmation and retains the local snapshot', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  io.request.mockResolvedValueOnce({
    document: io.server,
    revision: 1,
    generation: 'different',
    canEdit: true,
  });
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Canvas generation changed');
  });
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.value?.title).toBe('Initial');
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Resolve Studio conflicts first');
  });
});
it('applies sequential edits in one React event without discarding the first edit', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const page = hook.result.current.value!.pages[0];
  const added = element('rect');
  act(() => {
    hook.result.current.patchPage(page.id, { name: 'First edit' });
    hook.result.current.insertElement(page.id, added);
  });
  expect(hook.result.current.value!.pages[0].name).toBe('First edit');
  expect(hook.result.current.value!.pages[0].elements.some(e => e.id === added.id)).toBe(true);
  await act(() => hook.result.current.commit());
  expect(io.server.nodes.find((node: { id: string }) => node.id === page.id).name).toBe(
    'First edit'
  );
});
it('automatically saves restored and newly edited drafts and reports failed timed saves', async () => {
  const local = structuredClone(io.server);
  local.title = 'Restored edit';
  localStorage.setItem(
    `studio:v4:${user.id}:${id}:canonical`,
    JSON.stringify({ base: io.server, value: local, revision: 0, canEdit: true })
  );
  vi.useFakeTimers();
  const hook = renderHook(() => useStudioDocument(id, user));
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(io.server.title).toBe('Restored edit');
  io.mutate.mockImplementation(() => ({ server: Promise.reject(new Error('Auto-save rejected')) }));
  act(() => hook.result.current.meta('title', 'Failed timer edit'));
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.error).toBe('Auto-save rejected');
  act(() =>
    hook.result.current.transactV3(d => {
      d.campaign.startDate = '2026-10-01';
    })
  );
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(hook.result.current.error).toBe('Auto-save rejected');
  act(() => expect(hook.result.current.undo()).toBe(true));
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(hook.result.current.error).toBe('Auto-save rejected');
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(hook.result.current.error).toBe('Auto-save rejected');
});
it('refreshes media after a Zero asset change and tolerates an unavailable asset list', async () => {
  vi.useFakeTimers();
  const hook = renderHook(() => useStudioDocument(id, user));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(hook.result.current.canEdit).toBe(true);
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation((op, args) =>
    op === 'assets' ? Promise.reject(new Error('Assets unavailable')) : request(op, args)
  );
  await act(async () => io.mediaChanged());
  expect(io.request.mock.calls.filter(([op]) => op === 'assets').length).toBeGreaterThan(1);
  expect(hook.result.current.value?.title).toBe('Initial');
});
it('ignores a clean confirmation after switching projects and preserves the new draft', async () => {
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let resolve!: (result: unknown) => void;
  io.request.mockImplementationOnce(
    () =>
      new Promise(complete => {
        resolve = complete;
      })
  );
  let confirming!: Promise<number>;
  act(() => {
    confirming = hook.result.current.commit();
  });
  hook.rerender({ project: crypto.randomUUID() });
  await act(async () => {
    const result = expect(confirming).rejects.toThrow('Studio changed while confirming');
    resolve({ document: io.server, revision: 0, canEdit: true });
    await result;
  });
  expect(hook.result.current.value?.title).toBe('Initial');
  expect(hook.result.current.status).toBe('saved');
  expect(io.mutate).not.toHaveBeenCalled();
});
it('saves edits queued during a pending mutation in a second operation', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const mutate = io.mutate.getMockImplementation()!;
  let resolve!: (value: unknown) => void;
  io.mutate.mockImplementationOnce(args => {
    mutate(args);
    return {
      server: new Promise(complete => {
        resolve = complete;
      }),
    };
  });
  act(() => hook.result.current.meta('title', 'First edit'));
  let commit!: Promise<number>;
  act(() => {
    commit = hook.result.current.commit();
  });
  act(() => hook.result.current.meta('title', 'Second edit'));
  await act(async () => {
    resolve({ type: 'success' });
    await commit;
  });
  expect(io.mutate).toHaveBeenCalledTimes(2);
  expect(io.server.title).toBe('Second edit');
  expect(hook.result.current.status).toBe('saved');
});
it('keeps edits that conflict with the receipt instead of silently overwriting them', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let resolve!: (value: unknown) => void;
  io.mutate.mockImplementationOnce(() => ({
    server: new Promise(complete => {
      resolve = complete;
    }),
  }));
  act(() => hook.result.current.meta('title', 'Sent edit'));
  let commit!: Promise<number>;
  act(() => {
    commit = hook.result.current.commit();
  });
  act(() => hook.result.current.meta('title', 'Trailing edit'));
  const server = structuredClone(io.server);
  server.title = 'Remote replacement';
  io.receipt = { status: 'applied', document: server, revision: 1, conflicts: [] };
  await act(async () => {
    resolve({ type: 'success' });
    await commit;
  });
  expect(hook.result.current.status).toBe('conflict');
  expect(hook.result.current.value?.title).toBe('Trailing edit');
  expect(hook.result.current.conflicts).toHaveLength(1);
  act(() =>
    hook.result.current.transactV3(d => {
      d.campaign.startDate = '2026-10-01';
    })
  );
  expect(hook.result.current.status).toBe('conflict');
});
it('leaves a deleted ancestor conflicted when local edits cannot be recovered into it', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() =>
    hook.result.current.transactV3(d => {
      d.nodes[0].transform.x = 50;
    })
  );
  io.server.nodes = [];
  io.server.deliverables = [];
  io.revision = 1;
  io.remote = { document: io.server, content_revision: 1 };
  hook.rerender();
  await waitFor(() => expect(hook.result.current.status).toBe('conflict'));
  await act(() => hook.result.current.resolveConflicts(true));
  expect(hook.result.current.conflicts.length).toBeGreaterThan(0);
  expect(hook.result.current.status).toBe('conflict');
  expect(io.mutate).not.toHaveBeenCalled();
});
it('retains pending edits when a later authority check makes the project read-only', async () => {
  vi.useFakeTimers();
  const hook = renderHook(() => useStudioDocument(id, user));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(hook.result.current.canEdit).toBe(true);
  act(() => hook.result.current.meta('title', 'Retained private draft'));
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementation(async (op, args) =>
    op === 'load' ? { document: io.server, revision: 0, canEdit: false } : request(op, args)
  );
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(async () => io.authority({ generation: undefined }));
  expect(hook.result.current.canEdit).toBe(false);
  online.mockReturnValue(true);
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Studio is read-only');
  });
  expect(hook.result.current.value?.title).toBe('Retained private draft');
});
it('ignores an asset list that arrives after switching projects before downloading private files', async () => {
  const request = io.request.getMockImplementation()!;
  let resolve!: (value: unknown) => void;
  io.request.mockImplementation((op, args) =>
    op === 'assets' && args.id === id
      ? new Promise(complete => {
          resolve = complete;
        })
      : request(op, args)
  );
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  hook.rerender({ project: crypto.randomUUID() });
  await act(async () =>
    resolve([{ id: crypto.randomUUID(), name: 'Private', mime: 'image/png', url: '/private' }])
  );
  expect(io.fetch).not.toHaveBeenCalled();
  expect(hook.result.current.assets).toEqual([]);
});
it.each(['success', 'failure'] as const)(
  'ignores a workspace authority %s after unmount and revokes failed access while mounted',
  async outcome => {
    io.workspaceStatus = 'loading';
    const request = io.request.getMockImplementation()!;
    io.request.mockImplementation(async (op, args) =>
      op === 'canvas' ? { document: io.server, revision: 0, canEdit: true } : request(op, args)
    );
    const hook = renderHook(() => useStudioDocument(id, user, 'workspace'));
    await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
    let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
    io.request.mockImplementationOnce(
      () =>
        new Promise((complete, failure) => {
          resolve = complete;
          reject = failure;
        })
    );
    io.workspaceStatus = 'complete';
    hook.rerender();
    hook.unmount();
    await act(async () =>
      outcome === 'success'
        ? resolve({ document: io.server, revision: 0, canEdit: true })
        : reject(new Error('Revoked'))
    );
    io.workspaceStatus = 'loading';
    const active = renderHook(() => useStudioDocument(id, user, 'workspace'));
    await waitFor(() => expect(active.result.current.canEdit).toBe(true));
    io.request.mockRejectedValueOnce(new Error('Revoked'));
    io.workspaceStatus = 'complete';
    active.rerender();
    await waitFor(() => expect(active.result.current.status).toBe('unavailable'));
    expect(active.result.current.canEdit).toBe(false);
    expect(active.result.current.peers).toEqual([]);
  }
);
it('receives a complete Zero workspace document without revoking authorized draft access', async () => {
  const request = io.request.getMockImplementation()!;
  io.workspaceStatus = 'loading';
  io.request.mockImplementation(async (op, args) =>
    op === 'canvas' ? { document: io.server, revision: 0, canEdit: true } : request(op, args)
  );
  const hook = renderHook(() => useStudioDocument(id, user, 'workspace'));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const remote = structuredClone(io.server);
  remote.title = 'Replicated workspace';
  io.workspaceRemote = { document: remote, revision: 1 };
  io.workspaceStatus = 'complete';
  hook.rerender();
  await waitFor(() => expect(hook.result.current.value?.title).toBe('Replicated workspace'));
  expect(hook.result.current.canEdit).toBe(true);
  io.workspaceRemote = undefined;
  hook.rerender();
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
});

it('rejects edits that conflict with a clean confirmation instead of overwriting remote changes', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let resolve!: (value: unknown) => void;
  io.request.mockImplementationOnce(
    () =>
      new Promise(complete => {
        resolve = complete;
      })
  );
  let commit!: Promise<number>;
  act(() => {
    commit = hook.result.current.commit();
  });
  act(() => hook.result.current.meta('title', 'While confirming'));
  const remote = structuredClone(io.server);
  remote.title = 'Other author';
  await act(async () => {
    const rejected = expect(commit).rejects.toThrow('Resolve Studio conflicts first');
    resolve({ document: remote, revision: 1, canEdit: true });
    await rejected;
  });
  expect(hook.result.current.status).toBe('conflict');
  expect(hook.result.current.value?.title).toBe('While confirming');
  expect(io.mutate).not.toHaveBeenCalled();
  act(() => hook.result.current.meta('title', 'Still retained'));
  act(() => expect(hook.result.current.undo()).toBe(true));
  expect(hook.result.current.status).toBe('conflict');
});
it('reports a failed clean confirmation according to the current connectivity and preserves unsaved history', async () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  io.request.mockRejectedValueOnce('Service unavailable');
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toBe('Service unavailable');
  });
  expect(hook.result.current.status).toBe('error');
  const request = io.request.getMockImplementation()!;
  io.request.mockImplementationOnce(async () => {
    online.mockReturnValue(false);
    throw new Error('Disconnected');
  });
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toThrow('Disconnected');
  });
  expect(hook.result.current.status).toBe('offline');
  act(() =>
    hook.result.current.transactV3(d => {
      d.title = 'Offline V5';
    }, false)
  );
  expect(hook.result.current.status).toBe('offline');
  act(() => hook.result.current.meta('title', 'Offline legacy'));
  act(() => expect(hook.result.current.undo()).toBe(true));
  expect(hook.result.current.status).toBe('offline');
  expect(hook.result.current.value?.title).toBe('Offline V5');
  expect(io.request.getMockImplementation()).toBe(request);
});
it('keeps a new project intact when the receipt of an older pending mutation arrives', async () => {
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  const mutate = io.mutate.getMockImplementation()!;
  let resolve!: (result: unknown) => void;
  io.mutate.mockImplementationOnce(args => {
    mutate(args);
    return {
      server: new Promise(complete => {
        resolve = complete;
      }),
    };
  });
  act(() => hook.result.current.meta('title', 'Old project edit'));
  let commit!: Promise<number>;
  act(() => {
    commit = hook.result.current.commit();
  });
  io.server = legacyDocumentToV3(createDocument('single', 'New project'));
  hook.rerender({ project: crypto.randomUUID() });
  await waitFor(() => expect(hook.result.current.value?.title).toBe('New project'));
  await act(async () => {
    resolve({ type: 'success' });
    await commit;
  });
  expect(hook.result.current.value?.title).toBe('New project');
  expect(io.mutate).toHaveBeenCalledOnce();
});
it.each(['workspace', 'user', 'reopen'] as const)(
  'fences an earlier pending mutation when the active %s changes',
  async change => {
    io.workspaceStatus = 'loading';
    const request = io.request.getMockImplementation()!;
    io.request.mockImplementation(async (op, args) =>
      op === 'canvas' ? { document: io.server, revision: 0, canEdit: true } : request(op, args)
    );
    const hook = renderHook(
      ({ project, viewer, workspace }) => useStudioDocument(project, viewer, workspace),
      { initialProps: { project: id, viewer: user, workspace: undefined as string | undefined } }
    );
    await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
    let resolve!: (value: unknown) => void;
    const mutate = io.mutate.getMockImplementation()!;
    io.mutate.mockImplementationOnce(args => {
      mutate(args);
      return {
        server: new Promise(complete => {
          resolve = complete;
        }),
      };
    });
    act(() => hook.result.current.meta('title', 'Old session'));
    let saving!: Promise<number>;
    act(() => {
      saving = hook.result.current.commit();
    });
    io.server = legacyDocumentToV3(createDocument('single', 'New session'));
    const next = {
      project: id,
      viewer: change === 'user' ? { ...user, id: crypto.randomUUID() } : user,
      workspace: change === 'workspace' ? crypto.randomUUID() : undefined,
    };
    if (change === 'reopen') hook.rerender({ ...next, project: crypto.randomUUID() });
    hook.rerender(next);
    await waitFor(() =>
      expect(hook.result.current.value?.title).toBe(
        change === 'reopen' ? 'Old session' : 'New session'
      )
    );
    if (change === 'reopen') act(() => hook.result.current.meta('title', 'Reopened private draft'));
    await act(async () => {
      resolve({ type: 'success' });
      await saving;
    });
    expect(hook.result.current.value?.title).toBe(
      change === 'reopen' ? 'Reopened private draft' : 'New session'
    );
    expect(hook.result.current.status).toBe(change === 'reopen' ? 'unsaved' : 'saved');
    expect(hook.result.current.error).toBe('');
    expect(io.mutate).toHaveBeenCalledOnce();
  }
);

it('retains a higher authority revision when an overlapping explicit refresh finishes first', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let resolve!: (value: unknown) => void;
  io.request.mockImplementationOnce(
    () =>
      new Promise(complete => {
        resolve = complete;
      })
  );
  let confirmation!: Promise<number>;
  act(() => {
    confirmation = hook.result.current.commit();
  });
  const remote = structuredClone(io.server);
  remote.title = 'Newest revision';
  io.server = remote;
  io.revision = 2;
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = hook.result.current.resolveConflicts(false);
    await Promise.resolve();
  });
  await act(async () => {
    resolve({
      document: legacyDocumentToV3(createDocument('single', 'Older response')),
      revision: 0,
      canEdit: true,
    });
    await Promise.all([confirmation, refresh]);
  });
  expect(hook.result.current.value?.title).toBe('Newest revision');
  expect(hook.result.current.status).toBe('saved');
  expect(io.mutate).not.toHaveBeenCalled();
});
it('renders non-Error mutation failures without dropping the local draft', async () => {
  const hook = renderHook(() => useStudioDocument(id, user));
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  act(() => hook.result.current.meta('title', 'Retained'));
  io.mutate.mockImplementation(() => ({ server: Promise.reject('Database unavailable') }));
  await act(async () => {
    await expect(hook.result.current.commit()).rejects.toBe('Database unavailable');
  });
  expect(hook.result.current.error).toBe('Database unavailable');
  expect(hook.result.current.value?.title).toBe('Retained');
});
it('reports a restored draft autosave failure without discarding its cached changes', async () => {
  const local = structuredClone(io.server);
  local.title = 'Retained restored draft';
  localStorage.setItem(
    `studio:v4:${user.id}:${id}:canonical`,
    JSON.stringify({ base: io.server, value: local, revision: 0, canEdit: true })
  );
  vi.useFakeTimers();
  io.mutate.mockImplementation(() => ({
    server: Promise.reject(new Error('Restored save failed')),
  }));
  const hook = renderHook(() => useStudioDocument(id, user));
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(hook.result.current.error).toBe('Restored save failed');
  expect(hook.result.current.value?.title).toBe('Retained restored draft');
  expect(localStorage.getItem(`studio:v4:${user.id}:${id}:canonical`)).toContain(
    'Retained restored draft'
  );
});
it('leaves a newly opened project saved when the previous operation fails after the switch', async () => {
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let reject!: (reason: Error) => void;
  io.mutate.mockImplementationOnce(() => ({
    server: new Promise((_resolve, fail) => {
      reject = fail;
    }),
  }));
  act(() => hook.result.current.meta('title', 'Old failure'));
  let saving!: Promise<number>;
  act(() => {
    saving = hook.result.current.commit();
  });
  io.server = legacyDocumentToV3(createDocument('single', 'New project'));
  hook.rerender({ project: crypto.randomUUID() });
  await waitFor(() => expect(hook.result.current.value?.title).toBe('New project'));
  await act(async () => {
    const rejected = expect(saving).rejects.toThrow('Old server failed');
    reject(new Error('Old server failed'));
    await rejected;
  });
  expect(hook.result.current.status).toBe('saved');
  expect(hook.result.current.error).toBe('');
});
it('fences navigation immediately after authority confirmation before the commit returns', async () => {
  const hook = renderHook(({ project }) => useStudioDocument(project, user), {
    initialProps: { project: id },
  });
  await waitFor(() => expect(hook.result.current.canEdit).toBe(true));
  let resolve!: (result: unknown) => void;
  const response = new Promise(complete => {
    resolve = complete;
  });
  io.request.mockReturnValueOnce(response);
  let confirming!: Promise<number>;
  act(() => {
    confirming = hook.result.current.commit();
  });
  void response.then(() => flushSync(() => hook.rerender({ project: crypto.randomUUID() })));
  await act(async () => {
    const rejected = expect(confirming).rejects.toThrow('Studio changed while confirming');
    resolve({ document: io.server, revision: 0, canEdit: true });
    await rejected;
  });
  expect(hook.result.current.status).toBe('saved');
  expect(hook.result.current.error).toBe('');
});
