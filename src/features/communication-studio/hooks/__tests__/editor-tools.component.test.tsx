// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDocument } from '../../logic/templates';
const io = vi.hoisted(() => ({ request: vi.fn(), changed: undefined as undefined | (() => void) }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return {
    useStudioClient: () =>
      Object.assign(studioClientFixture(io), {
        watchEditorActions: (_input: unknown, changed: () => void) => {
          io.changed = changed;
          queueMicrotask(changed);
          return () => undefined;
        },
      }),
  };
});
import { useStudioEditorTools } from '../useStudioEditorTools';
import type { useStudioController } from '../useStudioController';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function controller() {
  const value = createDocument('single', 'Editor tools');
  return {
    id: 'project',
    workspaceId: null,
    value,
    page: value.pages[0],
    selected: [value.pages[0].elements[0].id],
    canEdit: true,
    canUndo: true,
    canRedo: true,
    setPageId: vi.fn(),
    select: vi.fn(),
    setGuides: vi.fn(),
    transact: vi.fn((change: (doc: typeof value) => void) => change(value)),
    commit: vi.fn().mockResolvedValue(7),
    undo: vi.fn().mockReturnValue(true),
    redo: vi.fn().mockReturnValue(true),
  };
}
async function run(
  c: ReturnType<typeof controller>,
  actions: { name: string; input: unknown; id?: string }[]
) {
  io.request.mockImplementation(async (op: string) =>
    op === 'editorActions'
      ? actions.map((action, index) => ({ id: action.id ?? `action-${index}`, ...action }))
      : op === 'duplicate'
        ? { id: 'copy-project' }
        : {}
  );
  const hook = renderHook(() =>
    useStudioEditorTools(c as unknown as ReturnType<typeof useStudioController>)
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return hook;
}
const results = () =>
  io.request.mock.calls.filter(([op]) => op === 'editorResult').map(([, body]) => body.result);

it('clears the clipboard when the active page disappeared and rejects a later paste', async () => {
  const c = { ...controller(), page: undefined };
  await run(c as unknown as ReturnType<typeof controller>, [
    { name: 'studio_copy_selection', input: {} },
    { name: 'studio_paste_selection', input: {} },
  ]);
  expect(results()).toEqual([
    { status: 'completed', revision: 7 },
    { status: 'failed', error: 'Copy a selection first' },
  ]);
  expect(c.transact).not.toHaveBeenCalled();
});

it('selects existing pages and elements, opens panels and toggles preview and guides before acknowledgement', async () => {
  const c = controller();
  const event = vi.spyOn(window, 'dispatchEvent');
  await run(c, [
    { name: 'studio_select_page', input: { pageId: c.page.id } },
    { name: 'studio_select_elements', input: { pageId: c.page.id, elementIds: c.selected } },
    { name: 'studio_preview', input: { playing: true } },
    { name: 'studio_guides', input: { visible: false } },
    { name: 'studio_open_panel', input: { panel: 'layers' } },
  ]);
  expect(c.setPageId).toHaveBeenCalledWith(c.page.id);
  expect(c.select.mock.calls).toEqual([[[]], [c.selected]]);
  expect(c.setGuides).toHaveBeenCalledWith(false);
  expect(
    event.mock.calls.some(([e]) => e.type === 'studio-preview' && (e as CustomEvent).detail.open)
  ).toBe(true);
  expect(
    event.mock.calls.some(
      ([e]) => e.type === 'studio-open-panel' && (e as CustomEvent).detail === 'layers'
    )
  ).toBe(true);
  expect(results()).toHaveLength(5);
  expect(results().every(result => result.status === 'completed' && result.revision === 7)).toBe(
    true
  );
});
it('copies selected elements into fresh ungrouped identities with an offset and commits project commands', async () => {
  const c = controller();
  const source = structuredClone(c.page.elements[0]);
  const count = c.page.elements.length;
  await run(c, [
    { name: 'studio_copy_selection', input: {} },
    { name: 'studio_paste_selection', input: {} },
    { name: 'studio_undo_local', input: {} },
    { name: 'studio_redo_local', input: {} },
    { name: 'studio_copy_project', input: {} },
    { name: 'studio_save_template', input: {} },
  ]);
  expect(c.page.elements).toHaveLength(count + 1);
  expect(c.page.elements.at(-1)).toMatchObject({ x: source.x + 30, y: source.y + 30, group: null });
  expect(c.page.elements.at(-1)?.id).not.toBe(source.id);
  expect(c.undo).toHaveBeenCalledTimes(1);
  expect(c.redo).toHaveBeenCalledTimes(1);
  expect(io.request).toHaveBeenCalledWith('template', { id: 'project', value: true });
  expect(results()[4]).toEqual({ status: 'completed', projectId: 'copy-project' });
});
it.each([
  ['studio_select_page', 'Page no longer exists'],
  ['studio_select_elements', 'Element no longer exists'],
  ['studio_paste_selection', 'Copy a selection first'],
])(
  'acknowledges invalid %s commands as failures without changing the document',
  async (name, error) => {
    const c = controller();
    const before = structuredClone(c.value);
    await run(c, [
      {
        name,
        input: {
          pageId: name === 'studio_select_page' ? 'missing' : c.page.id,
          elementIds: ['missing'],
        },
      },
    ]);
    expect(results()).toEqual([{ status: 'failed', error }]);
    expect(c.value).toEqual(before);
  }
);
it.each(['studio_paste_selection', 'studio_undo_local', 'studio_redo_local'])(
  'rejects read-only %s commands',
  async name => {
    const c = controller();
    c.canEdit = false;
    await run(c, [{ name, input: {} }]);
    expect(results()[0].status).toBe('failed');
    expect(c.transact).not.toHaveBeenCalled();
    expect(c.undo).not.toHaveBeenCalled();
    expect(c.redo).not.toHaveBeenCalled();
  }
);
it.each(['studio_undo_local', 'studio_redo_local'])(
  'reports conflicts in %s without retrying the command',
  async name => {
    const c = controller();
    c.undo.mockReturnValue(false);
    c.redo.mockReturnValue(false);
    await run(c, [{ name, input: {} }]);
    expect(results()[0].error).toContain('conflicts');
  }
);
it('replays stored results without executing an action after an interrupted acknowledgement', async () => {
  const c = controller();
  sessionStorage.setItem(
    'studio-ui:repeat',
    JSON.stringify({ status: 'failed', error: 'Interrupted' })
  );
  await run(c, [{ id: 'repeat', name: 'studio_undo_local', input: {} }]);
  expect(c.undo).not.toHaveBeenCalled();
  expect(results()).toEqual([{ status: 'failed', error: 'Interrupted' }]);
});
it('does not poll a private proposal workspace or a controller without a project', async () => {
  for (const id of ['', 'project']) {
    const c = { ...controller(), id, workspaceId: id ? 'proposal' : null };
    const hook = renderHook(() =>
      useStudioEditorTools(c as unknown as ReturnType<typeof useStudioController>)
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(io.request).not.toHaveBeenCalled();
    hook.unmount();
  }
});

it('waits for connectivity and prevents overlapping polls and commands after unmount', async () => {
  const c = controller();
  let online = false;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  let resolve!: (actions: unknown[]) => void;
  io.request.mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const hook = renderHook(() =>
    useStudioEditorTools(c as unknown as ReturnType<typeof useStudioController>)
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(io.request).not.toHaveBeenCalled();
  online = true;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
  });
  expect(io.request).toHaveBeenCalledTimes(1);
  hook.unmount();
  await act(async () => {
    resolve([{ id: 'late', name: 'studio_undo_local', input: {} }]);
  });
  expect(c.undo).not.toHaveBeenCalled();
  expect(io.request).toHaveBeenCalledTimes(1);
});
it('marks an action interrupted when the document is unavailable and retries network failures later', async () => {
  const c = controller();
  const unloaded = { ...c, value: null };
  io.request
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([{ id: 'unloaded', name: 'studio_preview', input: {} }]);
  const hook = renderHook(() =>
    useStudioEditorTools(unloaded as unknown as ReturnType<typeof useStudioController>)
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
  });
  expect(JSON.parse(sessionStorage.getItem('studio-ui:unloaded')!).error).toContain(
    'Editor interrupted'
  );
  expect(results()).toEqual([]);
  hook.unmount();
});
it('reports a missing paste destination and non-Error command failures', async () => {
  const c = controller();
  c.transact.mockImplementation(change => change({ ...c.value, pages: [] }));
  io.request.mockImplementation(async op => {
    if (op === 'editorActions')
      return [
        { id: 'copy', name: 'studio_copy_selection', input: {} },
        { id: 'paste', name: 'studio_paste_selection', input: {} },
        { id: 'template', name: 'studio_save_template', input: {} },
      ];
    if (op === 'template') throw 'storage offline';
    return {};
  });
  renderHook(() => useStudioEditorTools(c as unknown as ReturnType<typeof useStudioController>));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(results()).toEqual([
    { status: 'completed', revision: 7 },
    { status: 'failed', error: 'Page no longer exists' },
    { status: 'failed', error: 'storage offline' },
  ]);
});

it.each([false, true])(
  'coalesces repeated pending-action events and discards a queued claim after unmount=%s',
  async unmount => {
    const c = controller();
    let resolve!: (actions: unknown[]) => void;
    io.request
      .mockImplementationOnce(
        () =>
          new Promise(done => {
            resolve = done;
          })
      )
      .mockResolvedValue([]);
    const hook = renderHook(() =>
      useStudioEditorTools(c as unknown as ReturnType<typeof useStudioController>)
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(io.request).toHaveBeenCalledTimes(1);
    act(() => {
      io.changed!();
      io.changed!();
    });
    expect(io.request).toHaveBeenCalledTimes(1);
    if (unmount) hook.unmount();
    await act(async () => resolve([]));
    expect(io.request).toHaveBeenCalledTimes(unmount ? 1 : 2);
    if (!unmount) hook.unmount();
  }
);
