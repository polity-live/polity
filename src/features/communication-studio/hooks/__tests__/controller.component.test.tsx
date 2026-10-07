// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from '../../logic/templates';
import { documentSchema, type StudioDocument } from '../../logic/document';
import { studioDocumentV3Schema } from '../../logic/document-v3';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../../logic/v3-adapter';
import * as collaboration from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  editor: {} as any,
  user: { id: 'author', email: 'author@polity.test' } as { id: string; email?: string } | null,
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({
    mutate: () => ({ client: Promise.resolve(), server: Promise.resolve({ type: 'success' }) }),
  }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: io.user }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    currentUser: {
      id: 'author',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      avatar: null,
    },
  }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], exports: [], isLoading: false }),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ useStudioApi: () => io }));
vi.mock('../useStudioDocument', () => ({ useStudioDocument: () => ({ ...io.editor }) }));
import { useStudioController } from '../useStudioController';

let ydoc: StudioDocument;
function draft(kind: StudioDocument['kind'] = 'single') {
  ydoc = documentSchema.parse(createDocument(kind, 'Manueller Entwurf'));
  io.editor = {
    get value() {
      return {
        ...structuredClone(ydoc),
        pages: [...structuredClone(ydoc.pages)].sort((a, b) => a.order - b.order),
      };
    },
    get v3Value() {
      return legacyDocumentToV3(ydoc);
    },
    canEdit: true,
    assets: [],
    peers: [],
    error: '',
    status: 'saved',
    transact: (callback: (doc: StudioDocument) => void) => callback(ydoc),
    transactV3: (callback: (doc: ReturnType<typeof legacyDocumentToV3>) => void) => {
      const document = legacyDocumentToV3(ydoc);
      callback(document);
      ydoc = documentSchema.parse(v3DocumentToLegacy(studioDocumentV3Schema.parse(document)));
    },
    patchElement: (page: string, id: string, patch: any) =>
      collaboration.patchElement(ydoc, page, id, patch, 'local'),
    patchPage: (id: string, patch: any) => collaboration.patchPage(ydoc, id, patch),
    patchPost: (id: string, patch: any) => collaboration.patchPost(ydoc, id, patch),
    insertElement: (page: string, item: any) => collaboration.insertElement(ydoc, page, item),
    removeElement: (page: string, id: string) => collaboration.removeElement(ydoc, page, id),
    meta: (key: string, value: any) => Object.assign(ydoc, { [key]: value }),
    commit: async () => 0,
    refreshAssets: vi.fn().mockResolvedValue(undefined),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  io.user = { id: 'author', email: 'author@polity.test' };
  sessionStorage.clear();
  io.request.mockResolvedValue([]);
  draft();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('studio editing workflows', () => {
  it('inserts the chosen table size and selects the new element', () => {
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    let id: string | null = null;
    act(() => {
      id = hook.result.current.addTable({ rowCount: 4, colCount: 5 });
    });
    const table = ydoc.pages[0].elements.find(item => item.id === id);
    expect(table?.table?.rows).toHaveLength(4);
    expect(table?.table?.widths).toHaveLength(5);
    expect(hook.result.current.selected).toEqual([id]);
  });
  it('creates an intentionally blank template even when a brief is present', async () => {
    const hook = renderHook(() => useStudioController(null, undefined, vi.fn()));
    act(() => {
      hook.result.current.setBrief('Keep the template blank');
      hook.result.current.setTemplate('blank');
    });
    io.request.mockResolvedValue({ id: 'blank' });
    await act(() => hook.result.current.create());
    expect(io.request).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ template: { kind: 'builtin', id: 'blank' } })
    );
  });
  it('can initialize the first page of an empty draft', () => {
    io.editor = { ...io.editor, value: { ...io.editor.value, pages: [], posts: [] } };
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => hook.result.current.insertPage());
    expect(structuredClone(ydoc).pages).toHaveLength(2);
  });
  it('treats a missing post association as a standalone page for export and duplication', async () => {
    ydoc.posts = [];
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const page = hook.result.current.page!;
    await act(() => hook.result.current.exportMedia());
    expect(io.request).toHaveBeenLastCalledWith(
      'export',
      expect.objectContaining({ pageIds: [page.id] })
    );
    act(() => hook.result.current.duplicatePage());
    expect(io.editor.value.pages).toHaveLength(2);
    expect(io.editor.value.posts).toEqual([]);
  });
  it('keeps a minimal returned statement usable without an authenticated identity or optional text', async () => {
    io.user = null;
    sessionStorage.setItem('studio:statement-return', '{}');
    const hook = renderHook(() => useStudioController(null, undefined, vi.fn()));
    expect(hook.result.current.title).toBe('Neuer Beitrag');
    expect(hook.result.current.brief).toBe('');
    expect(hook.result.current.kind).toBe('single');
    io.request.mockRejectedValue('authentication_required');
    await act(() => hook.result.current.create());
    expect(hook.result.current.failure).toBe('authentication_required');
    expect(io.notifyError).toHaveBeenCalledWith('authentication_required');
  });
  it('ignores stale selections on a blank page', () => {
    const page = io.editor.value.pages[0];
    for (const e of page.elements) io.editor.removeElement(page.id, e.id);
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => hook.result.current.select(['deleted']));
    act(() => {
      hook.result.current.align();
      hook.result.current.patch('deleted', { x: 120 });
    });
    expect(io.editor.value.pages[0].elements).toEqual([]);
  });
  it('removes an empty post when its last page is deleted while retaining another post', () => {
    const value = createDocument('single', 'Other'),
      original = io.editor.value;
    value.pages[0].order = 1;
    ydoc = documentSchema.parse({
      ...original,
      pages: [...original.pages, ...value.pages],
      posts: [...original.posts, ...value.posts],
    });
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const id = hook.result.current.page!.id;
    act(() => hook.result.current.removePage());
    expect(io.editor.value.pages.map((p: any) => p.id)).not.toContain(id);
    expect(io.editor.value.posts).toHaveLength(1);
    expect(io.editor.value.posts[0].pageIds).toEqual([value.pages[0].id]);
  });
  it('groups and moves a selection, duplicates independent identities, aligns and deletes selected elements', () => {
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const [a, b] = io.editor.value.pages[0].elements;
    act(() => hook.result.current.select([a.id, b.id]));
    act(() => hook.result.current.groupSelected());
    hook.rerender();
    act(() => hook.result.current.select([a.id]));
    expect(hook.result.current.selected).toEqual([a.id, b.id]);
    act(() => hook.result.current.move(a.id, { y: a.y + 12 }));
    hook.rerender();
    expect(io.editor.value.pages[0].elements[1].y).toBe(b.y + 12);
    act(() => hook.result.current.ungroup());
    act(() => hook.result.current.duplicateSelected());
    hook.rerender();
    expect(io.editor.value.pages[0].elements).toHaveLength(6);
    expect(io.editor.value.pages[0].elements.at(-1).group).toBeNull();
    act(() => hook.result.current.align());
    act(() => hook.result.current.deleteSelected());
    hook.rerender();
    expect(hook.result.current.selected).toEqual([]);
    expect(
      io.editor.value.pages[0].elements.every((e: any) => e.id !== a.id && e.id !== b.id)
    ).toBe(true);
    act(() => hook.result.current.add('text'));
    hook.rerender();
    expect(hook.result.current.active?.text).toBe('Neuer Text');
    act(() => hook.result.current.add('ellipse'));
    hook.rerender();
    expect(hook.result.current.active?.type).toBe('ellipse');
  });
  it('reorders pages and exports marked frames in layer order', async () => {
    draft('carousel');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const first = hook.result.current.page!;
    act(() => hook.result.current.movePage(-1));
    expect(io.editor.value.pages[0].id).toBe(first.id);
    act(() => hook.result.current.movePage(1));
    hook.rerender();
    expect(io.editor.value.pages[1].id).toBe(first.id);
    await act(() => hook.result.current.exportMedia());
    expect(io.request).toHaveBeenLastCalledWith(
      'export',
      expect.objectContaining({ pageIds: hook.result.current.exportFrameIds })
    );
    const onlyFrame = hook.result.current.exportFrameIds[1];
    act(() => {
      for (const frameId of hook.result.current.exportFrameIds)
        if (frameId !== onlyFrame) hook.result.current.toggleExportFrame(frameId);
    });
    await act(() => hook.result.current.exportMedia());
    expect(io.request).toHaveBeenLastCalledWith(
      'export',
      expect.objectContaining({ pageIds: [onlyFrame] })
    );
  });
  it('saves photo edits only after upload succeeds', async () => {
    draft('story');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const asset = crypto.randomUUID(),
      replacement = crypto.randomUUID();
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    await act(() => hook.result.current.upload(new File(['image'], 'image.png')));
    hook.rerender();
    const id = hook.result.current.active!.id;
    act(() =>
      hook.result.current.patch(id, {
        crop: {
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          naturalWidth: 100,
          naturalHeight: 100,
        },
      })
    );
    io.upload.mockResolvedValue({ id: replacement, mime: 'image/png' });
    act(() => hook.result.current.setPhotoEdit(asset));
    await act(async () => {
      expect(await hook.result.current.savePhoto(new File(['edit'], 'edit.png'))).toBe(true);
    });
    hook.rerender();
    expect(hook.result.current.photoEdit).toBeUndefined();
    expect(io.editor.value.pages[0].elements.find((e: any) => e.id === id).assetId).toBe(
      replacement
    );
    expect(io.editor.value.pages[0].elements.find((e: any) => e.id === id).crop).toBeNull();
  });
  it('restores statement form text and moves AI briefing into a shared project chat', async () => {
    sessionStorage.setItem(
      'studio:statement-return',
      JSON.stringify({ title: 'Rückkehr', text: 'Text aus Beitrag', isStory: true })
    );
    const open = vi.fn();
    const hook = renderHook(() => useStudioController(null, undefined, open));
    expect(hook.result.current.title).toBe('Rückkehr');
    expect(hook.result.current.kind).toBe('story');
    expect(hook.result.current.brief).toBe('Text aus Beitrag');
    io.request.mockResolvedValue({ id: 'new' });
    await act(() => hook.result.current.create());
    expect(io.request).toHaveBeenCalledWith(
      'create',
      expect.objectContaining({ title: 'Rückkehr', kind: 'story' })
    );
    act(() => hook.result.current.setMode('ai'));
    io.request.mockResolvedValue({ id: crypto.randomUUID() });
    await act(() => hook.result.current.create());
    expect(io.request.mock.calls.some(([op]) => op === 'generate')).toBe(false);
    io.request.mockImplementation(async op =>
      op === 'generate'
        ? {
            posts: [
              {
                title: 'Entwurf',
                action: 'Start',
                instagram: 'IG',
                linkedin: 'LI',
                facebook: 'FB',
                slides: [{ title: 'Titel', text: 'Text' }],
              },
            ],
          }
        : { id: '00000000-0000-4000-a000-000000000002' }
    );
    await act(() => hook.result.current.create());
    expect(open).toHaveBeenLastCalledWith('00000000-0000-4000-a000-000000000002');
  });
  it('does not execute editor commands before a document is available', async () => {
    io.editor = { ...io.editor, value: null };
    const hook = renderHook(() => useStudioController(null, undefined, vi.fn()));
    await act(() => Promise.resolve());
    io.request.mockClear();
    const before = JSON.stringify(io.editor.value);
    act(() => {
      hook.result.current.select(['missing']);
      hook.result.current.patch('missing', { x: 5 });
      hook.result.current.add('text');
      hook.result.current.duplicatePage();
      hook.result.current.removePage();
      hook.result.current.changeFormat('story');
      hook.result.current.movePage(1);
      hook.result.current.deleteSelected();
      hook.result.current.duplicateSelected();
      hook.result.current.groupSelected();
      hook.result.current.ungroup();
      hook.result.current.align();
      hook.result.current.insertPage();
    });
    await act(async () => {
      await hook.result.current.upload(new File(['x'], 'image.png'));
      await hook.result.current.exportMedia();
      expect(await hook.result.current.savePhoto(new File(['x'], 'image.png'))).toBe(false);
    });
    expect(JSON.stringify(io.editor.value)).toBe(before);
    expect(io.request).not.toHaveBeenCalled();
    expect(io.upload).not.toHaveBeenCalled();
  });
  it('creates the requested eight-week group campaign only after server confirmation', async () => {
    const open = vi.fn();
    const { result } = renderHook(() => useStudioController('group', undefined, open));
    act(() => {
      result.current.setTitle('Gemeinsam entscheiden');
      result.current.setKind('campaign');
      result.current.setWeeks(8);
    });
    let confirm: (value: any) => void = () => {
      throw new Error('Request has not started');
    };
    io.request.mockImplementation((operation: string) =>
      operation === 'create'
        ? new Promise(resolve => {
            confirm = resolve;
          })
        : Promise.resolve([])
    );
    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.create();
    });
    expect(result.current.busy).toBe(true);
    expect(open).not.toHaveBeenCalled();
    const payload = io.request.mock.calls.find(call => call[0] === 'create')![1];
    expect(payload.groupId).toBe('group');
    expect(payload).toMatchObject({
      title: 'Gemeinsam entscheiden',
      kind: 'campaign',
      campaign: { weeks: 8, core: 3, stories: 2 },
      themeMode: 'light',
      template: { kind: 'builtin', id: 'announcement' },
    });
    await act(async () => {
      confirm({ id: 'saved-project' });
      await pending;
    });
    expect(open).toHaveBeenCalledWith('saved-project');
    expect(result.current.busy).toBe(false);
  });
  it('retains the creation form and reports a server rejection', async () => {
    const open = vi.fn();
    const { result } = renderHook(() => useStudioController(null, undefined, open));
    act(() => result.current.setTitle('Bleibt erhalten'));
    io.request.mockRejectedValue(new Error('No access'));
    await act(async () => {
      await result.current.create();
    });
    expect(result.current.title).toBe('Bleibt erhalten');
    expect(result.current.failure).toBe('No access');
    expect(result.current.busy).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
  it('duplicates a long-named page with new element identities and removes its references atomically', () => {
    const initial = io.editor.value;
    io.editor.patchPage(initial.pages[0].id, { name: 'a'.repeat(160) });
    const { result, rerender } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => result.current.duplicatePage());
    rerender();
    let value = io.editor.value;
    expect(documentSchema.safeParse(value).success).toBe(true);
    expect(value.pages).toHaveLength(2);
    expect(value.pages[1].elements[1].id).not.toBe(value.pages[0].elements[1].id);
    expect(value.posts[0].pageIds).toContain(value.pages[1].id);
    act(() => result.current.removePage());
    value = io.editor.value;
    expect(value.pages).toHaveLength(1);
    expect(value.posts[0].pageIds).toEqual([initial.pages[0].id]);
    expect(documentSchema.safeParse(value).success).toBe(true);
  });
  it('keeps the last page and prevents adding beyond a video duration limit', () => {
    const single = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => single.result.current.removePage());
    expect(io.editor.value.pages).toHaveLength(1);
    single.unmount();
    draft('video');
    for (const page of io.editor.value.pages) io.editor.patchPage(page.id, { duration: 12 });
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => {
      result.current.insertPage();
      result.current.duplicatePage();
    });
    expect(io.editor.value.pages).toHaveLength(5);
    expect(documentSchema.safeParse(io.editor.value).success).toBe(true);
  });
  it('adds and duplicates video scenes while the combined duration remains within the limit', () => {
    draft('video');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => hook.result.current.insertPage());
    hook.rerender();
    act(() => hook.result.current.duplicatePage());
    const current = io.editor.value;
    expect(current.pages).toHaveLength(7);
    expect(current.posts[0].pageIds).toHaveLength(7);
    expect(documentSchema.safeParse(current).success).toBe(true);
  });
  it('creates a carousel as five independent frames', () => {
    const { result, rerender } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const initialCount = io.editor.value.pages.length;
    act(() => result.current.insertFrameSet('carousel'));
    rerender();
    const added = io.editor.value.pages.slice(initialCount);
    expect(added).toHaveLength(5);
    expect(added.map((page: any) => page.name)).toEqual([
      'Karussell 1',
      'Karussell 2',
      'Karussell 3',
      'Karussell 4',
      'Karussell 5',
    ]);
    expect(new Set(added.map((page: any) => page.id)).size).toBe(5);
  });
  it('leaves a valid local project usable while optional group themes fail', async () => {
    io.request.mockRejectedValueOnce(new Error('temporarily unavailable'));
    const hook = renderHook(() => useStudioController('group', 'project', vi.fn()));
    await act(() => Promise.resolve());
    expect(hook.result.current.themes).toHaveLength(7);
    expect(hook.result.current.themes[0]).toMatchObject({ name: 'Polity', scope: 'builtin' });
    expect(hook.result.current.page).toBeDefined();
    expect(hook.result.current.failure).toBe('');
  });
  it('prevents a carousel from exceeding thirty pages', () => {
    const { result, rerender } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    for (let i = 1; i < 30; i++) {
      act(() => result.current.insertPage());
      rerender();
    }
    act(() => {
      result.current.insertPage();
      result.current.duplicatePage();
    });
    expect(io.editor.value.pages).toHaveLength(30);
    expect(documentSchema.safeParse(io.editor.value).success).toBe(true);
  });
  it('adapts a format without replacing the editable content', () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const original = io.editor.value.pages[0];
    act(() => result.current.changeFormat('square'));
    const page = io.editor.value.pages[0];
    expect(page.format).toBe('square');
    expect(page.elements.map((e: any) => [e.id, e.text])).toEqual(
      original.elements.map((e: any) => [e.id, e.text])
    );
    expect(page.elements.every((e: any) => e.y + e.height <= 1080)).toBe(true);
  });
  it('moves selected elements together while leaving locked companions in place', () => {
    const { result, rerender } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const page = io.editor.value.pages[0];
    const [a, b, c] = page.elements;
    io.editor.patchElement(page.id, c.id, { locked: true });
    act(() => result.current.select([a.id, b.id, c.id]));
    rerender();
    act(() => result.current.move(a.id, { x: a.x + 50 }));
    const elements = io.editor.value.pages[0].elements;
    expect(elements[0].x).toBe(a.x + 50);
    expect(elements[1].x).toBe(b.x + 50);
    expect(elements[2].x).toBe(c.x);
  });
  it('does not expose the retired direct AI acceptance path', () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    expect(result.current).not.toHaveProperty('acceptAI');
    expect(result.current).not.toHaveProperty('ai');
  });
  it('does not add broken media after a failed upload', async () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const before = io.editor.value;
    io.upload.mockRejectedValue(new Error('Upload failed'));
    await act(async () => {
      await result.current.upload(new File(['clip'], 'clip.mp4', { type: 'video/mp4' }));
    });
    expect(io.editor.value).toEqual(before);
    expect(result.current.failure).toBe('Upload failed');
  });
  it('adds an uploaded video as an editable muted clip', async () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const assetId = crypto.randomUUID();
    io.upload.mockResolvedValue({ id: assetId, mime: 'video/mp4' });
    await act(async () => {
      await result.current.upload(new File(['clip'], 'clip.mp4', { type: 'video/mp4' }));
    });
    expect(io.editor.value.pages[0].elements.at(-1)).toMatchObject({
      assetId,
      type: 'video',
      muted: true,
      trimStart: 0,
    });
    expect(io.editor.refreshAssets).toHaveBeenCalled();
  });
  it('queues the marked frame and the current shared state for export', async () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => {
      result.current.setFormat('pptx');
    });
    await act(async () => {
      await result.current.exportMedia();
    });
    const payload = io.request.mock.calls.find(call => call[0] === 'export')![1];
    expect(payload).toMatchObject({
      projectId: 'project',
      format: 'pptx',
      pageIds: [io.editor.value.pages[0].id],
    });
    expect(documentSchema.safeParse(ydoc).success).toBe(true);
  });
});
