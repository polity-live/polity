import { useEffect, useRef } from 'react';
import type { EditorContext, ProjectScope } from '../logic/contracts';

const editors = new Map<string, () => Promise<EditorContext>>();
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
      if (selection) last = structuredClone(selection);
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
      if (selections.get(documentId) === getter) selections.delete(documentId);
    };
  }, [documentId]);
}
export const projectTextSelection = (documentId: string) => selections.get(documentId)?.();
export const scopeKey = (scope: ProjectScope) =>
  scope.kind === 'studio' ? `studio:${scope.projectId}` : `amendment:${scope.amendmentId}`;
export function useProjectEditorBridge(
  scope: ProjectScope | null,
  flush: () => Promise<EditorContext>
) {
  const latest = useRef(flush);
  latest.current = flush;
  const key = scope ? scopeKey(scope) : null;
  useEffect(() => {
    if (!key) return;
    const handler = () => latest.current();
    editors.set(key, handler);
    return () => {
      if (editors.get(key) === handler) editors.delete(key);
    };
  }, [key]);
}
export async function flushProjectEditor(scope: ProjectScope, fallback: EditorContext) {
  return editors.get(scopeKey(scope))?.() ?? fallback;
}
