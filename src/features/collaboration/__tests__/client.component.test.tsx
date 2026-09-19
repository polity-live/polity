/* @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { seedDocument } from '../logic/codec';
import type { CollaborationSession } from '../logic/types';
const mocks = vi.hoisted(() => ({
  providers: [] as any[],
  cached: undefined as Uint8Array | undefined,
  fetch: vi.fn(),
  session: vi.fn(),
  destroy: vi.fn(),
  bases: new Map<string, unknown>(),
  synced: undefined as Promise<void> | undefined,
  autoSync: true,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mocks.session } }),
}));
vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class {
    isSynced = false;
    awareness = { setLocalStateField: vi.fn() };
    destroy = vi.fn();
    sendToken = vi.fn();
    connect = vi.fn();
    disconnect = vi.fn();
    constructor(public options: any) {
      mocks.providers.push(this);
      if (mocks.autoSync)
        queueMicrotask(() => {
          this.isSynced = true;
          options.onSynced({ state: true });
        });
    }
  },
}));
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    whenSynced = mocks.synced ?? Promise.resolve();
    destroy = mocks.destroy;
    constructor(
      public key: string,
      doc: Y.Doc
    ) {
      if (mocks.cached) Y.applyUpdate(doc, mocks.cached);
    }
    async get(key: string) {
      return mocks.bases.get(this.key + key);
    }
    async set(key: string, value: unknown) {
      mocks.bases.set(this.key + key, value);
    }
  },
}));
import {
  useCollaborationDocument,
  encodeDocument,
  decodeDocument,
  collaborationRequest,
} from '../hooks/useCollaborationDocument';
const reference = {
  kind: 'document' as const,
  entityId: 'entity',
  branchId: null,
  workspaceId: null,
};
let saved: CollaborationSession;
const requests: any[] = [];
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mocks.providers.length = 0;
  mocks.cached = undefined;
  mocks.synced = undefined;
  mocks.autoSync = true;
  mocks.bases.clear();
  requests.length = 0;
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ data: { session: { access_token: 'local-test-token' } } });
  const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: 'Original' }] }]);
  saved = {
    id: 'document',
    reference,
    generation: 'generation-one',
    revision: 1,
    state: encodeDocument(doc),
    checksum: 'one',
    room: 'room',
    websocket: 'ws://localhost:1236',
    capabilities: {
      read: true,
      edit: true,
      suggest: true,
      comment: true,
      vote: false,
      manage: true,
    },
  } as CollaborationSession;
  doc.destroy();
  mocks.fetch.mockImplementation(async (_url: string, input: RequestInit) => {
    const body = JSON.parse(String(input.body));
    requests.push(body);
    if (body.operation === 'session') return Response.json({ phase: 'active', session: saved });
    if (body.operation === 'workspaces') return Response.json([]);
    if (body.operation === 'flush') {
      saved = { ...saved, state: body.state, revision: saved.revision + 1 };
      return Response.json(saved);
    }
    if (body.operation === 'read') return Response.json(saved);
    if (body.operation === 'workspace')
      return Response.json({ ...saved, reference: { ...reference, workspaceId: 'draft' } });
    return Response.json({});
  });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('shared client persistence and authority transitions', () => {
  it.each([true, false])(
    'retains local edits and reconnects after a browser offline event (initially online: %s)',
    async initiallyOnline => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(initiallyOnline);
      const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
      await tick();
      const provider = mocks.providers[0];
      if (initiallyOnline) expect(provider.disconnect).not.toHaveBeenCalled();
      else expect(provider.disconnect).toHaveBeenCalledOnce();
      act(() => window.dispatchEvent(new Event('offline')));
      expect(hook.result.current.status).toBe('offline');
      expect(hook.result.current.canEdit).toBe(true);
      const document = hook.result.current.doc;
      act(() => window.dispatchEvent(new Event('online')));
      expect(provider.connect).toHaveBeenCalledOnce();
      expect(hook.result.current.doc).toBe(document);
      hook.unmount();
      provider.connect.mockClear();
      provider.disconnect.mockClear();
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
      expect(provider.connect).not.toHaveBeenCalled();
      expect(provider.disconnect).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  );
  it('enables typing only after the initial handshake and pending writes are acknowledged', async () => {
    mocks.autoSync = false;
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    expect(hook.result.current.canEdit).toBe(false);
    act(() => provider.options.onUnsyncedChanges({ number: 0 }));
    expect(hook.result.current.canEdit).toBe(false);
    provider.hasUnsyncedChanges = true;
    provider.isSynced = true;
    act(() => provider.options.onSynced({ state: true }));
    expect(hook.result.current.canEdit).toBe(false);
    provider.hasUnsyncedChanges = false;
    act(() => provider.options.onUnsyncedChanges({ number: 0 }));
    expect(hook.result.current.canEdit).toBe(true);
    act(() => provider.options.onStatus({ status: 'disconnected' }));
    expect(hook.result.current.canEdit).toBe(true);
  });
  it('does not echo remote HTTP updates as writes and keeps real local edits writable', async () => {
    saved = { ...saved, transport: 'http' };
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const remote = new Y.Doc();
    Y.applyUpdate(remote, decodeDocument(saved.state));
    (remote.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(0, 'Remote ');
    saved = { ...saved, state: encodeDocument(remote), revision: 2 };
    remote.destroy();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(JSON.stringify(hook.result.current.value)).toContain('Remote');
    expect(requests.filter(r => r.operation === 'flush')).toHaveLength(0);
    act(() =>
      (hook.result.current.doc!.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(
        0,
        'Local '
      )
    );
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(requests.filter(r => r.operation === 'flush')).toHaveLength(1);
  });
  it('reports unstructured session failures but discards failures from an abandoned connection', async () => {
    mocks.fetch.mockRejectedValueOnce('Session unavailable');
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    expect(hook.result.current.error).toBe('Session unavailable');
    hook.unmount();
    let reject!: (error: Error) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const abandoned = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    abandoned.unmount();
    reject(new Error('Late response'));
    await tick();
    expect(mocks.providers).toHaveLength(0);
  });
  it('keeps malformed local content read-only and retained for recovery', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    act(() => hook.result.current.doc!.get('content', Y.XmlText).insertEmbed(0, { invalid: true }));
    expect(hook.result.current.error).toBe('invalid_local_document');
    expect(hook.result.current.canEdit).toBe(false);
  });
  it.each([true, false])('ignores a resynchronization %s response after unmount', async success => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    let resolve: (response: Response) => void = () => undefined,
      reject: (error: unknown) => void = () => undefined;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        })
    );
    act(() =>
      mocks.providers[0].options.onStateless({
        payload: JSON.stringify({ type: 'resync_required', generation: saved.generation }),
      })
    );
    await tick();
    hook.unmount();
    if (success) resolve(Response.json(saved));
    else reject(new Error('connection closed'));
    await tick();
    expect(mocks.providers[0].destroy).toHaveBeenCalledOnce();
  });
  it('ignores an ordinary connection close but surfaces an unstructured resync failure for recovery', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    act(() => mocks.providers[0].options.onClose({ event: {} }));
    expect(hook.result.current.error).toBe('');
    mocks.fetch.mockRejectedValueOnce('connection lost');
    act(() =>
      mocks.providers[0].options.onStateless({
        payload: JSON.stringify({ type: 'resync_required', generation: saved.generation }),
      })
    );
    await tick();
    expect(hook.result.current).toMatchObject({
      status: 'recovery',
      error: 'recovery_required',
      canEdit: false,
    });
  });
  it('handles missing identities, corrupt preferences and denied local storage without discarding loaded content', async () => {
    const absent = renderHook(() => useCollaborationDocument(null));
    expect(absent.result.current.phase).toBe('legacy');
    await expect(absent.result.current.commit()).rejects.toThrow('document_not_loaded');
    await expect(absent.result.current.createDraft('proposal')).rejects.toThrow(
      'document_not_loaded'
    );
    absent.unmount();
    const key = `collaboration-workspace:alice:${JSON.stringify(reference)}`;
    localStorage.setItem(key, 'not json');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    try {
      const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
      await tick();
      expect(hook.result.current.canEdit).toBe(true);
      act(() => hook.result.current.selectWorkspace?.('private'));
      await tick();
      expect(requests.at(-2)).toMatchObject({
        operation: 'session',
        reference: { workspaceId: 'private' },
      });
    } finally {
      write.mockRestore();
    }
  });
  it('does not open sockets when sessions or draft listings finish after unmount, and releases pending IndexedDB state', async () => {
    for (const operation of ['session', 'workspaces']) {
      const original = mocks.fetch.getMockImplementation()!;
      let complete: (value: Response) => void = () => undefined;
      mocks.fetch.mockImplementation(async (url, input) =>
        JSON.parse(String(input.body)).operation === operation
          ? new Promise(resolve => {
              complete = resolve;
            })
          : original(url, input)
      );
      const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
      await tick();
      hook.unmount();
      complete(Response.json(operation === 'session' ? { phase: 'active', session: saved } : []));
      await tick();
      expect(mocks.providers).toHaveLength(0);
      mocks.fetch.mockImplementation(original);
    }
    let release: () => void = () => undefined;
    mocks.synced = new Promise(resolve => {
      release = resolve;
    });
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    hook.unmount();
    release();
    await tick();
    expect(mocks.destroy).toHaveBeenCalled();
    expect(mocks.providers).toHaveLength(0);
  });
  it('keeps maintenance or failed sessions out of edit mode and refreshes explicit reloads', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ phase: 'maintenance' }));
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    expect(hook.result.current.phase).toBe('maintenance');
    expect(hook.result.current.doc).toBeNull();
    act(() => hook.result.current.reload());
    await tick();
    expect(hook.result.current.phase).toBe('active');
    mocks.fetch.mockRejectedValueOnce('offline');
    act(() => hook.result.current.reload());
    await tick();
    expect(hook.result.current.phase).toBe('error');
    expect(hook.result.current.error).toBe('offline');
  });
  it('creates a draft from current authoritative read access and confirms sharing only after flushing', async () => {
    saved = { ...saved, capabilities: { ...saved.capabilities, edit: false } };
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    await act(() => hook.result.current.createDraft('proposal'));
    await tick();
    expect(requests.find(r => r.operation === 'workspace')).toMatchObject({
      expectedRevision: 1,
      type: 'proposal',
    });
    expect(requests.some(r => r.operation === 'flush')).toBe(false);
    await act(() => hook.result.current.share!(true));
    await tick();
    const shared = requests.findIndex(r => r.operation === 'share');
    expect(requests[shared - 1].operation).toBe('flush');
    saved = { ...saved, capabilities: { ...saved.capabilities, edit: true } };
    act(() => hook.result.current.reload());
    await tick();
    await act(() => hook.result.current.createDraft('followup'));
    await tick();
    expect(requests.filter(r => r.operation === 'workspace').at(-1).type).toBe('followup');
  });
  it('preserves a draft on failed submission and exposes protocol state without accepting stale receipts', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    act(() => {
      provider.options.onStatus({ status: 'connected' });
    });
    expect(hook.result.current.status).toBe('syncing');
    act(() => provider.options.onStatus({ status: 'disconnected' }));
    expect(hook.result.current.status).toBe('offline');
    provider.hasUnsyncedChanges = true;
    act(() => provider.options.onSynced({ state: true }));
    expect(hook.result.current.status).toBe('syncing');
    act(() => provider.options.onUnsyncedChanges({ number: 0 }));
    expect(hook.result.current.status).toBe('saved');
    act(() => {
      provider.options.onStateless({ payload: '{' });
      provider.options.onStateless({
        payload: JSON.stringify({ type: 'committed', generation: 'stale', revision: 999 }),
      });
      provider.options.onStateless({
        payload: JSON.stringify({
          type: 'committed',
          generation: saved.generation,
          revision: 4,
          checksum: 'confirmed',
        }),
      });
    });
    expect(hook.result.current.session?.revision).toBe(4);
    expect(hook.result.current.session?.checksum).toBe('confirmed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240_000);
    });
    expect(provider.sendToken).toHaveBeenCalled();
    const implementation = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url, input) =>
      JSON.parse(String(input.body)).operation === 'submit'
        ? Promise.reject('denied')
        : implementation(url, input)
    );
    await act(async () => {
      await expect(hook.result.current.submit()).rejects.toBe('denied');
    });
    expect(hook.result.current.error).toBe('submission_failed');
    mocks.fetch.mockImplementation((url, input) =>
      JSON.parse(String(input.body)).operation === 'submit'
        ? Promise.reject(new Error('phase_changed'))
        : implementation(url, input)
    );
    await act(async () => {
      await expect(hook.result.current.submit()).rejects.toThrow('phase_changed');
    });
    expect(hook.result.current.error).toBe('phase_changed');
    hook.unmount();
    act(() => {
      provider.options.onStatus({ status: 'connected' });
      provider.options.onUnsyncedChanges({ number: 1 });
      provider.options.onSynced({ state: false });
      provider.options.onAuthenticationFailed();
      provider.options.onClose({ event: {} });
    });
  });
  it('exports and compares only the current user retained generations with their original base', async () => {
    const key = `collaboration-workspace:alice:${JSON.stringify(reference)}:recovery`,
      old = 'collaboration:alice:document:old';
    localStorage.setItem(key, JSON.stringify([old]));
    mocks.cached = decodeDocument(saved.state);
    mocks.bases.set(old + 'base', saved.state);
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const comparison = await hook.result.current.inspectRecovery!(old);
    expect(comparison.local).toEqual(comparison.base);
    expect(JSON.stringify(comparison.local)).toContain('Original');
    mocks.bases.delete(old + 'base');
    expect((await hook.result.current.inspectRecovery!(old)).base).toBeNull();
    const create = vi.fn(() => 'blob:local-draft'),
      revoke = vi.fn(),
      click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      }
    );
    try {
      await hook.result.current.exportRecovery!('collaboration:bob:document:old');
      expect(create).not.toHaveBeenCalled();
      await hook.result.current.exportRecovery!(old);
      expect(create).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      await tick();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(revoke).toHaveBeenCalledWith('blob:local-draft');
    } finally {
      click.mockRestore();
    }
  });
  it('retries transient HTTP failures while accepting remote updates and blocking a denied generation', async () => {
    saved = { ...saved, transport: 'http' };
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    act(() => {
      const block = hook.result.current.doc!.get('content', Y.XmlText).toDelta()[0]
        .insert as Y.XmlText;
      block.insert(0, 'Local ');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(requests.at(-1).operation).toBe('flush');
    mocks.fetch.mockRejectedValueOnce('offline');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(hook.result.current.error).toBe('recovery_required');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(hook.result.current.status).toBe('saved');
    mocks.fetch.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(collaborationRequest('read', {})).rejects.toThrow('collaboration_failed');
  });
  it('resends a complete state when a delta lacks handshake dependencies and ignores requests for another generation', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    act(() =>
      provider.options.onStateless({
        payload: JSON.stringify({ type: 'resync_required', generation: 'old' }),
      })
    );
    await tick();
    expect(requests.some(r => r.operation === 'flush')).toBe(false);
    act(() =>
      provider.options.onStateless({
        payload: JSON.stringify({ type: 'resync_required', generation: saved.generation }),
      })
    );
    await tick();
    expect(requests.filter(r => r.operation === 'flush')).toHaveLength(1);
    expect(requests.find(r => r.operation === 'flush')).toMatchObject({
      id: 'document',
      generation: 'generation-one',
      state: encodeDocument(hook.result.current.doc!),
    });
    expect(hook.result.current.session?.revision).toBe(2);
  });
  it('keeps edits during the full-state flush unconfirmed until the fresh handshake acknowledges them', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    let complete!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => (complete = resolve)));
    act(() =>
      provider.options.onStateless({
        payload: JSON.stringify({ type: 'resync_required', generation: saved.generation }),
      })
    );
    await tick();
    act(() => {
      (hook.result.current.doc!.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(
        0,
        'Typed during resync '
      );
      provider.options.onUnsyncedChanges({ number: 0 });
    });
    expect(hook.result.current.status).toBe('syncing');
    complete(Response.json(saved));
    await tick();
    expect(JSON.stringify(hook.result.current.value)).toContain('Typed during resync');
    expect(hook.result.current.status).toBe('syncing');
    act(() => provider.options.onUnsyncedChanges({ number: 0 }));
    expect(hook.result.current.status).toBe('saved');
  });
  it('retains a rejected full-state resync as recovery and never automatically resubmits it', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    mocks.fetch.mockResolvedValue(Response.json({ error: 'generation_changed' }, { status: 409 }));
    const message = {
      payload: JSON.stringify({ type: 'resync_required', generation: saved.generation }),
    };
    act(() => provider.options.onStateless(message));
    await tick();
    expect(hook.result.current.canEdit).toBe(false);
    expect(hook.result.current.error).toBe('generation_changed');
    const count = mocks.fetch.mock.calls.length;
    act(() => provider.options.onStateless(message));
    await tick();
    expect(mocks.fetch.mock.calls.length).toBe(count);
    expect(hook.result.current.recoveries).toContain('collaboration:alice:document:generation-one');
  });
  it('confirms writes before submission and retains a user-scoped generation cache', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    expect(hook.result.current.canEdit).toBe(true);
    expect([...mocks.bases.keys()][0]).toContain('collaboration:alice:document:generation-one');
    const provider = mocks.providers[0];
    act(() => provider.options.onUnsyncedChanges({ number: 2 }));
    expect(hook.result.current.status).toBe('syncing');
    act(() => provider.options.onSynced({ state: true }));
    expect(hook.result.current.status).toBe('saved');
    await act(() => hook.result.current.submit());
    await tick();
    const flush = requests.findIndex(r => r.operation === 'flush'),
      submit = requests.findIndex(r => r.operation === 'submit');
    expect(submit).toBeGreaterThan(flush);
    expect(requests[submit].expectedRevision).toBe(2);
    hook.unmount();
    expect(provider.destroy).toHaveBeenCalled();
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it('stops editing on a generation rejection and keeps the local recovery available', async () => {
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    const provider = mocks.providers[0];
    act(() => provider.options.onClose({ event: { reason: 'generation_changed' } }));
    expect(hook.result.current.canEdit).toBe(false);
    expect(hook.result.current.recoveries).toContain('collaboration:alice:document:generation-one');
    await expect(
      hook.result.current.inspectRecovery?.('collaboration:bob:document:generation-one')
    ).rejects.toThrow('recovery_not_found');
    act(() => provider.options.onAuthenticationFailed());
    expect(hook.result.current.status).toBe('recovery');
  });
  it('serves verified fallback without merging IndexedDB edits or opening a socket', async () => {
    saved = {
      ...saved,
      integrityError: 'checksum_mismatch',
      readableRevision: 1,
      capabilities: { ...saved.capabilities, edit: false },
    };
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    expect(hook.result.current.error).toBe('checksum_mismatch');
    expect(hook.result.current.canEdit).toBe(false);
    expect(mocks.providers).toHaveLength(0);
    expect(mocks.bases.size).toBe(0);
    expect(JSON.stringify(hook.result.current.value)).toContain('Original');
  });
  it('flushes same-generation cached edits through HTTP compatibility and retries a transient failure', async () => {
    saved = { ...saved, transport: 'http' };
    const local = new Y.Doc();
    Y.applyUpdate(local, decodeDocument(saved.state));
    (local.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(8, ' offline');
    mocks.cached = Y.encodeStateAsUpdate(local);
    local.destroy();
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    mocks.fetch.mockRejectedValueOnce(new TypeError('network offline'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(hook.result.current.error).toBe('network offline');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(hook.result.current.error).toBe('');
    expect(requests.filter(r => r.operation === 'flush')).toHaveLength(1);
    expect(JSON.stringify(hook.result.current.value)).toContain('offline');
    expect(mocks.providers).toHaveLength(0);
  });
  it('does not automatically resubmit rejected offline content in compatibility mode', async () => {
    saved = { ...saved, transport: 'http' };
    const hook = renderHook(() => useCollaborationDocument(reference, 'alice'));
    await tick();
    mocks.fetch.mockResolvedValueOnce(
      Response.json({ error: 'generation_changed' }, { status: 409 })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const count = mocks.fetch.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(count);
    expect(hook.result.current.canEdit).toBe(false);
  });
  it('does not send an unauthenticated request and reports server rejections', async () => {
    mocks.session.mockResolvedValueOnce({ data: { session: null } });
    await expect(collaborationRequest('read', {})).rejects.toThrow('authentication_required');
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: 'access_denied' }, { status: 403 }));
    await expect(collaborationRequest('read', {})).rejects.toThrow('access_denied');
  });
});
