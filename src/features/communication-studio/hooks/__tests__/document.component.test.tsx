/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDocument } from '../../logic/templates';
import { element } from '../../logic/document';
import { initialize, readDocument } from '../../logic/collaboration';
const io = vi.hoisted(() => ({
  shared: vi.fn(),
  request: vi.fn(),
  field: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  states: vi.fn(),
}));
vi.mock('@/features/collaboration/hooks/useCollaborationDocument', () => ({
  useCollaborationDocument: io.shared,
  encodeDocument: (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),
}));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ studioRequest: io.request }));
import { useStudioDocument } from '../useStudioDocument';
let state: any, doc: Y.Doc, original: ReturnType<typeof createDocument>;
const user = { id: 'alice', name: 'Alice' };
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  doc = new Y.Doc();
  original = createDocument('single', 'Original');
  initialize(doc, original);
  state = {
    doc,
    provider: {
      awareness: { setLocalStateField: io.field, on: io.on, off: io.off, getStates: io.states },
    },
    canEdit: true,
    status: 'saved',
    phase: 'active',
    value: original,
  };
  io.shared.mockImplementation(() => state);
  io.request.mockResolvedValue([{ id: 'asset', name: 'Image', url: 'signed', mime: 'image/png' }]);
  io.states.mockReturnValue(
    new Map([
      [doc.clientID, { user: { id: 'alice' } }],
      [1, { user: { id: 'bob' }, cursor: { pageId: original.pages[0].id, x: 1, y: 2 } }],
    ])
  );
});
afterEach(() => {
  cleanup();
  doc.destroy();
  vi.useRealTimers();
});
describe('Studio shared document adapter', () => {
  it('clears old project assets and presence, and ignores asset responses from the previous project', async () => {
    const hook = renderHook(({ id }) => useStudioDocument(id, user), {
      initialProps: { id: 'first' as string | undefined },
    });
    await act(async () => undefined);
    expect(hook.result.current.assets).toHaveLength(1);
    expect(hook.result.current.peers).toHaveLength(1);
    let complete: (value: unknown) => void = () => undefined;
    io.request.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    );
    let pending: Promise<void>;
    act(() => {
      pending = hook.result.current.refreshAssets();
    });
    state = { ...state, doc: null, provider: null };
    hook.rerender({ id: undefined });
    expect(hook.result.current.assets).toEqual([]);
    expect(hook.result.current.peers).toEqual([]);
    await act(async () => {
      complete([{ id: 'private-old-asset' }]);
      await pending!;
    });
    expect(hook.result.current.assets).toEqual([]);
  });
  it('edits shared pages, captions and elements and exposes the exact revision state for confirmed exports', async () => {
    const hook = renderHook(() => useStudioDocument('project', user));
    await act(async () => undefined);
    const p = original.pages[0],
      e = p.elements[0],
      extra = element('rect');
    act(() => {
      hook.result.current.patchElement(p.id, e.id, { text: 'New' });
      hook.result.current.patchPage(p.id, { background: '#12362D' });
      hook.result.current.patchPost(original.posts[0].id, {
        action: 'Start',
        captions: { instagram: 'Caption' },
      });
      hook.result.current.insertElement(p.id, extra);
      hook.result.current.meta('title', 'Changed');
    });
    let value = readDocument(doc);
    expect(value.title).toBe('Changed');
    expect(value.pages[0].elements.find(item => item.id === e.id)!.text).toBe('New');
    expect(value.posts[0]).toMatchObject({ action: 'Start', captions: { instagram: 'Caption' } });
    expect(value.pages[0].background).toBe('#12362D');
    expect(value.pages[0].elements.some(e => e.id === extra.id)).toBe(true);
    act(() => {
      hook.result.current.removeElement(p.id, extra.id);
      hook.result.current.addPage({
        ...p,
        id: crypto.randomUUID(),
        name: 'Second',
        order: 1,
        elements: [],
      });
      hook.result.current.cursor(p.id, 10, 20);
    });
    value = readDocument(doc);
    expect(value.pages).toHaveLength(2);
    expect(value.pages[0].elements.some(e => e.id === extra.id)).toBe(false);
    expect(io.field).toHaveBeenLastCalledWith('cursor', { pageId: p.id, x: 10, y: 20 });
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Buffer.from(hook.result.current.state(), 'base64'));
    expect(readDocument(copy)).toEqual(value);
    copy.destroy();
    expect(hook.result.current.assets).toHaveLength(1);
    expect(hook.result.current.collaboration).toBe(state);
  });
  it('undoes only local origins and does not undo a remote user change', async () => {
    const hook = renderHook(() => useStudioDocument('project', user));
    await act(async () => undefined);
    act(() => hook.result.current.meta('title', 'Local'));
    doc.transact(() => doc.getMap('meta').set('startDate', '2026-09-18'), 'remote');
    act(() => hook.result.current.undo());
    expect(readDocument(doc)).toMatchObject({ title: 'Original', startDate: '2026-09-18' });
    act(() => hook.result.current.redo());
    expect(readDocument(doc)).toMatchObject({ title: 'Local', startDate: '2026-09-18' });
    state = { ...state, canEdit: false };
    hook.rerender();
    const before = hook.result.current.state();
    act(() => {
      hook.result.current.meta('title', 'Forbidden');
      hook.result.current.undo();
      hook.result.current.redo();
    });
    expect(hook.result.current.state()).toBe(before);
  });
  it('uses shared awareness, renews asset URLs and releases timers and subscriptions on unmount', async () => {
    const hook = renderHook(() => useStudioDocument('project', user));
    await act(async () => undefined);
    expect(io.field).toHaveBeenCalledWith('user', { ...user, color: '#B88A3B' });
    act(() => io.on.mock.calls[0][1]());
    expect(hook.result.current.peers).toHaveLength(1);
    expect(hook.result.current.peers[0].user.id).toBe('bob');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    expect(io.request).toHaveBeenCalledTimes(2);
    hook.unmount();
    expect(io.off).toHaveBeenCalledWith('change', io.on.mock.calls[0][1]);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(io.request).toHaveBeenCalledTimes(2);
  });
  it('keeps an unloaded or read-only session safe and supports the HTTP compatibility transport without awareness', async () => {
    state = { ...state, doc: null, provider: null, canEdit: false, phase: 'maintenance' };
    const hook = renderHook(() => useStudioDocument(undefined, user));
    expect(io.shared).toHaveBeenCalledWith(null, 'alice');
    expect(hook.result.current.status).toBe('maintenance');
    expect(() => hook.result.current.state()).toThrow('Document not loaded');
    act(() => {
      hook.result.current.meta('title', 'Ignored');
      hook.result.current.undo();
      hook.result.current.redo();
      hook.result.current.cursor('page', 1, 2);
    });
    await act(async () => hook.result.current.refreshAssets());
    expect(io.request).not.toHaveBeenCalled();
    state = { ...state, doc, canEdit: true };
    hook.rerender();
    await act(async () => undefined);
    act(() => hook.result.current.meta('title', 'Offline compatible'));
    expect(readDocument(doc).title).toBe('Offline compatible');
  });
  it('reports asset renewal errors without discarding editable document state', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    io.request.mockRejectedValue(new Error('asset unavailable'));
    try {
      const hook = renderHook(() => useStudioDocument('project', user));
      await act(async () => undefined);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(240_000);
      });
      expect(error).toHaveBeenCalledTimes(2);
      expect(hook.result.current.canEdit).toBe(true);
    } finally {
      error.mockRestore();
    }
  });
});
