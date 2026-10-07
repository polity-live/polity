// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDocument } from '../../logic/templates';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../../logic/v3-adapter';
import { createElementSetSnapshot } from '../../logic/element-library';
import { createThemeSnapshot } from '../../logic/theme';
import { BUILTIN_THEMES } from '@/features/shared/appearance-theme';
import { useStudioController } from '../useStudioController';

const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  document: vi.fn(),
  editor: {} as any,
  user: null as any,
  currentUser: null as any,
  exports: [] as any[],
  mutate: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: io.mutate }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: io.currentUser }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], exports: io.exports, isLoading: false }),
}));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('../useStudioDocument', () => ({
  useStudioDocument: (...args: unknown[]) => {
    io.document(...args);
    return io.editor;
  },
}));
let canonical: ReturnType<typeof legacyDocumentToV3>;
const setId = '00000000-0000-4000-a000-000000000001';
const revisionId = '00000000-0000-4000-a000-000000000002';
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
const mount = (id: string | null = 'project', workspaceId?: string) =>
  renderHook(() => useStudioController('group', id ?? undefined, vi.fn(), workspaceId));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState(null, '', '/');
  io.user = { id: 'actor', email: 'actor@polity.test' };
  io.currentUser = null;
  io.exports = [];
  canonical = legacyDocumentToV3(createDocument('single', 'Controller fixture'));
  io.editor = {
    get value() {
      return v3DocumentToLegacy(canonical);
    },
    get v3Value() {
      return canonical;
    },
    transactV3: vi.fn((callback: (doc: typeof canonical) => void) => callback(canonical)),
    transact: vi.fn(),
    patchElement: vi.fn(),
    removeElement: vi.fn(),
    insertElement: vi.fn(),
    commit: vi.fn().mockResolvedValue(9),
    refreshAssets: vi.fn().mockResolvedValue(undefined),
    canEdit: true,
  };
  io.request.mockImplementation(async (operation: string) =>
    operation === 'export' ? { id: 'export' } : []
  );
  io.mutate.mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([
  { user: null, currentUser: null, name: 'Polity', id: '' },
  {
    user: { id: 'actor' },
    currentUser: { handle: 'handle', avatar: 'avatar' },
    name: 'handle',
    id: 'actor',
  },
  {
    user: { id: 'actor', email: 'mail@polity.test' },
    currentUser: null,
    name: 'mail',
    id: 'actor',
  },
  {
    user: { id: 'actor' },
    currentUser: { first_name: 'First', last_name: 'Last' },
    name: 'First Last',
    id: 'actor',
  },
])(
  'constructs the editor identity for $name without requiring profile metadata',
  async ({ user, currentUser, name, id }) => {
    io.user = user;
    io.currentUser = currentUser;
    const hook = mount();
    await flush();
    expect(hook.result.current.identity).toMatchObject({ name, id });
    expect(io.document).toHaveBeenCalledWith('project', hook.result.current.identity, undefined);
  }
);

it('follows only valid canvas hash links and removes the listener on unmount', async () => {
  const frameId = canonical.nodes.find(node => node.type === 'frame')!.id;
  history.replaceState(null, '', `/#canvas=${frameId}`);
  const hook = mount();
  await flush();
  expect(hook.result.current.pageId).toBe(frameId);
  act(() => {
    history.replaceState(null, '', '/#canvas=missing');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(hook.result.current.pageId).toBe(frameId);
  act(() => {
    history.replaceState(null, '', `/#canvas=${frameId}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(hook.result.current.page?.id).toBe(frameId);
  const remove = vi.spyOn(window, 'removeEventListener');
  hook.unmount();
  expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
});

it('selects exact frames, merges explicit export selections and resets selections for another project', async () => {
  const hook = renderHook(({ id }) => useStudioController('group', id, vi.fn()), {
    initialProps: { id: 'project' },
  });
  await flush();
  const frameId = hook.result.current.exportFrameIds[0];
  act(() => hook.result.current.selectExact([frameId, frameId]));
  expect(hook.result.current.selected).toEqual([frameId]);
  act(() => hook.result.current.markSelectedExportFrame());
  expect(hook.result.current.exportFrameIds).toEqual([frameId]);
  act(() => hook.result.current.toggleExportFrame(frameId));
  expect(hook.result.current.exportFrameIds).toEqual([]);
  act(() => hook.result.current.markSelectedExportFrame());
  expect(hook.result.current.exportFrameIds).toEqual([frameId]);
  act(() => {
    hook.result.current.selectExact(['missing']);
    hook.result.current.markSelectedExportFrame();
  });
  expect(hook.result.current.exportFrameIds).toEqual([frameId]);
  act(() => hook.result.current.markAllExportFrames());
  act(() => hook.result.current.toggleExportFrame(frameId));
  hook.rerender({ id: 'other' });
  expect(hook.result.current.exportFrameIds).toEqual([frameId]);
});

it.each(['completed', 'failed', 'cancelled'])(
  'subscribes to an export reaching %s, deduplicates jobs and downloads completed jobs once',
  async status => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    io.exports = [
      { id: 'export', status: 'queued', progress: 0, format: 'png', file_name: 'persisted.png' },
      { id: 'old', status: 'completed', progress: 100, format: 'pdf', file_name: null },
    ];
    io.request.mockImplementation(async operation =>
      operation === 'export'
        ? { id: 'export' }
        : operation === 'exportStatus'
          ? { id: 'export', status, progress: 100, format: 'png', fileName: 'final.png' }
          : []
    );
    const hook = mount();
    await flush();
    await act(() => hook.result.current.exportMedia());
    await flush();
    io.exports = [
      { id: 'export', status, progress: 100, format: 'png', file_name: 'final.png' },
      io.exports[1],
    ];
    hook.rerender();
    await flush();
    expect(hook.result.current.exports).toHaveLength(2);
    expect(hook.result.current.exports[0]).toMatchObject({ id: 'export', status, progress: 100 });
    expect(hook.result.current.exportStatusError).toBe(false);
    expect(click).toHaveBeenCalledTimes(status === 'completed' ? 1 : 0);
    if (status === 'completed') {
      const link = click.mock.instances[0] as HTMLAnchorElement;
      expect(link.download).toBe('final.png');
      expect(link.pathname).toBe('/api/studio/exports/export');
      expect(link.isConnected).toBe(false);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
    });
    expect(click).toHaveBeenCalledTimes(status === 'completed' ? 1 : 0);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  }
);

it('keeps a confirmed queued export while its replicated status is pending', async () => {
  const hook = mount();
  await flush();
  await act(() => hook.result.current.exportMedia());
  expect(hook.result.current.exports[0]).toMatchObject({ id: 'export', status: 'queued' });
  expect(io.request.mock.calls.filter(([op]) => op === 'exportStatus')).toHaveLength(0);
  hook.unmount();
});

it('downloads a manually selected export with encoded identifiers and no optional filename', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const hook = mount();
  await flush();
  hook.result.current.downloadExport('id/with spaces');
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toBe('');
  expect(link.getAttribute('href')).toBe('/api/studio/exports/id%2Fwith%20spaces');
});

it.each([new Error('Export unavailable'), 'Permission denied'])(
  'reports export failures and retains the draft (%s)',
  async error => {
    const hook = mount();
    await flush();
    const before = structuredClone(canonical);
    io.request.mockRejectedValue(error);
    await act(() => hook.result.current.exportMedia());
    expect(hook.result.current.failure).toBe(error instanceof Error ? error.message : error);
    expect(hook.result.current.exportFailure).toBe(hook.result.current.failure);
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.exportPreparing).toBe(false);
    expect(canonical).toEqual(before);
    expect(io.notifyError).toHaveBeenCalledWith(error);
  }
);

it('does not queue a second export while preparing and rejects exporting a proposal workspace', async () => {
  let resolve!: (value: unknown) => void;
  io.request.mockImplementation(async operation =>
    operation === 'export'
      ? new Promise(done => {
          resolve = done;
        })
      : []
  );
  const hook = mount();
  await flush();
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.exportMedia();
  });
  await flush();
  expect(hook.result.current.exportPreparing).toBe(true);
  await act(() => hook.result.current.exportMedia());
  expect(io.request.mock.calls.filter(([op]) => op === 'export')).toHaveLength(1);
  await act(async () => {
    resolve({ id: 'export' });
    await pending;
  });
  hook.unmount();
  const proposalHook = mount('project', 'proposal');
  await flush();
  await act(() => proposalHook.result.current.exportMedia());
  expect(proposalHook.result.current.exportFailure).toContain('Return to canonical content');
});

it('creates a project template with AI fallback briefing only after the chat mutation is confirmed', async () => {
  const open = vi.fn();
  const hook = renderHook(() => useStudioController('group', undefined, open));
  await flush();
  act(() => {
    hook.result.current.setMode('ai');
    hook.result.current.setTemplate('project:template-id');
  });
  io.request.mockResolvedValue({ id: 'created' });
  await act(() => hook.result.current.create());
  expect(io.request).toHaveBeenCalledWith(
    'create',
    expect.objectContaining({ template: { kind: 'project', id: 'template-id' } })
  );
  expect(io.mutate).toHaveBeenCalled();
  expect(sessionStorage.getItem('studio-brief:created')).toBe('Gestalte Neue Kampagne.');
  expect(localStorage.getItem('project-chat:studio:created')).toMatch(/^[a-f0-9-]{36}$/);
  expect(open).toHaveBeenCalledWith('created');
});

it('ignores malformed returned drafts while retaining built-in themes', async () => {
  sessionStorage.setItem('studio:statement-return', 'invalid json');
  const hook = mount(null);
  await flush();
  expect(hook.result.current.title).toBe('');
  expect(hook.result.current.themes).toHaveLength(BUILTIN_THEMES.length);
});

it('applies themes and text styles only to selected rich text nodes and preserves unknown styles', async () => {
  const hook = mount();
  await flush();
  const rich = canonical.nodes.find(node => node.type === 'richText')!;
  const shape = canonical.nodes.find(node => node.type === 'shape')!;
  act(() => hook.result.current.selectExact([rich.id, shape.id]));
  const snapshot = createThemeSnapshot(BUILTIN_THEMES[1]);
  act(() => hook.result.current.applyTheme(snapshot));
  expect(hook.result.current.themeId).toBe(snapshot.themeId);
  expect(canonical.theme.themeId).toBe(snapshot.themeId);
  act(() => hook.result.current.setThemeMode('dark'));
  expect(canonical.theme.mode).toBe('dark');
  act(() => hook.result.current.applyTextStyle(canonical.theme.textStyles[0].id));
  expect(canonical.nodes.find(node => node.id === rich.id)).toMatchObject({
    typography: { textStyleId: canonical.theme.textStyles[0].id },
  });
  const before = structuredClone(canonical);
  act(() => hook.result.current.applyTextStyle('missing'));
  expect(canonical).toEqual(before);
});

it.each(['save', 'publish'])(
  'denies %s Elements from a proposal workspace before contacting the API',
  async operation => {
    const hook = mount('project', 'proposal');
    await flush();
    act(() => hook.result.current.selectExact([canonical.nodes[1].id]));
    io.request.mockClear();
    await act(async () => {
      await (operation === 'save'
        ? hook.result.current.saveSelectionToElements()
        : hook.result.current.publishSelectedElementChanges());
    });
    expect(hook.result.current.failure).toContain('Return to canonical content');
    expect(io.request).not.toHaveBeenCalled();
  }
);

it('saves, renames and archives a selected Elements set only after the editor commits', async () => {
  const hook = mount();
  await flush();
  const ids = [canonical.nodes[1].id];
  act(() => hook.result.current.selectExact(ids));
  await act(async () => expect(await hook.result.current.saveSelectionToElements()).toBe(true));
  expect(io.editor.commit).toHaveBeenCalledTimes(1);
  expect(io.request).toHaveBeenCalledWith('elementSetCreate', {
    projectId: 'project',
    groupId: 'group',
    selectedIds: ids,
  });
  await act(() => hook.result.current.renameElementSet(setId, 'Updated set'));
  await act(() => hook.result.current.archiveElementSet(setId));
  expect(io.request).toHaveBeenCalledWith('elementSetRename', { setId, name: 'Updated set' });
  expect(io.request).toHaveBeenCalledWith('elementSetArchive', { setId });
});

it.each(['empty', 'missing-project', 'unlinked'])(
  'rejects saving or publishing invalid Elements selections (%s)',
  async state => {
    const hook = mount(state === 'missing-project' ? null : 'project');
    await flush();
    io.request.mockClear();
    await act(async () => {
      await (state === 'unlinked'
        ? hook.result.current.publishSelectedElementChanges()
        : hook.result.current.saveSelectionToElements());
    });
    expect(hook.result.current.failure).toContain(
      state === 'unlinked' ? 'Select a linked Elements instance' : 'Select elements first'
    );
    expect(io.request).not.toHaveBeenCalled();
  }
);

it.each([undefined, null, 'frame'])(
  'instantiates Elements in the requested coordinate space (%s) and publishes local changes',
  async target => {
    const frameId = canonical.nodes[0].id;
    const node = canonical.nodes.find(node => node.type === 'richText')!;
    const snapshot = createElementSetSnapshot(canonical, [node.id]);
    io.request.mockImplementation(async operation =>
      operation === 'elementSetInstantiate'
        ? { setId, revisionId, snapshot, assetIds: {} }
        : operation === 'elementSetPublish'
          ? { revisionId: '00000000-0000-4000-a000-000000000003' }
          : []
    );
    const hook = mount();
    await flush();
    await act(() =>
      hook.result.current.insertElementSet(setId, {
        x: 80,
        y: 90,
        ...(target === undefined ? {} : { targetFrameId: target === null ? null : frameId }),
      })
    );
    const instance = canonical.componentInstances[0];
    expect(instance).toMatchObject({ setId, revisionId });
    expect(hook.result.current.selected).toEqual(Object.values(instance.sourceToInstance));
    expect(
      canonical.nodes.find(node => node.id === hook.result.current.selected[0])?.parentFrameId
    ).toBe(target === null ? null : frameId);
    expect(io.editor.refreshAssets).toHaveBeenCalledTimes(1);
    instance.localOverrides = { [hook.result.current.selected[0]]: ['name'] };
    instance.localDeletions = ['removed'];
    await act(() => hook.result.current.publishSelectedElementChanges());
    expect(io.request).toHaveBeenCalledWith('elementSetPublish', {
      projectId: 'project',
      instanceId: instance.id,
    });
    expect(instance.revisionId).toBe('00000000-0000-4000-a000-000000000003');
    expect(instance.localOverrides).toEqual({});
    expect(instance.localDeletions).toEqual([]);
  }
);

it.each(['no-project', 'no-document'])(
  'does not instantiate or publish into an unavailable document (%s)',
  async state => {
    if (state === 'no-document') io.editor = { ...io.editor, v3Value: null, value: null };
    const hook = mount(state === 'no-project' ? null : 'project');
    await flush();
    io.request.mockClear();
    await act(() => hook.result.current.insertElementSet(setId, { x: 0, y: 0 }));
    if (state === 'no-document') expect(hook.result.current.failure).toBe('Studio not loaded');
    else expect(io.request).not.toHaveBeenCalled();
    await act(() => hook.result.current.publishSelectedElementChanges());
  }
);

it('retains Elements selections when a published instance was concurrently removed', async () => {
  const node = canonical.nodes.find(node => node.type === 'richText')!;
  io.request.mockImplementation(async operation => {
    if (operation === 'elementSetInstantiate')
      return {
        setId,
        revisionId,
        snapshot: createElementSetSnapshot(canonical, [node.id]),
        assetIds: {},
      };
    if (operation === 'elementSetPublish') {
      canonical.componentInstances = [];
      return { revisionId: '00000000-0000-4000-a000-000000000003' };
    }
    return [];
  });
  const hook = mount();
  await flush();
  await act(() => hook.result.current.insertElementSet(setId, { x: 0, y: 0 }));
  await act(() => hook.result.current.publishSelectedElementChanges());
  expect(canonical.componentInstances).toEqual([]);
  expect(hook.result.current.failure).toBe('');
});

it.each(['single', 'story', 'video', 'presentation'] as const)(
  'inserts the %s deliverable with independent frames and matching metadata',
  async kind => {
    const hook = mount();
    await flush();
    act(() => hook.result.current.insertFrameSet(kind));
    expect(canonical.deliverables.at(-1)).toMatchObject({
      kind,
      channel: kind === 'presentation' ? 'custom' : 'instagram',
    });
    const ids = canonical.deliverables.at(-1)!.frameIds;
    expect(ids).toHaveLength(kind === 'single' ? 1 : kind === 'video' ? 5 : 3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(hook.result.current.pageId).toBe(ids[0]);
  }
);

it('prevents frame additions at the project limit and does not execute commands with no document', async () => {
  io.editor = {
    ...io.editor,
    value: {
      ...io.editor.value,
      pages: Array.from({ length: 300 }, () => io.editor.value.pages[0]),
      posts: [],
    },
  };
  const hook = mount();
  await flush();
  act(() => {
    hook.result.current.insertFrameSet('single');
    hook.result.current.insertFrame();
    hook.result.current.duplicatePage();
  });
  expect(io.editor.transactV3).not.toHaveBeenCalled();
  hook.unmount();
  io.editor = { ...io.editor, value: null, v3Value: null };
  const absent = mount();
  await flush();
  act(() => {
    absent.result.current.addTable({ rowCount: 1, colCount: 1 });
    absent.result.current.insertFrameSet('story');
    absent.result.current.setThemeMode('dark');
  });
  expect(absent.result.current.themePalette).toBeNull();
  expect(absent.result.current.themeMode).toBe('dark');
});

it('transforms a complete legacy selection and does not alter its coordinates for style-only changes', async () => {
  const legacy = createDocument('single', 'Legacy coordinates');
  io.editor = {
    ...io.editor,
    get value() {
      return structuredClone(legacy);
    },
    transact: vi.fn((callback: (doc: typeof legacy) => void) => callback(legacy)),
  };
  const hook = mount();
  await flush();
  const [first, second] = legacy.pages[0].elements;
  const x = second.x,
    y = second.y;
  act(() => hook.result.current.selectExact([first.id, second.id]));
  act(() => hook.result.current.move(first.id, { fill: '#ffffff' }));
  expect(second).toMatchObject({ x, y });
  act(() =>
    hook.result.current.transform([
      { id: first.id, patch: { x: 12 } },
      { id: second.id, patch: { y: 24 } },
    ])
  );
  expect(first.x).toBe(12);
  expect(second.y).toBe(24);
  hook.rerender();
  act(() => hook.result.current.move(first.id, { y: first.y + 20 }));
  expect(second.y).toBe(44);
  expect(second.x).toBe(x);
  act(() => hook.result.current.move('missing', { x: 50 }));
  expect(first.x).toBe(12);
});

it('keeps all local mutations inert if editing permissions disappear before the transaction', async () => {
  io.editor.transactV3.mockImplementation(() => undefined);
  const hook = mount();
  await flush();
  act(() => {
    hook.result.current.duplicatePage();
    hook.result.current.insertFrame();
    hook.result.current.insertFrameSet('single');
  });
  expect(hook.result.current.pageId).toBe('');
  expect(canonical.deliverables).toHaveLength(1);
});

it('rejects media insertion when no frame is available and keeps upload requests untouched', async () => {
  io.editor = { ...io.editor, value: { ...io.editor.value, pages: [], posts: [] } };
  const hook = mount();
  await flush();
  await act(() => hook.result.current.upload(new File(['image'], 'image.png')));
  expect(hook.result.current.failure).toBe('Select a frame to upload media.');
  expect(io.upload).not.toHaveBeenCalled();
});

it('positions a new frame on an empty canvas and keeps standalone pages independent of deliverables', async () => {
  io.editor = { ...io.editor, value: { ...io.editor.value, posts: [] } };
  canonical.nodes = [];
  canonical.deliverables = [];
  const hook = mount();
  await flush();
  act(() => hook.result.current.insertFrame('square'));
  expect(canonical.nodes[0].transform.x).toBe(0);
  expect(canonical.deliverables).toEqual([]);
  expect(canonical.nodes[0].transform).toMatchObject({ width: 1080, height: 1080 });
});

it('reports a stale legacy frame rather than accepting a failed duplicate transaction', async () => {
  io.editor = { ...io.editor, value: io.editor.value };
  canonical.nodes = [];
  canonical.deliverables = [];
  const hook = mount();
  await flush();
  expect(() => act(() => hook.result.current.duplicatePage())).toThrow('Node not found');
  expect(hook.result.current.pageId).toBe('');
});

it('instantiates a root Elements set when no legacy frame is active and preserves an unrelated instance', async () => {
  const node = canonical.nodes.find(node => node.type === 'richText')!;
  const snapshot = createElementSetSnapshot(canonical, [node.id]);
  io.editor = { ...io.editor, value: { ...io.editor.value, pages: [], posts: [] } };
  io.request.mockImplementation(async operation =>
    operation === 'elementSetInstantiate'
      ? { setId, revisionId, snapshot, assetIds: {} }
      : operation === 'elementSetPublish'
        ? { revisionId }
        : []
  );
  const hook = mount();
  await flush();
  await act(() => hook.result.current.insertElementSet(setId, { x: 17, y: 20 }));
  expect(
    canonical.nodes.find(node => node.id === hook.result.current.selected[0])?.parentFrameId
  ).toBeNull();
  canonical.componentInstances.unshift({
    ...structuredClone(canonical.componentInstances[0]),
    id: crypto.randomUUID(),
    sourceToInstance: {},
  });
  await act(() => hook.result.current.publishSelectedElementChanges());
  expect(canonical.componentInstances[0].sourceToInstance).toEqual({});
});

it('uploads media to the active frame even when all export frames are unmarked', async () => {
  io.upload.mockResolvedValue({ id: crypto.randomUUID(), mime: 'image/png' });
  const hook = mount();
  await flush();
  act(() => hook.result.current.toggleExportFrame(hook.result.current.exportFrameIds[0]));
  expect(hook.result.current.exportFrameIds).toEqual([]);
  await act(() => hook.result.current.upload(new File(['image'], 'image.png')));
  expect(io.upload).toHaveBeenCalledWith('project', expect.any(File), undefined);
  expect(hook.result.current.failure).toBe('');
  expect(io.editor.refreshAssets).toHaveBeenCalled();
});

it('expands grouped nodes while retaining unrelated selection identities', async () => {
  const [first, second] = canonical.nodes.filter(node => node.type !== 'frame');
  first.groupIds = [setId];
  second.groupIds = [setId];
  const hook = mount();
  await flush();
  act(() => hook.result.current.select([first.id]));
  expect(hook.result.current.selected).toEqual([first.id, second.id]);
  act(() => hook.result.current.selectExact([first.id, second.id]));
  expect(hook.result.current.selected).toEqual([first.id, second.id]);
});

it('ignores unavailable canvas values for legacy transformations and export frame marking', async () => {
  io.editor = { ...io.editor, value: null, v3Value: null };
  const hook = mount();
  await flush();
  act(() => {
    hook.result.current.move('missing', { x: 1 });
    hook.result.current.transform([]);
    hook.result.current.select(['missing']);
    hook.result.current.markSelectedExportFrame();
  });
  expect(io.editor.transact).not.toHaveBeenCalled();
  expect(hook.result.current.exportFrameIds).toEqual([]);
});

it('appends a duplicated frame when its prior legacy association has already changed', async () => {
  const hook = mount();
  await flush();
  act(() => hook.result.current.insertFrame());
  hook.unmount();
  const legacy = io.editor.value;
  const rootIds = canonical.deliverables[0].frameIds;
  canonical.deliverables[0].frameIds = [rootIds[1]];
  io.editor = { ...io.editor, value: legacy };
  const stale = mount();
  await flush();
  act(() => stale.result.current.duplicatePage());
  expect(canonical.deliverables[0].frameIds).toHaveLength(2);
  expect(canonical.deliverables[0].frameIds[0]).toBe(rootIds[1]);
});

it('keeps the canvas usable when Elements discovery fails and adds an explicitly unmarked export frame', async () => {
  io.request.mockRejectedValue(new Error('Library unavailable'));
  const hook = mount();
  await flush();
  expect(hook.result.current.elementSets).toEqual([]);
  expect(hook.result.current.failure).toBe('');
  const frameId = hook.result.current.exportFrameIds[0];
  act(() => hook.result.current.toggleExportFrame(frameId));
  expect(hook.result.current.exportFrameIds).toEqual([]);
  act(() => hook.result.current.toggleExportFrame(frameId));
  expect(hook.result.current.exportFrameIds).toEqual([frameId]);
});

it('retains text styles when the document contains no selectable nodes', async () => {
  canonical.nodes = [];
  canonical.deliverables = [];
  const hook = mount();
  await flush();
  act(() => hook.result.current.applyTextStyle(canonical.theme.textStyles[0].id));
  expect(canonical.nodes).toEqual([]);
  expect(hook.result.current.failure).toBe('');
});

it('updates a subscribed export when only progress, error or filename changes and ignores identical rows', async () => {
  io.request.mockImplementation(async op => (op === 'export' ? { id: 'export' } : []));
  const hook = mount();
  await flush();
  await act(() => hook.result.current.exportMedia());
  io.exports = [
    {
      id: 'export',
      status: 'queued',
      progress: 0,
      format: 'png',
      error: null,
      file_name: undefined,
    },
  ];
  hook.rerender();
  await flush();
  for (const patch of [{ progress: 20 }, { error: 'Retrying' }, { file_name: 'preview.png' }, {}]) {
    io.exports = [{ ...io.exports[0], ...patch }];
    hook.rerender();
    await flush();
    expect(hook.result.current.exports[0]).toMatchObject({
      progress: io.exports[0].progress,
      error: io.exports[0].error,
      fileName: io.exports[0].file_name,
    });
  }
});
