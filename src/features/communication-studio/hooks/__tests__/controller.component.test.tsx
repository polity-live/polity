// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDocument } from '../../logic/templates';
import { documentSchema, element, type StudioDocument } from '../../logic/document';
import * as collaboration from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  request: vi.fn(),
  upload: vi.fn(),
  notifyError: vi.fn(),
  editor: {} as any,
  user: { id: 'author', email: 'author@polity.test' } as { id: string; email?: string } | null,
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: io.user }),
}));
vi.mock('@/zero/communication-studio/useStudioState', () => ({
  useStudioState: () => ({ projects: [], exports: [], isLoading: false }),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ useStudioApi: () => io }));
vi.mock('../useStudioDocument', () => ({ useStudioDocument: () => ({ ...io.editor }) }));
import { useStudioController } from '../useStudioController';

let ydoc: Y.Doc;
function draft(kind: StudioDocument['kind'] = 'single') {
  ydoc?.destroy();
  ydoc = new Y.Doc();
  collaboration.initialize(ydoc, createDocument(kind, 'Manueller Entwurf'));
  io.editor = {
    get value() {
      return collaboration.readDocument(ydoc);
    },
    canEdit: true,
    assets: [],
    peers: [],
    error: '',
    status: 'saved',
    transact: (callback: (doc: Y.Doc) => void) => ydoc.transact(() => callback(ydoc)),
    patchElement: (page: string, id: string, patch: any) =>
      collaboration.patchElement(ydoc, page, id, patch, 'local'),
    patchPage: (id: string, patch: any) => collaboration.patchPage(ydoc, id, patch),
    patchPost: (id: string, patch: any) => collaboration.patchPost(ydoc, id, patch),
    insertElement: (page: string, item: any) => collaboration.insertElement(ydoc, page, item),
    removeElement: (page: string, id: string) => collaboration.removeElement(ydoc, page, id),
    meta: (key: string, value: any) => ydoc.getMap('meta').set(key, value),
    state: () => Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64'),
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
  ydoc.destroy();
  vi.useRealTimers();
});

describe('studio editing workflows', () => {
  it('creates an intentionally blank template even when a brief is present', async () => {
    const hook = renderHook(() => useStudioController(null, undefined, vi.fn()));
    act(() => {
      hook.result.current.setBrief('Keep the template blank');
      hook.result.current.setTemplate('blank');
    });
    io.request.mockResolvedValue({ id: 'blank' });
    await act(() => hook.result.current.create());
    expect(io.request.mock.calls.at(-1)![1].document.pages[0].elements).toEqual([]);
  });
  it('stops preview when no page has arrived and can initialize the first page of an empty draft', async () => {
    vi.useFakeTimers();
    io.editor = { ...io.editor, value: { ...io.editor.value, pages: [], posts: [] } };
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => hook.result.current.setPlaying(true));
    await act(() => vi.advanceTimersByTimeAsync(5200));
    expect(hook.result.current.playing).toBe(false);
    act(() => hook.result.current.insertPage());
    expect(collaboration.readDocument(ydoc).pages).toHaveLength(2);
  });
  it('treats a missing post association as a standalone page for export and duplication', async () => {
    for (const key of ydoc.getMap('posts').keys()) ydoc.getMap('posts').delete(key);
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
  it('preserves custom fonts and colors when an imported group theme has unknown fonts', () => {
    draft('carousel');
    const initial = io.editor.value;
    const [a, b] = initial.pages;
    io.editor.patchPage(b.id, { background: '#123456' });
    io.editor.patchElement(a.id, a.elements[0].id, { font: 'Ubuntu', fill: initial.brand.accent });
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() =>
      result.current.applyTheme({
        id: 'theme',
        revision_id: 'revision',
        light_palette: { background: '#ABCDEF', foreground: '#112233', accent: '#445566' },
        fonts: { display: 'unknown', sans: 'unknown' },
      })
    );
    const value = io.editor.value;
    expect(value.brand).toMatchObject({ font: 'Newsreader', bodyFont: 'Manrope' });
    expect(value.pages[0].elements[0]).toMatchObject({ font: 'Ubuntu', fill: '#445566' });
    expect(value.pages[1].background).toBe('#123456');
    expect(value.pages[2].background).toBe('#ABCDEF');
  });
  it('ignores stale selections and supports source replacement on a blank page', () => {
    const page = io.editor.value.pages[0];
    for (const e of page.elements) io.editor.removeElement(page.id, e.id);
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => hook.result.current.select(['deleted']));
    act(() => {
      hook.result.current.align();
      hook.result.current.patch('deleted', { x: 120 });
      hook.result.current.source({
        type: 'event',
        id: crypto.randomUUID(),
        title: 'New source',
        text: 'Source text',
        updatedAt: 1,
      });
    });
    expect(io.editor.value.pages[0].elements).toEqual([]);
    expect(io.editor.value.title).toBe('New source');
  });
  it('removes an empty post when its last page is deleted while retaining another post', () => {
    const value = createDocument('single', 'Other'),
      original = io.editor.value;
    value.pages[0].order = 1;
    ydoc.destroy();
    ydoc = new Y.Doc();
    collaboration.initialize(ydoc, {
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
    act(() => hook.result.current.patch(a.id, { y: a.y + 12 }));
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
  it('adopts a selected source, reorders pages and exports whole projects or posts', async () => {
    draft('carousel');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const first = hook.result.current.page!;
    act(() =>
      hook.result.current.source({
        type: 'event',
        id: crypto.randomUUID(),
        title: 'Sitzung',
        text: 'Tagesordnung',
        updatedAt: 1,
      })
    );
    hook.rerender();
    expect(io.editor.value.title).toBe('Sitzung');
    expect(io.editor.value.pages[0].elements.some((e: any) => e.text === 'Tagesordnung')).toBe(
      true
    );
    act(() => hook.result.current.movePage(-1));
    expect(io.editor.value.pages[0].id).toBe(first.id);
    act(() => hook.result.current.movePage(1));
    hook.rerender();
    expect(io.editor.value.pages[1].id).toBe(first.id);
    await act(() => hook.result.current.loadSources());
    expect(io.request).toHaveBeenCalledWith('sources', { type: 'event' });
    await act(() => hook.result.current.exportMedia());
    expect(io.request).toHaveBeenLastCalledWith(
      'export',
      expect.objectContaining({ pageIds: io.editor.value.posts[0].pageIds })
    );
    act(() => hook.result.current.setScope('all'));
    await act(() => hook.result.current.exportMedia());
    expect(io.request).toHaveBeenLastCalledWith('export', expect.objectContaining({ pageIds: [] }));
  });
  it('renews an existing logo across story pages and saves photo edits only after upload succeeds', async () => {
    draft('story');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const asset = crypto.randomUUID(),
      replacement = crypto.randomUUID();
    io.upload.mockResolvedValue({ id: asset, mime: 'image/png' });
    await act(() => hook.result.current.upload(new File(['image'], 'image.png')));
    hook.rerender();
    const id = hook.result.current.active!.id;
    act(() => hook.result.current.applyLogo());
    hook.rerender();
    const before = io.editor.value.pages.map((p: any) => p.elements.length);
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
    act(() => hook.result.current.applyLogo());
    hook.rerender();
    expect(io.editor.value.pages.map((p: any) => p.elements.length)).toEqual(before);
    expect(io.editor.value.brand.logoAssetId).toBe(replacement);
  });
  it('runs silent video preview through each page and stops at the end without changing document content', async () => {
    vi.useFakeTimers();
    draft('video');
    const hook = renderHook(() => useStudioController(null, 'project', vi.fn()));
    const before = io.editor.state();
    act(() => hook.result.current.setPlaying(true));
    for (let i = 0; i < 5; i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
    expect(hook.result.current.playing).toBe(false);
    expect(hook.result.current.time).toBe(0);
    expect(io.editor.state()).toBe(before);
  });
  it('restores statement form text, keeps manual brief text and refuses incomplete AI content', async () => {
    sessionStorage.setItem(
      'studio:statement-return',
      JSON.stringify({ title: 'Rückkehr', text: 'Text aus Beitrag', isStory: true })
    );
    const open = vi.fn();
    const hook = renderHook(() => useStudioController(null, undefined, open));
    expect(hook.result.current.title).toBe('Rückkehr');
    expect(hook.result.current.kind).toBe('story');
    io.request.mockResolvedValue({ id: 'new' });
    await act(() => hook.result.current.create());
    expect(
      io.request.mock.calls
        .find(([op]) => op === 'create')![1]
        .document.pages[0].elements.some((e: any) => e.text === 'Text aus Beitrag')
    ).toBe(true);
    act(() => hook.result.current.setMode('ai'));
    io.request.mockResolvedValue({ posts: [] });
    await act(() => hook.result.current.create());
    expect(hook.result.current.failure).toContain('unvollständig');
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
        : { id: 'ai-project' }
    );
    await act(() => hook.result.current.create());
    expect(open).toHaveBeenLastCalledWith('ai-project');
  });
  it('does not execute editor commands before a document is available', async () => {
    io.editor = { ...io.editor, value: null };
    const hook = renderHook(() => useStudioController(null, undefined, vi.fn()));
    const before = io.editor.state();
    act(() => {
      hook.result.current.select(['missing']);
      hook.result.current.patch('missing', { x: 5 });
      hook.result.current.add('text');
      hook.result.current.duplicatePage();
      hook.result.current.removePage();
      hook.result.current.applyTheme({});
      hook.result.current.updateBrand({} as any);
      hook.result.current.source({});
      hook.result.current.acceptAI();
      hook.result.current.changeFormat('story');
      hook.result.current.movePage(1);
      hook.result.current.applyLogo();
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
      await hook.result.current.ai();
      expect(await hook.result.current.savePhoto(new File(['x'], 'image.png'))).toBe(false);
    });
    expect(io.editor.state()).toBe(before);
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
    expect(payload.document.posts).toHaveLength(40);
    expect(documentSchema.safeParse(payload.document).success).toBe(true);
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
  it('leaves a valid local project usable while optional group themes fail', async () => {
    io.request.mockRejectedValueOnce(new Error('temporarily unavailable'));
    const hook = renderHook(() => useStudioController('group', 'project', vi.fn()));
    await act(() => Promise.resolve());
    expect(hook.result.current.themes).toEqual([]);
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
    act(() => result.current.patch(a.id, { x: a.x + 50 }));
    const elements = io.editor.value.pages[0].elements;
    expect(elements[0].x).toBe(a.x + 50);
    expect(elements[1].x).toBe(b.x + 50);
    expect(elements[2].x).toBe(c.x);
  });
  it('applies group brand settings while preserving custom colors', () => {
    const page = io.editor.value.pages[0];
    io.editor.patchElement(page.id, page.elements[0].id, { fill: '#112233' });
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() =>
      result.current.applyTheme({
        id: 'theme',
        revision_id: 'revision',
        light_palette: { background: '#FFFFFF', foreground: '#000000', accent: '#FF0000' },
        fonts: { display: 'inter', sans: 'ubuntu' },
      })
    );
    const value = io.editor.value;
    expect(value.brand).toMatchObject({
      themeId: 'theme',
      revisionId: 'revision',
      font: 'Inter',
      bodyFont: 'Ubuntu',
    });
    expect(value.pages[0].elements[0].fill).toBe('#112233');
    expect(value.pages[0].elements[1].fill).toBe('#FFFFFF');
    expect(value.pages[0].background).toBe('#000000');
  });
  it('keeps generated copy as a proposal until explicitly accepted', async () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    io.request.mockResolvedValue({
      title: 'KI-Vorschlag',
      posts: [
        {
          title: 'Neuer Titel',
          action: 'Anmelden',
          instagram: 'Instagram',
          linkedin: 'LinkedIn',
          facebook: 'Facebook',
          slides: [{ title: 'Neue Überschrift', text: 'Neuer Text' }],
        },
      ],
    });
    await act(async () => {
      await result.current.ai();
    });
    expect(io.editor.value.title).toBe('Manueller Entwurf');
    expect(result.current.proposal?.posts[0].title).toBe('Neuer Titel');
    act(() => result.current.acceptAI());
    expect(io.editor.value.title).toBe('Manueller Entwurf');
    expect(io.editor.value.posts[0].title).toBe('Neuer Titel');
    expect(io.editor.value.posts[0].captions.linkedin).toBe('LinkedIn');
    expect(result.current.proposal).toBeNull();
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
  it('queues the selected page and the current shared state for export', async () => {
    const { result } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => {
      result.current.setScope('page');
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
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Buffer.from(payload.state, 'base64'));
    expect(collaboration.readDocument(restored)).toEqual(io.editor.value);
    restored.destroy();
  });
  it('reuses the group logo on every page without flattening the layout', () => {
    draft('carousel');
    const value = io.editor.value,
      assetId = crypto.randomUUID();
    const logo = element('image', { assetId });
    io.editor.insertElement(value.pages[0].id, logo);
    const { result, rerender } = renderHook(() => useStudioController(null, 'project', vi.fn()));
    act(() => result.current.select([logo.id]));
    rerender();
    act(() => result.current.applyLogo());
    expect(io.editor.value.brand.logoAssetId).toBe(assetId);
    expect(
      io.editor.value.pages.every((page: any) =>
        page.elements.some((e: any) => e.assetId === assetId)
      )
    ).toBe(true);
    expect(
      io.editor.value.pages.every((page: any) => page.elements.some((e: any) => e.type === 'text'))
    ).toBe(true);
  });
});
