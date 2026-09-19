import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createClient } from '@/lib/supabase/client';
import type { CollaborationReference, CollaborationSession } from '../logic/types';
import { projectDocument } from '../logic/codec';

export async function collaborationToken() {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new Error('authentication_required');
  return data.session.access_token;
}
export async function collaborationRequest<T>(operation: string, data: object): Promise<T> {
  const response = await fetch('/api/collaboration', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await collaborationToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ operation, ...data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'collaboration_failed');
  return result as T;
}
export function encodeDocument(doc: Y.Doc) {
  const bytes = Y.encodeStateAsUpdate(doc);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeDocument(state: string) {
  return Uint8Array.from(atob(state), char => char.charCodeAt(0));
}
export interface CollaborationClient {
  phase: 'loading' | 'legacy' | 'maintenance' | 'active' | 'error';
  doc: Y.Doc | null;
  session: CollaborationSession | null;
  status: string;
  error: string;
  value: unknown;
  canEdit: boolean;
  commit: () => Promise<CollaborationSession>;
  reload: () => void;
  createDraft: (type: 'proposal' | 'followup') => Promise<void>;
  submit: () => Promise<void>;
  provider: HocuspocusProvider | null;
  workspaces?: { id: string; owner: boolean; shared: boolean; frozen: boolean; type: string }[];
  selectWorkspace?: (id: string | null) => void;
  share?: (shared: boolean) => Promise<void>;
  recoveries?: string[];
  exportRecovery?: (key: string) => Promise<void>;
  inspectRecovery?: (key: string) => Promise<{ base: unknown; local: unknown }>;
}
function savedValue<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function useCollaborationDocument(
  reference: CollaborationReference | null,
  userId?: string
): CollaborationClient {
  const [phase, setPhase] = useState<CollaborationClient['phase']>(
    reference && userId ? 'loading' : 'legacy'
  );
  const [connection, setConnection] = useState<{
    doc: Y.Doc;
    provider: HocuspocusProvider | null;
    session: CollaborationSession;
  } | null>(null);
  const [status, setStatus] = useState('loading'),
    [error, setError] = useState(''),
    [value, setValue] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0),
    [workspace, setWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<NonNullable<CollaborationClient['workspaces']>>([]);
  const [recoveries, setRecoveries] = useState<string[]>([]);
  const current = useRef(connection);
  current.current = connection;
  const referenceKey = JSON.stringify(reference);
  const storageKey = `collaboration-workspace:${userId}:${referenceKey}`;
  useEffect(() => {
    setWorkspace(savedValue<string | null>(storageKey, null));
  }, [storageKey]);
  const selectWorkspace = useCallback(
    (id: string | null) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(id));
      } catch {
        /* IndexedDB still retains the draft. */
      }
      setWorkspace(id);
    },
    [storageKey]
  );
  useEffect(() => {
    if (!reference || !userId) {
      setPhase('legacy');
      return;
    }
    let stopped = false;
    let cleanup: () => void = () => undefined;
    setPhase('loading');
    setReady(false);
    setError('');
    setConnection(null);
    setRecoveries(savedValue<string[]>(`${storageKey}:recovery`, []));
    void (async () => {
      const opened = await collaborationRequest<{
        phase: CollaborationClient['phase'];
        session?: CollaborationSession;
      }>('session', {
        reference: { ...reference, workspaceId: workspace ?? reference.workspaceId },
      });
      if (stopped) return;
      setPhase(opened.phase);
      if (!opened.session) return;
      const session = opened.session;
      const drafts = await collaborationRequest<NonNullable<CollaborationClient['workspaces']>>(
        'workspaces',
        { reference }
      );
      if (stopped) return;
      setWorkspaces(drafts);
      const doc = new Y.Doc();
      Y.applyUpdate(doc, decodeDocument(session.state), 'server');
      if (session.integrityError) {
        setConnection({ doc, provider: null, session });
        setValue(projectDocument(reference.kind, doc));
        setError(session.integrityError);
        setStatus('recovery');
        cleanup = () => doc.destroy();
        return;
      }
      const cacheKey = `collaboration:${userId}:${session.id}:${session.generation}`;
      const cacheIndexKey = `${storageKey}:recovery`;
      const index = [...new Set([...savedValue<string[]>(cacheIndexKey, []), cacheKey])];
      try {
        localStorage.setItem(cacheIndexKey, JSON.stringify(index));
      } catch {
        /* Retain the IndexedDB document. */
      }
      setRecoveries(index.filter(key => key !== cacheKey));
      const persistence = new IndexeddbPersistence(cacheKey, doc);
      await persistence.whenSynced;
      if (!(await persistence.get('base'))) await persistence.set('base', session.state);
      if (stopped) {
        await persistence.destroy();
        doc.destroy();
        return;
      }
      const updateValue = () => {
        try {
          setValue(projectDocument(reference.kind, doc));
        } catch {
          setError('invalid_local_document');
        }
      };
      updateValue();
      doc.on('update', updateValue);
      if (session.transport === 'http') {
        let busy = false,
          blocked = false,
          dirty =
            session.capabilities.edit &&
            Y.encodeStateAsUpdate(doc, Y.encodeStateVectorFromUpdate(decodeDocument(session.state)))
              .length > 2;
        const changed = (_update: Uint8Array, origin: unknown) => {
          if (origin !== 'server') dirty = true;
        };
        doc.on('update', changed);
        const sync = async () => {
          if (stopped || busy || blocked) return;
          busy = true;
          const write = dirty;
          dirty = false;
          try {
            const next = await collaborationRequest<CollaborationSession>(
              write ? 'flush' : 'read',
              {
                id: session.id,
                generation: session.generation,
                ...(write ? { state: encodeDocument(doc) } : {}),
              }
            );
            Y.applyUpdate(doc, decodeDocument(next.state), 'server');
            Object.assign(session, next);
            setError('');
            setStatus('saved');
          } catch (e) {
            dirty ||= write;
            const message = e instanceof Error ? e.message : 'recovery_required';
            blocked = /generation_changed|access_denied|write_denied|phase|frozen|integrity/.test(
              message
            );
            setError(message);
            setStatus('recovery');
            setRecoveries(index);
          } finally {
            busy = false;
          }
        };
        const timer = setInterval(() => void sync(), 500);
        cleanup = () => {
          clearInterval(timer);
          doc.off('update', changed);
          doc.off('update', updateValue);
          void persistence.destroy();
          doc.destroy();
        };
        setConnection({ doc, provider: null, session });
        setPhase('active');
        setReady(true);
        setStatus('saved');
        return;
      }
      let resyncing = false,
        resyncBlocked = false;
      const resync = async () => {
        if (resyncing || resyncBlocked || stopped) return;
        resyncing = true;
        try {
          const next = await collaborationRequest<CollaborationSession>('flush', {
            id: session.id,
            generation: session.generation,
            state: encodeDocument(doc),
          });
          if (stopped) return;
          Y.applyUpdate(doc, decodeDocument(next.state), 'server');
          Object.assign(session, next);
          // The server resets the transport after rejecting a delta. Its new
          // handshake also commits edits made while this HTTP flush was in
          // flight. Do not acknowledge those edits with this older response.
          setStatus('syncing');
        } catch (reason) {
          if (!stopped) {
            resyncBlocked = true;
            setError(reason instanceof Error ? reason.message : 'recovery_required');
            setStatus('recovery');
            setRecoveries(index);
          }
        } finally {
          resyncing = false;
        }
      };
      const provider = new HocuspocusProvider({
        url: session.websocket,
        name: session.room,
        document: doc,
        token: collaborationToken,
        onStatus: ({ status }) =>
          !stopped && setStatus(status === 'connected' ? 'syncing' : 'offline'),
        onUnsyncedChanges: ({ number }) => {
          if (stopped) return;
          setStatus(number === 0 && !resyncing ? 'saved' : 'syncing');
          if (number === 0 && provider.isSynced) setReady(true);
        },
        onSynced: ({ state }) => {
          if (stopped || !state) return;
          setStatus(provider.hasUnsyncedChanges ? 'syncing' : 'saved');
          if (!provider.hasUnsyncedChanges) setReady(true);
        },
        onAuthenticationFailed: () => {
          if (!stopped) {
            setError('access_or_generation_changed');
            setStatus('recovery');
          }
        },
        onClose: ({ event }) => {
          if (!stopped && /Access|generation|Session expired/i.test(event.reason ?? '')) {
            setError('access_or_generation_changed');
            setStatus('recovery');
            setRecoveries(index);
          }
        },
        onStateless: ({ payload }) => {
          try {
            const message = JSON.parse(payload);
            if (message.type === 'resync_required' && message.generation === session.generation) {
              void resync();
              return;
            }
            if (message.type === 'committed' && message.generation === session.generation) {
              session.revision = Math.max(session.revision, message.revision);
              session.checksum = message.checksum;
            }
          } catch {
            /* Ignore messages from a newer protocol. */
          }
        },
      });
      provider.awareness?.setLocalStateField('user', { id: userId, name: '', color: '#B88A3B' });
      const offline = () => {
        provider.disconnect();
        setStatus('offline');
      };
      const online = () => {
        void provider.connect();
      };
      window.addEventListener('offline', offline);
      window.addEventListener('online', online);
      if (!navigator.onLine) offline();
      const renewal = setInterval(() => provider.sendToken(), 240_000);
      cleanup = () => {
        clearInterval(renewal);
        window.removeEventListener('offline', offline);
        window.removeEventListener('online', online);
        doc.off('update', updateValue);
        provider.destroy();
        void persistence.destroy();
        doc.destroy();
      };
      setConnection({ doc, provider, session });
      setPhase('active');
    })().catch(reason => {
      if (!stopped) {
        setError(String(reason.message || reason));
        setPhase('error');
      }
    });
    return () => {
      stopped = true;
      cleanup();
    };
  }, [referenceKey, userId, workspace, reloadKey]);
  const commit = useCallback(async () => {
    const client = current.current;
    if (!client) throw new Error('document_not_loaded');
    const saved = await collaborationRequest<CollaborationSession>('flush', {
      id: client.session.id,
      generation: client.session.generation,
      state: encodeDocument(client.doc),
    });
    Y.applyUpdate(client.doc, decodeDocument(saved.state), 'server');
    Object.assign(client.session, saved);
    setStatus('saved');
    return saved;
  }, []);
  const createDraft = useCallback(
    async (type: 'proposal' | 'followup') => {
      const client = current.current;
      if (!client) throw new Error('document_not_loaded');
      const latest = client.session.capabilities.edit
        ? await commit()
        : await collaborationRequest<CollaborationSession>('read', {
            id: client.session.id,
            generation: client.session.generation,
          });
      const draft = await collaborationRequest<CollaborationSession>('workspace', {
        id: latest.id,
        generation: latest.generation,
        expectedRevision: latest.revision,
        operationId: crypto.randomUUID(),
        type,
      });
      selectWorkspace(draft.reference.workspaceId);
    },
    [selectWorkspace, commit]
  );
  const submit = useCallback(async () => {
    try {
      const saved = await commit();
      await collaborationRequest('submit', {
        id: saved.id,
        generation: saved.generation,
        expectedRevision: saved.revision,
        operationId: crypto.randomUUID(),
      });
      selectWorkspace(null);
      setReloadKey(key => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'submission_failed');
      throw reason;
    }
  }, [commit, selectWorkspace]);
  const share = useCallback(
    async (shared: boolean) => {
      const saved = await commit();
      await collaborationRequest('share', { id: saved.id, generation: saved.generation, shared });
      setReloadKey(key => key + 1);
    },
    [commit]
  );
  const exportRecovery = useCallback(
    async (key: string) => {
      if (!recoveries.includes(key) || !reference || !key.startsWith(`collaboration:${userId}:`))
        return;
      const doc = new Y.Doc(),
        persistence = new IndexeddbPersistence(key, doc);
      try {
        await persistence.whenSynced;
        const blob = new Blob(
          [
            JSON.stringify(
              { reference, cache: key, content: projectDocument(reference.kind, doc) },
              null,
              2
            ),
          ],
          { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = `polity-draft-${key.split(':').at(-1)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        await persistence.destroy();
        doc.destroy();
      }
    },
    [recoveries, referenceKey, userId]
  );
  const inspectRecovery = useCallback(
    async (key: string) => {
      if (!recoveries.includes(key) || !reference || !key.startsWith(`collaboration:${userId}:`))
        throw new Error('recovery_not_found');
      const doc = new Y.Doc(),
        base = new Y.Doc(),
        persistence = new IndexeddbPersistence(key, doc);
      try {
        await persistence.whenSynced;
        const state = await persistence.get('base');
        if (state) Y.applyUpdate(base, decodeDocument(String(state)));
        return {
          local: projectDocument(reference.kind, doc),
          base: state ? projectDocument(reference.kind, base) : null,
        };
      } finally {
        await persistence.destroy();
        doc.destroy();
        base.destroy();
      }
    },
    [recoveries, referenceKey, userId]
  );
  return {
    phase,
    doc: connection?.doc ?? null,
    provider: connection?.provider ?? null,
    session: connection?.session ?? null,
    status,
    error,
    value,
    submit,
    workspaces,
    selectWorkspace,
    share,
    recoveries,
    exportRecovery,
    inspectRecovery,
    canEdit: phase === 'active' && ready && !!connection?.session.capabilities.edit && !error,
    commit,
    createDraft,
    reload: () => setReloadKey(k => k + 1),
  };
}
