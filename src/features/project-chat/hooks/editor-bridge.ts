import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ProjectContextReference } from '../logic/context-references';
import type { EditorContext, ProjectScope } from '../logic/contracts';

export interface EditorPublication {
  context: EditorContext;
  options?: readonly ProjectContextReference[];
}
export interface ProjectEditorFocusTarget {
  nodeId: string;
  workspaceId: string | null;
}
export type ProjectEditorFocus = (target: ProjectEditorFocusTarget) => Promise<void>;
export async function focusProjectEditor(scope: ProjectScope, target: ProjectEditorFocusTarget) {
  const editor = editors.get(`${scopeKey(scope)}:studio`);
  if (!editor?.focus) return false;
  await editor.focus(target);
  return true;
}
const editors = new Map<
  string,
  {
    owner: symbol;
    flush: () => Promise<EditorContext>;
    publication?: EditorPublication;
    focus?: ProjectEditorFocus;
  }
>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};
const textSnapshots = new Map<string, EditorContext['selection']>();
const selections = new Map<string, () => EditorContext['selection']>();
export function useProjectTextSelection(
  documentId: string | undefined,
  read: () => EditorContext['selection'] | null
) {
  const current = useRef(read);
  current.current = read;
  useEffect(() => {
    if (!documentId) return;
    let last: EditorContext['selection'];
    const capture = () => {
      const selection = current.current();
      if (selection && JSON.stringify(last) !== JSON.stringify(selection)) {
        last = structuredClone(selection);
        textSnapshots.set(documentId, last);
        notify();
      }
    };
    const listener = () => queueMicrotask(capture);
    const getter = () => {
      capture();
      return last;
    };
    selections.set(documentId, getter);
    document.addEventListener('selectionchange', listener);
    return () => {
      document.removeEventListener('selectionchange', listener);
      if (selections.get(documentId) === getter) {
        selections.delete(documentId);
        textSnapshots.delete(documentId);
        notify();
      }
    };
  }, [documentId]);
}
export const projectTextSelection = (documentId: string) => selections.get(documentId)?.();
export const scopeKey = (scope: ProjectScope) =>
  scope.kind === 'studio' ? `studio:${scope.projectId}` : `amendment:${scope.amendmentId}`;
export function useProjectTextSelectionSnapshot(documentId: string) {
  return useSyncExternalStore(
    subscribe,
    () => textSnapshots.get(documentId),
    () => undefined
  );
}
export function useProjectEditorSnapshot(scope: ProjectScope, surface: EditorContext['surface']) {
  const key = `${scopeKey(scope)}:${surface}`;
  return useSyncExternalStore(
    subscribe,
    () => editors.get(key)?.publication,
    () => undefined
  );
}
export function useProjectEditorBridge(
  scope: ProjectScope | null,
  flush: () => Promise<EditorContext>,
  publication?: EditorPublication,
  focus?: ProjectEditorFocus
) {
  const latest = useRef(flush);
  latest.current = flush;
  const latestFocus = useRef(focus);
  latestFocus.current = focus;
  const owner = useRef(Symbol('editor'));
  const key = scope ? `${scopeKey(scope)}:${publication?.context.surface ?? 'legacy'}` : null;
  useEffect(() => {
    if (!key) return;
    editors.set(key, {
      owner: owner.current,
      flush: () => latest.current(),
      publication,
      focus: focus
        ? async target => {
            const current = latestFocus.current;
            if (!current) throw new Error('Canvas unavailable');
            await current(target);
          }
        : undefined,
    });
    notify();
    return () => {
      if (editors.get(key)?.owner === owner.current) {
        editors.delete(key);
        notify();
      }
    };
  }, [key]);
  useEffect(() => {
    if (!key) return;
    const editor = editors.get(key);
    if (
      editor?.owner === owner.current &&
      publication &&
      JSON.stringify(editor.publication) !== JSON.stringify(publication)
    ) {
      editor.publication = structuredClone(publication);
      notify();
    }
  });
}
export async function flushProjectEditor(scope: ProjectScope, fallback: EditorContext) {
  const key = `${scopeKey(scope)}:${fallback.surface}`;
  const editor = editors.get(key) ?? editors.get(`${scopeKey(scope)}:legacy`);
  const before = editor?.publication?.context;
  const context = await (editor?.flush() ?? fallback);
  const after = editors.get(key)?.publication?.context ?? context;
  if (
    before &&
    ((before.proposalId ?? null) !== (after.proposalId ?? null) ||
      (before.branchId ?? null) !== (after.branchId ?? null))
  )
    throw new Error('The workspace changed. Choose the context again.');
  return context;
}
