import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useMemo, useState } from 'react';
import type { EditorContext, ProjectScope } from '../logic/contracts';
import {
  contextReferenceKey,
  fixedContextReference,
  mergeContextReferences,
  type ProjectContextReference,
} from '../logic/context-references';
import { flushProjectEditor, useProjectEditorSnapshot } from './editor-bridge';

export function contextWithReferences(
  context: EditorContext,
  references: ProjectContextReference[]
): EditorContext {
  return {
    ...context,
    references,
    pageId: references.find(ref => ref.kind === 'frame')?.id,
    elementIds: references.filter(ref => ref.kind === 'element').map(ref => ref.id),
    objectIds: references.filter(ref => ref.kind === 'city_object').map(ref => ref.id),
    featureIds: references.filter(ref => ref.kind === 'city_feature').map(ref => ref.id),
    selection: references.some(ref => ref.kind === 'text_selection')
      ? context.selection
      : undefined,
  };
}

export function useProjectComposerContext(
  scope: ProjectScope,
  fallback: EditorContext,
  title: string
) {
  const { t } = useTranslation();
  const publication = useProjectEditorSnapshot(scope, fallback.surface);
  const live = publication?.context ?? fallback;
  const automatic = useMemo<ProjectContextReference[]>(() => {
    const references = live.references ?? [];
    const root: ProjectContextReference =
      scope.kind === 'studio'
        ? { kind: 'studio_project', id: scope.projectId, label: title, origin: 'automatic' }
        : { kind: 'amendment', id: scope.amendmentId, label: title, origin: 'automatic' };
    const refs = references.length ? [...references] : [root];
    const add = (ref: ProjectContextReference) => {
      if (!refs.some(item => item.kind === ref.kind && item.id === ref.id)) refs.push(ref);
    };
    add(root);
    if (scope.kind === 'studio') {
      add({
        kind: 'workspace',
        id: live.proposalId ?? 'canonical',
        workspaceId: live.proposalId ?? null,
        label: live.proposalId ?? t('features.projectChat.context.canonical'),
        origin: 'automatic',
      });
      if (live.pageId)
        add({
          kind: 'frame',
          id: live.pageId,
          workspaceId: live.proposalId ?? null,
          label: live.pageId,
          origin: 'automatic',
        });
      for (const id of live.elementIds ?? [])
        add({
          kind: 'element',
          id,
          workspaceId: live.proposalId ?? null,
          label: id,
          origin: 'automatic',
        });
    } else {
      if (live.branchId)
        add({
          kind: 'branch',
          id: live.branchId,
          label: live.branchId,
          branchId: live.branchId,
          origin: 'automatic',
        });
      if (live.cityDesignId)
        add({
          kind: 'city_design',
          id: live.cityDesignId,
          label: t('features.projectChat.context.city_design'),
          origin: 'automatic',
        });
      for (const id of live.objectIds ?? [])
        add({ kind: 'city_object', id, label: id, origin: 'automatic' });
      for (const id of live.featureIds ?? [])
        add({ kind: 'city_feature', id, label: id, origin: 'automatic' });
      if (
        live.selection &&
        JSON.stringify(live.selection.anchor) !== JSON.stringify(live.selection.focus)
      )
        add({
          kind: 'text_selection',
          id: live.documentId ?? scope.amendmentId,
          label: t('features.projectChat.context.selection'),
          origin: 'automatic',
        });
    }
    return refs;
  }, [live, scope.kind, title, t]);
  const fingerprint = JSON.stringify([
    fallback.surface,
    live.proposalId ?? null,
    live.branchId ?? null,
    automatic.map(contextReferenceKey),
    live.selection,
  ]);
  const [excluded, setExcluded] = useState<{ fingerprint: string; keys: Set<string> }>({
    fingerprint: '',
    keys: new Set(),
  });
  const [manual, setManual] = useState<ProjectContextReference[]>([]);
  const excludedKeys = excluded.fingerprint === fingerprint ? excluded.keys : new Set<string>();
  const references = mergeContextReferences(automatic, manual, excludedKeys);
  const options = publication?.options ?? [];
  return {
    liveContext: live,
    references,
    options,
    add: (ref: ProjectContextReference) =>
      setManual(current => [
        ...current.filter(item => contextReferenceKey(item) !== contextReferenceKey(ref)),
        { ...ref, origin: 'manual' },
      ]),
    remove: (ref: ProjectContextReference) => {
      if (fixedContextReference(ref)) return;
      const key = contextReferenceKey(ref);
      setManual(current => current.filter(item => contextReferenceKey(item) !== key));
      setExcluded({ fingerprint, keys: new Set([...excludedKeys, key]) });
    },
    onSent: () => {
      setManual([]);
      setExcluded({ fingerprint: '', keys: new Set() });
    },
    beforeSend: async () => {
      const frozen = contextWithReferences(structuredClone(live), structuredClone(references));
      if (
        scope.kind === 'studio' &&
        references.some(
          ref =>
            ['frame', 'element'].includes(ref.kind) &&
            ref.workspaceId !== undefined &&
            ref.workspaceId !== (frozen.proposalId ?? null)
        )
      )
        throw new Error('The workspace changed. Choose the context again.');
      const saved = await flushProjectEditor(scope, frozen);
      if (
        (saved.proposalId ?? null) !== (frozen.proposalId ?? null) ||
        (saved.branchId ?? null) !== (frozen.branchId ?? null)
      )
        throw new Error('The editor context changed. Choose the context again.');
      return contextWithReferences(
        { ...saved, ...frozen, contentRevision: saved.contentRevision },
        frozen.references ?? []
      );
    },
  };
}
