/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
import { useCollaborationComments } from '../hooks/useCollaborationComments';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../hooks/useCollaborationDocument', () => ({ collaborationRequest: mocks.request }));
let rows: any[], client: CollaborationClient;
const text = (value: string) => [{ type: 'p', children: [{ text: value }] }];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  client = { phase: 'active', session: { id: 'doc', generation: 'one' } } as CollaborationClient;
  rows = [
    {
      id: 'mine',
      thread_id: 'thread',
      author_id: 'alice',
      content: text('Mine'),
      revision: 1,
      deleted: false,
      resolved: false,
      orphaned: false,
      created_at: 10,
      change_request_id: null,
      visibility: 'document',
    },
    {
      id: 'theirs',
      thread_id: 'thread',
      author_id: 'bob',
      content: text('Theirs'),
      revision: 1,
      deleted: false,
      resolved: false,
      orphaned: true,
      created_at: 11,
      change_request_id: null,
      visibility: 'document',
    },
  ];
  mocks.request.mockImplementation(async (operation: string, body: any) => {
    if (operation === 'comments') return structuredClone(rows);
    const old = rows.find(r => r.id === body.change.id);
    if (old)
      Object.assign(old, {
        content: body.change.content,
        deleted: !!body.change.deleted,
        revision: old.revision + 1,
      });
    return {};
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
describe('granular comment commands', () => {
  it.each(['collaborators', 'document'])(
    'preserves %s visibility when adding a reply that has no server row yet',
    async visibility => {
      rows[0].visibility = rows[1].visibility = visibility;
      const hook = renderHook(() => useCollaborationComments(client, 'alice'));
      await tick();
      const thread = structuredClone(hook.result.current.discussions[0]);
      thread.comments.push({
        ...thread.comments[0],
        id: 'reply',
        contentRich: text('Private reply'),
      });
      await act(() => hook.result.current.save([thread]));
      expect(mocks.request).toHaveBeenCalledWith(
        'comment',
        expect.objectContaining({
          change: expect.objectContaining({ id: 'reply', visibility }),
        })
      );
    }
  );
  it.each(['error', 'maintenance'] as const)(
    'clears private discussions and ignores a pending response when the session becomes %s',
    async phase => {
      const hook = renderHook(({ current }) => useCollaborationComments(current, 'alice'), {
        initialProps: { current: client },
      });
      await tick();
      expect(hook.result.current.discussions).toHaveLength(1);
      let complete: (value: unknown) => void = () => undefined;
      mocks.request.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            complete = resolve;
          })
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      hook.rerender({ current: { ...client, phase } });
      expect(hook.result.current.discussions).toEqual([]);
      await act(async () => {
        complete(rows);
      });
      expect(hook.result.current.discussions).toEqual([]);
    }
  );
  it('does nothing without a session and reports polling errors without erasing discussion history', async () => {
    const missing = renderHook(() =>
      useCollaborationComments({ ...client, session: null }, 'alice')
    );
    await act(() => missing.result.current.save([]));
    await act(() => missing.result.current.remove('mine'));
    expect(mocks.request).not.toHaveBeenCalled();
    missing.unmount();
    const hook = renderHook(() => useCollaborationComments(client, 'alice'));
    await tick();
    mocks.request.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(hook.result.current.error).toBe('offline');
    expect(hook.result.current.discussions[0].comments).toHaveLength(2);
    await act(() => hook.result.current.remove('missing'));
    expect(mocks.request.mock.calls.filter(([op]) => op === 'comment')).toHaveLength(0);
  });
  it('serializes a new author comment, preserves proposal visibility, and recovers after a rejected edit', async () => {
    rows[0].change_request_id = 'proposal';
    rows[0].visibility = 'collaborators';
    const hook = renderHook(() => useCollaborationComments(client, 'alice'));
    await tick();
    const next = structuredClone(hook.result.current.discussions);
    next[0].comments[0].contentRich = text('Edit');
    mocks.request.mockRejectedValueOnce(new Error('comment_revision_changed'));
    await act(async () => {
      await expect(hook.result.current.save(next)).rejects.toThrow('comment_revision_changed');
    });
    expect(hook.result.current.error).toBe('comment_revision_changed');
    await act(() => hook.result.current.save(next));
    expect(mocks.request).toHaveBeenCalledWith(
      'comment',
      expect.objectContaining({
        change: expect.objectContaining({
          id: 'mine',
          changeRequestId: 'proposal',
          visibility: 'collaborators',
        }),
      })
    );
    const added = structuredClone(hook.result.current.discussions);
    added[0].comments = [{ ...added[0].comments[0], id: 'new', contentRich: text('New comment') }];
    await act(() => hook.result.current.save(added));
    expect(mocks.request).toHaveBeenCalledWith(
      'comment',
      expect.objectContaining({
        change: expect.objectContaining({
          id: 'new',
          expectedRevision: 0,
          changeRequestId: 'proposal',
          visibility: 'collaborators',
        }),
      })
    );
    await act(() => hook.result.current.remove('mine'));
    await act(() => hook.result.current.remove('mine'));
    expect(rows[0].revision).toBe(3);
  });
  it('never deletes an omitted discussion or rewrites another author from a stale plugin list', async () => {
    const hook = renderHook(() => useCollaborationComments(client, 'alice'));
    await tick();
    const original = hook.result.current.discussions;
    expect(original[0].comments).toHaveLength(2);
    await act(() => hook.result.current.save([]));
    expect(mocks.request.mock.calls.filter(([operation]) => operation === 'comment')).toHaveLength(
      0
    );
    const stale = structuredClone(original);
    stale[0].comments[1].contentRich = text('Forged rewrite');
    await act(() => hook.result.current.save(stale));
    expect(rows[1].content).toEqual(text('Theirs'));
    stale[0].comments[0].contentRich = text('Updated by author');
    await act(() => hook.result.current.save(stale));
    expect(rows[0].content).toEqual(text('Updated by author'));
    expect(rows[1].content).toEqual(text('Theirs'));
    expect(mocks.request).toHaveBeenCalledWith(
      'comment',
      expect.objectContaining({
        change: expect.objectContaining({ id: 'mine', expectedRevision: 1 }),
      })
    );
  });
  it('uses an explicit versioned delete and preserves the reply and history in the refreshed view', async () => {
    const hook = renderHook(() => useCollaborationComments(client, 'alice'));
    await tick();
    await act(() => hook.result.current.remove('mine'));
    expect(mocks.request).toHaveBeenCalledWith(
      'comment',
      expect.objectContaining({
        change: expect.objectContaining({ id: 'mine', expectedRevision: 1, deleted: true }),
      })
    );
    expect(hook.result.current.discussions[0].comments.map(c => c.id)).toEqual(['theirs']);
    expect(hook.result.current.discussions[0].orphaned).toBe(true);
  });
  it('surfaces revision rejection and recovers the queue for the next operation', async () => {
    const hook = renderHook(() => useCollaborationComments(client, 'alice'));
    await tick();
    mocks.request.mockRejectedValueOnce(new Error('comment_revision_changed'));
    await act(async () => {
      await expect(hook.result.current.remove('mine')).rejects.toThrow('comment_revision_changed');
    });
    expect(hook.result.current.error).toBe('comment_revision_changed');
    await act(() => hook.result.current.remove('mine'));
    expect(rows[0].deleted).toBe(true);
  });
  it('does not display an old workspace response after switching documents', async () => {
    let resolve: (value: any) => void = () => undefined;
    mocks.request.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const hook = renderHook(({ current }) => useCollaborationComments(current, 'alice'), {
      initialProps: { current: client },
    });
    await tick();
    hook.rerender({ current: { ...client, session: { ...client.session!, id: 'second' } } });
    await tick();
    await act(async () => {
      resolve([{ ...rows[0], id: 'private-old-response' }]);
    });
    expect(JSON.stringify(hook.result.current.discussions)).not.toContain('private-old-response');
  });
});
