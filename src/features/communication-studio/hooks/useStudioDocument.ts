import { studioPresence } from '@/features/communication-studio/logic/studio-realtime-presence';
import { z } from 'zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useStudioClient } from '@/zero/communication-studio/useStudioClient';
import { createClient } from '@/lib/supabase/client';
import * as edit from '../logic/collaboration';
import {
  documentSchema,
  type StudioDocument,
  type StudioElement,
  type StudioPage,
} from '../logic/document';
import {
  diffStudio,
  isStudioValidationError,
  mergeStudioV3,
  inverseChanges,
  studioValueAtPath,
  type StudioChange,
  type StudioConflict,
} from '../logic/operations';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../logic/document-v3';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../logic/v3-adapter';
import type { StudioReceipt } from '@/server/studio/operations';
import { trackElementInstanceOverrides } from '../logic/element-library';
export interface StudioAsset {
  id: string;
  name: string;
  mime: string;
  url: string;
}
const studioErrorMessage = (error: unknown) =>
  isStudioValidationError(error)
    ? translateText('features.studio.invalidChange')
    : error instanceof Error
      ? error.message
      : String(error);
interface Draft {
  base: StudioDocumentV3;
  value: StudioDocumentV3;
  revision: number;
  generation?: string;
  canEdit?: boolean;
  pending?: { operationId: string; changes: StudioChange[] };
}
export function useStudioDocument(
  id: string | undefined,
  user: { id: string; name: string },
  workspaceId?: string
) {
  const studio = useStudioClient();
  const zero = useZero();
  const [canonicalRemote, remoteStatus] = useQuery(
    id ? queries.studio.document({ id }) : undefined
  );
  const [remoteWorkspace, workspaceStatus] = useQuery(
    id && workspaceId ? queries.studio.workspace({ projectId: id, workspaceId }) : undefined
  );
  const [workspaceRemote, setWorkspaceRemote] = useState<{
    document: StudioDocumentV3;
    content_revision: number;
  } | null>(null);
  const remote = workspaceId
    ? remoteWorkspace
      ? { document: remoteWorkspace.document, content_revision: remoteWorkspace.revision }
      : workspaceRemote
    : canonicalRemote;
  const loadDocument = () => {
    if (!id) return Promise.reject(new Error('Studio project unavailable'));
    return workspaceId ? studio.loadDraft({ projectId: id, workspaceId }) : studio.load({ id });
  };
  const [value, setValue] = useState<StudioDocument | null>(null),
    [canEdit, setCanEdit] = useState(false),
    [status, setStatus] = useState('loading'),
    [error, setError] = useState(''),
    [conflicts, setConflicts] = useState<StudioConflict[]>([]),
    [assets, setAssets] = useState<StudioAsset[]>([]),
    [peers, setPeers] = useState<Record<string, unknown>[]>([]);
  const draft = useRef<Draft | null>(null),
    flight = useRef<Promise<number> | null>(null),
    history = useRef<StudioChange[][]>([]),
    future = useRef<StudioChange[][]>([]),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetObjectUrls = useRef(new Map<string, { source: string; url: string }>());
  const presenceCursor = useRef<{ pageId: string; x: number; y: number } | undefined>(undefined);
  const presenceSelection = useRef<string[]>([]);
  const publishPresence = useRef<() => void>(() => {
    /* No active canvas session. */
  });
  const session = useRef(0);
  const blocked = useRef(false);
  const storageKey = `studio:v4:${user.id}:${id}:${workspaceId ?? 'canonical'}`;
  const assetScope = `${id ?? ''}:${workspaceId ?? 'canonical'}`;
  const currentAssetScope = useRef(assetScope);
  currentAssetScope.current = assetScope;
  const persist = (snapshot: Draft) => localStorage.setItem(storageKey, JSON.stringify(snapshot));
  const clearAssetObjectUrls = useCallback(() => {
    for (const asset of assetObjectUrls.current.values()) URL.revokeObjectURL(asset.url);
    assetObjectUrls.current.clear();
  }, []);
  const refreshAssets = useCallback(async () => {
    if (!id) return;
    const scope = `${id}:${workspaceId ?? 'canonical'}`;
    const result = await studio.assets({ id, workspaceId });
    if (currentAssetScope.current !== scope) return;
    const pending: string[] = [];
    try {
      const uncached = result.filter(
        asset => assetObjectUrls.current.get(asset.id)?.source !== asset.url
      );
      let accessToken = '';
      if (uncached.length) {
        const { data } = await createClient().auth.getSession();
        accessToken = data.session?.access_token ?? '';
        if (!accessToken) throw new Error('Please sign in');
      }
      const hydrated = await Promise.all(
        result.map(async asset => {
          const cached = assetObjectUrls.current.get(asset.id);
          if (cached?.source === asset.url) return { ...asset, url: cached.url };
          const response = await fetch(asset.url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!response.ok) throw new Error('Cannot load media');
          const url = URL.createObjectURL(await response.blob());
          pending.push(url);
          return { ...asset, url };
        })
      );
      if (currentAssetScope.current !== scope) {
        pending.forEach(url => URL.revokeObjectURL(url));
        return;
      }
      const ids = new Set(result.map(asset => asset.id));
      for (const [assetId, cached] of assetObjectUrls.current) {
        const source = result.find(asset => asset.id === assetId)?.url;
        if (!ids.has(assetId) || source !== cached.source) {
          URL.revokeObjectURL(cached.url);
          assetObjectUrls.current.delete(assetId);
        }
      }
      result.forEach((asset, index) => {
        const hydratedAsset = hydrated[index];
        if (!assetObjectUrls.current.has(asset.id))
          assetObjectUrls.current.set(asset.id, { source: asset.url, url: hydratedAsset.url });
      });
      setAssets(hydrated);
    } catch (error) {
      pending.forEach(url => URL.revokeObjectURL(url));
      throw error;
    }
  }, [id, workspaceId]);
  useEffect(() => {
    if (workspaceId && workspaceStatus?.type === 'complete' && !remoteWorkspace && draft.current) {
      let live = true;
      void loadDocument()
        .then(result => {
          if (!live) return;
          setWorkspaceRemote({ document: result.document, content_revision: result.revision });
          setCanEdit(result.canEdit);
          if (!result.canEdit) {
            setStatus('unavailable');
            setPeers([]);
          }
        })
        .catch(() => {
          if (!live) return;
          setCanEdit(false);
          setStatus('unavailable');
          setPeers([]);
        });
      return () => {
        live = false;
      };
    }
  }, [workspaceId, remoteWorkspace, workspaceStatus?.type]);
  useEffect(() => {
    session.current++;
    draft.current = null;
    blocked.current = false;
    history.current = [];
    future.current = [];
    setValue(null);
    clearAssetObjectUrls();
    setAssets([]);
    setCanEdit(false);
    setConflicts([]);
    setError('');
    setStatus('loading');
    if (!id) return;
    let disposed = false;
    let restored: Draft | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        restored = JSON.parse(raw);
        if (restored) {
          studioDocumentV3Schema.parse(restored.base);
          studioDocumentV3Schema.parse(restored.value);
        }
      }
    } catch {
      restored = null;
    }
    if (restored) {
      draft.current = restored;
      setValue(v3DocumentToLegacy(restored.value));
      setCanEdit(!!restored.canEdit);
      setStatus(navigator.onLine ? 'loading' : 'offline');
    }
    const load = () =>
      (async () => {
        if (!workspaceId && !restored) {
          const current = await studio.load({ id });
          if (current.canEdit) await studio.synchronizeElements({ projectId: id });
        }
        return loadDocument();
      })()
        .then(result => {
          if (disposed) return;
          if (draft.current?.generation && draft.current.generation !== result.generation) {
            blocked.current = true;
            setCanEdit(false);
            setStatus('conflict');
            setError(
              'This draft belongs to an older generation. Download it before reopening the current document.'
            );
            return;
          }
          draft.current = draft.current ??
            restored ?? {
              base: result.document,
              value: result.document,
              revision: result.revision,
              generation: result.generation,
            };
          draft.current.canEdit = result.canEdit;
          draft.current.generation = result.generation;
          if (workspaceId)
            setWorkspaceRemote({ document: result.document, content_revision: result.revision });
          persist(draft.current);
          setValue(v3DocumentToLegacy(draft.current.value));
          setCanEdit(result.canEdit);
          setStatus(
            blocked.current
              ? 'conflict'
              : diffStudio(draft.current.base, draft.current.value).length
                ? 'unsaved'
                : 'saved'
          );
          void refreshAssets().catch(e => setError(String(e)));
          if (restored)
            timer.current = setTimeout(
              () =>
                void commitRef.current().catch(() => {
                  /* Error is shown in the save status. */
                }),
              400
            );
        })
        .catch(e => {
          if (!disposed) {
            setCanEdit(false);
            setError(String(e));
            setStatus(navigator.onLine ? 'unavailable' : 'offline');
          }
        });
    void load();
    const reconnect = () => void load();
    const stopAuthority = studio.watchSession(
      { projectId: id },
      next => {
        if (disposed || !draft.current) return;
        if (draft.current.generation !== next.generation) {
          blocked.current = true;
          setCanEdit(false);
          setStatus('conflict');
          return;
        }
        void loadDocument()
          .then(current => {
            if (!disposed) {
              setCanEdit(current.canEdit);
              if (draft.current) draft.current.canEdit = current.canEdit;
            }
          })
          .catch(() => {
            if (!disposed) {
              setCanEdit(false);
              setStatus('unavailable');
            }
          });
      },
      () => {
        if (!disposed) {
          setCanEdit(false);
          setStatus('unavailable');
        }
      }
    );
    window.addEventListener('online', reconnect);
    const stopAssets = studio.watchAssets(
      { id, workspaceId },
      () => void refreshAssets().catch(e => setError(String(e)))
    );
    return () => {
      session.current++;
      disposed = true;
      stopAuthority();
      window.removeEventListener('online', reconnect);
      stopAssets();
      if (timer.current) clearTimeout(timer.current);
      clearAssetObjectUrls();
    };
  }, [id, user.id, workspaceId, clearAssetObjectUrls]);
  useEffect(() => {
    if (!remote || !draft.current) return;
    const d = draft.current;
    if (remote.content_revision <= d.revision || flight.current || d.pending) return;
    const changes = diffStudio(d.base, d.value),
      merged = mergeStudioV3(remote.document, changes);
    if (merged.conflicts.length) {
      blocked.current = true;
      setConflicts(merged.conflicts);
      setStatus('conflict');
      return;
    }
    draft.current = {
      ...d,
      base: remote.document,
      value: merged.value,
      revision: remote.content_revision,
    };
    setValue(v3DocumentToLegacy(merged.value));
    persist(draft.current);
  }, [remote, status]);
  useEffect(() => {
    if (!workspaceId && remoteStatus?.type === 'complete' && !remote && draft.current) {
      setCanEdit(false);
      setStatus('unavailable');
    }
  }, [remote, remoteStatus]);
  useEffect(() => {
    if (!id || !value || !user.id || status === 'unavailable') return;
    return studioPresence({
      projectId: id,
      workspaceId,
      user,
      setPeers,
      cursor: presenceCursor,
      selection: presenceSelection,
      publish: publishPresence,
    });
  }, [id, !!value, user.id, user.name, status === 'unavailable', workspaceId]);
  const commit = async (): Promise<number> => {
    if (flight.current) {
      await flight.current;
      return commit();
    }
    if (timer.current) clearTimeout(timer.current);
    const d = draft.current;
    if (!id || !d) throw new Error('Studio not loaded');
    const activeSession = session.current;
    if (blocked.current) throw new Error('Resolve Studio conflicts first');
    const changes = d.pending?.changes ?? diffStudio(d.base, d.value);
    if (!navigator.onLine) {
      setStatus('offline');
      throw new Error('Offline');
    }
    if (!changes.length) {
      setStatus('saving');
      const confirmation = (async () => {
        const confirmed = await loadDocument();
        if (session.current !== activeSession) throw new Error('Studio changed while confirming');
        if (d.generation !== confirmed.generation) {
          blocked.current = true;
          throw new Error('Canvas generation changed');
        }
        // The session check guarantees the loaded draft has not been reset.
        const latest = draft.current as Draft;
        if (confirmed.revision < latest.revision) return latest.revision;
        const edits = diffStudio(latest.base, latest.value),
          merged = mergeStudioV3(confirmed.document, edits);
        setCanEdit(confirmed.canEdit);
        if (merged.conflicts.length) {
          blocked.current = true;
          setConflicts(merged.conflicts);
          setStatus('conflict');
          throw new Error('Resolve Studio conflicts first');
        }
        draft.current = {
          base: confirmed.document,
          value: merged.value,
          revision: confirmed.revision,
          canEdit: confirmed.canEdit,
          generation: confirmed.generation,
        };
        setValue(v3DocumentToLegacy(merged.value));
        persist(draft.current);
        setStatus(edits.length ? 'unsaved' : 'saved');
        return confirmed.revision;
      })();
      flight.current = confirmation;
      try {
        await confirmation;
      } catch (e) {
        if (session.current === activeSession) {
          setError(String(e));
          setStatus(s => (s === 'conflict' ? s : navigator.onLine ? 'error' : 'offline'));
        }
        throw e;
      } finally {
        flight.current = null;
      }
      if (session.current !== activeSession) throw new Error('Studio changed while confirming');
      const latest = draft.current as Draft;
      if (diffStudio(latest.base, latest.value).length) return commit();
      return latest.revision;
    }
    if (!canEdit && !d.pending) throw new Error('Studio is read-only');
    const pending = d.pending ?? { operationId: crypto.randomUUID(), changes };
    d.pending = pending;
    persist(d);
    const sentValue = mergeStudioV3(d.base, changes).value;
    setStatus('saving');
    setError('');
    const operation = (async () => {
      let receipt: StudioReceipt;
      if (workspaceId)
        receipt = await studio.canvas({
          action: 'saveDraft',
          projectId: id,
          workspaceId,
          revision: d.revision,
          generation: d.generation ?? '',
          ...pending,
        });
      else {
        await serverConfirmed(
          zero.mutate(
            mutators.studio.apply({
              projectId: id,
              generation: d.generation,
              expectedRevision: d.revision,
              ...pending,
            })
          )
        );
        receipt = await studio.operation({
          projectId: id,
          id: pending.operationId,
        });
      }
      if (session.current !== activeSession) return receipt.revision;
      const latest = draft.current as Draft;
      if (receipt.status === 'conflict') {
        delete latest.pending;
        blocked.current = true;
        setConflicts(receipt.conflicts);
        setStatus('conflict');
        persist(latest);
        throw new Error('Studio changes conflict');
      }
      const trailing = diffStudio(sentValue, latest.value),
        merged = mergeStudioV3(receipt.document, trailing);
      draft.current = {
        base: receipt.document,
        value: merged.conflicts.length ? latest.value : merged.value,
        revision: receipt.revision,
        canEdit,
        generation: d.generation,
      };
      blocked.current = !!merged.conflicts.length;
      setValue(v3DocumentToLegacy(draft.current.value));
      setConflicts(merged.conflicts);
      setStatus(merged.conflicts.length ? 'conflict' : trailing.length ? 'unsaved' : 'saved');
      persist(draft.current);
      return receipt.revision;
    })();
    flight.current = operation;
    try {
      await operation;
    } catch (e) {
      if (session.current === activeSession) {
        setError(studioErrorMessage(e));
        setStatus(s => (s === 'conflict' ? s : 'error'));
      }
      throw e;
    } finally {
      flight.current = null;
    }
    if (session.current !== activeSession) return d.revision;
    const latest = draft.current as Draft;
    if (diffStudio(latest.base, latest.value).length && !blocked.current) return commit();
    return latest.revision;
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const retry = () => {
      void commitRef.current().catch(() => {
        /* Error is shown in the save status. */
      });
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
  const transact = (fn: (d: StudioDocument) => void, track = true) => {
    const d = draft.current;
    if (!d || !canEdit) return;
    try {
      const next = v3DocumentToLegacy(d.value);
      fn(next);
      const parsed = documentSchema.parse(next),
        converted = legacyDocumentToV3(parsed, d.value),
        changes = diffStudio(d.value, converted);
      trackElementInstanceOverrides(d.value, converted);
      if (!changes.length) return;
      if (track) {
        history.current.push(changes);
        future.current = [];
      }
      d.value = converted;
      setValue(parsed);
      persist(d);
      setStatus(blocked.current ? 'conflict' : navigator.onLine ? 'unsaved' : 'offline');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () =>
          void commitRef.current().catch(() => {
            /* Error is shown in the save status. */
          }),
        400
      );
    } catch (e) {
      setError(studioErrorMessage(e));
    }
  };
  const transactV3 = (fn: (d: StudioDocumentV3) => void, track = true) => {
    const d = draft.current;
    if (!d || !canEdit) return;
    try {
      const next = structuredClone(d.value);
      fn(next);
      trackElementInstanceOverrides(d.value, next);
      const parsed = studioDocumentV3Schema.parse(next),
        changes = diffStudio(d.value, parsed);
      if (!changes.length) return;
      if (track) {
        history.current.push(changes);
        future.current = [];
      }
      d.value = parsed;
      setValue(v3DocumentToLegacy(parsed));
      persist(d);
      setStatus(blocked.current ? 'conflict' : navigator.onLine ? 'unsaved' : 'offline');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        () =>
          void commitRef.current().catch(() => {
            /* Error is shown in the save status. */
          }),
        400
      );
    } catch (e) {
      setError(studioErrorMessage(e));
    }
  };
  const undoRedo = (undo: boolean) => {
    const source = undo ? history : future,
      target = undo ? future : history;
    const changes = source.current.at(-1);
    if (!changes || !draft.current || !canEdit) return false;
    const merged = mergeStudioV3(draft.current.value, undo ? inverseChanges(changes) : changes);
    if (merged.conflicts.length) {
      setError('Undo conflicts with a later edit');
      return false;
    }
    source.current.pop();
    target.current.push(changes);
    draft.current.value = merged.value;
    setValue(v3DocumentToLegacy(merged.value));
    persist(draft.current);
    setStatus(blocked.current ? 'conflict' : navigator.onLine ? 'unsaved' : 'offline');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commitRef.current().catch(() => undefined), 400);
    return true;
  };
  const resolveConflicts = async (keepLocal: boolean) => {
    if (!id || !draft.current) return;
    const latest = await loadDocument(),
      d = draft.current;
    if (d.generation !== latest.generation)
      throw new Error(
        'Recover an old-generation draft into a new proposal; overwriting is not allowed'
      );
    const changes = diffStudio(d.base, d.value).filter(
      c => keepLocal || !conflicts.some(f => JSON.stringify(f.path) === JSON.stringify(c.path))
    );
    for (const c of changes) {
      const v = studioValueAtPath(latest.document, c.path);
      c.before = v === undefined ? { exists: false } : { exists: true, value: z.json().parse(v) };
    }
    const merged = mergeStudioV3(latest.document, changes);
    if (merged.conflicts.length) {
      setConflicts(merged.conflicts);
      return;
    }
    draft.current = {
      base: latest.document,
      value: merged.value,
      revision: latest.revision,
      canEdit: latest.canEdit,
      generation: latest.generation,
    };
    blocked.current = false;
    setCanEdit(latest.canEdit);
    setValue(v3DocumentToLegacy(merged.value));
    setConflicts([]);
    setError('');
    persist(draft.current);
    await commitRef.current();
  };
  return {
    recovery: draft.current
      ? { base: draft.current.base, local: draft.current.value, server: remote?.document ?? null }
      : null,
    downloadLocalDraft: () => {
      if (!draft.current) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(draft.current)], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `polity-draft-${id}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    recoverAsProposal: async () => {
      if (!draft.current || !id) throw new Error('No draft');
      const currentDocument = await studio.load({ id });
      const { workspaceId: recoveredId } = await studio.canvas({
        action: 'createDraft',
        projectId: id,
        operationId: crypto.randomUUID(),
        generation: currentDocument.generation,
        revision: currentDocument.revision,
        title: translateText('features.studio.recoveredDraft'),
        reason: translateText('features.studio.recoveredDraftReason'),
      });
      if (!recoveredId) throw new Error('Studio draft creation did not return a workspace');
      await studio.canvas({
        action: 'saveDraft',
        projectId: id,
        workspaceId: recoveredId,
        operationId: crypto.randomUUID(),
        generation: currentDocument.generation,
        revision: 0,
        changes: diffStudio(currentDocument.document, draft.current.value),
      });
      localStorage.setItem(
        `${storageKey}:archived:${draft.current.generation}`,
        JSON.stringify(draft.current)
      );
      localStorage.removeItem(storageKey);
      return recoveredId;
    },
    value,
    v3Value: draft.current?.value ?? null,
    canEdit,
    status,
    error,
    conflicts,
    resolveConflicts,
    peers,
    assets,
    refreshAssets,
    transact,
    transactV3,
    commit,
    collaboration: { commit },
    retry: () => commitRef.current(),
    patchElement: (p: string, e: string, patch: Partial<StudioElement>) =>
      transact(d => edit.patchElement(d, p, e, patch)),
    patchPage: (p: string, patch: Partial<StudioPage>) =>
      transact(d => edit.patchPage(d, p, patch)),
    patchPost: (p: string, patch: edit.PostPatch) => transact(d => edit.patchPost(d, p, patch)),
    insertElement: (p: string, e: StudioElement) => transact(d => edit.insertElement(d, p, e)),
    removeElement: (p: string, e: string) => transact(d => edit.removeElement(d, p, e)),
    addPage: (p: StudioPage) => transact(d => edit.addPage(d, p)),
    meta: (key: string, v: unknown) => transact(d => Object.assign(d, { [key]: v })),
    canUndo: history.current.length > 0,
    canRedo: future.current.length > 0,
    undo: () => undoRedo(true),
    redo: () => undoRedo(false),
    cursor: (pageId: string, x: number, y: number, selection: string[] = []) => {
      presenceCursor.current = { pageId, x, y };
      presenceSelection.current = selection.slice(0, 100);
      publishPresence.current();
    },
  };
}
