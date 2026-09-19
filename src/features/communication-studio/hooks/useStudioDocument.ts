import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import {
  useCollaborationDocument,
  encodeDocument,
} from '@/features/collaboration/hooks/useCollaborationDocument';
import { studioRequest } from '@/zero/communication-studio/useStudioApi';
import {
  patchElement,
  patchPage,
  insertElement,
  removeElement,
  addPage,
  patchPost,
  type PostPatch,
} from '../logic/collaboration';
import type { StudioDocument, StudioElement, StudioPage } from '../logic/document';
export interface StudioAsset {
  id: string;
  name: string;
  mime: string;
  url: string;
}
export function useStudioDocument(id: string | undefined, user: { id: string; name: string }) {
  const shared = useCollaborationDocument(
    id ? { kind: 'studio', entityId: id, branchId: null, workspaceId: null } : null,
    user.id
  );
  const [assets, setAssets] = useState<StudioAsset[]>([]),
    [peers, setPeers] = useState<any[]>([]);
  const origin = useRef({ editor: crypto.randomUUID() });
  const undo = useRef<Y.UndoManager | null>(null);
  const currentProject = useRef(id);
  currentProject.current = id;
  const refreshAssets = useCallback(async () => {
    if (!id) return;
    const result = await studioRequest<StudioAsset[]>('assets', { id });
    if (currentProject.current === id) setAssets(result);
  }, [id]);
  useEffect(() => {
    setAssets([]);
    setPeers([]);
    if (!shared.doc) return;
    const doc = shared.doc,
      provider = shared.provider;
    const manager = new Y.UndoManager(
      [doc.getMap('pages'), doc.getMap('meta'), doc.getMap('posts')],
      { trackedOrigins: new Set([origin.current]) }
    );
    undo.current = manager;
    provider?.awareness?.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: '#B88A3B',
    });
    const presence = () =>
      setPeers(
        [...(provider?.awareness?.getStates().entries() ?? [])]
          .filter(([client]) => client !== doc.clientID)
          .map(([, state]) => state)
      );
    provider?.awareness?.on('change', presence);
    presence();
    void refreshAssets().catch(error => console.error('Studio asset refresh failed', error));
    const assetRenewal = setInterval(
      () =>
        void refreshAssets().catch(error => console.error('Studio asset refresh failed', error)),
      240_000
    );
    return () => {
      clearInterval(assetRenewal);
      manager.destroy();
      undo.current = null;
      provider?.awareness?.off('change', presence);
    };
  }, [shared.doc, shared.provider, user.id, user.name, refreshAssets]);
  const transact = (action: (doc: Y.Doc) => void) => {
    const doc = shared.doc;
    if (doc && shared.canEdit) doc.transact(() => action(doc), origin.current);
  };
  return {
    value: shared.value as StudioDocument | null,
    collaboration: shared,
    canEdit: shared.canEdit,
    error: shared.error,
    status: shared.phase === 'active' ? shared.status : shared.phase,
    peers,
    assets,
    refreshAssets,
    transact,
    patchElement: (page: string, el: string, p: Partial<StudioElement>) =>
      transact(d => patchElement(d, page, el, p, origin.current)),
    patchPage: (page: string, p: Partial<StudioPage>) => transact(d => patchPage(d, page, p)),
    patchPost: (post: string, p: PostPatch) => transact(d => patchPost(d, post, p)),
    insertElement: (page: string, e: StudioElement) => transact(d => insertElement(d, page, e)),
    removeElement: (page: string, e: string) => transact(d => removeElement(d, page, e)),
    addPage: (p: StudioPage) => transact(d => addPage(d, p)),
    meta: (key: string, value: unknown) => transact(d => d.getMap('meta').set(key, value)),
    undo: () => {
      if (shared.canEdit) undo.current?.undo();
    },
    redo: () => {
      if (shared.canEdit) undo.current?.redo();
    },
    cursor: (pageId: string, x: number, y: number) =>
      shared.provider?.awareness?.setLocalStateField('cursor', { pageId, x, y }),
    state: () => {
      if (!shared.doc) throw new Error('Document not loaded');
      return encodeDocument(shared.doc);
    },
  };
}
