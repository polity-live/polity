import { useMemo } from 'react';

import { usePqlCollection } from '@/features/pql/hooks/usePqlCollection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import {
  buildCollaboratorOptions,
  buildDocumentPqlFields,
  getDocumentSearchValues,
  sortDocuments,
  type DocumentFieldKey,
} from '../logic/groupDocumentsList';
import { useDocumentMutations } from './useDocumentMutations';
import { useGroupDocuments } from './useGroupDocuments';

export interface UseGroupDocumentsListOptions {
  groupId: string;
  groupName?: string;
  userId?: string;
  storageKey?: string;
  canManageDocuments?: boolean;
}

export type GroupDocumentItem = ReturnType<typeof useGroupDocuments>['documents'][number];
export type { DocumentFieldKey };

export function useGroupDocumentsList({
  groupId,
  groupName,
  userId,
  storageKey = `group-${groupId}-documents`,
  canManageDocuments = true,
}: UseGroupDocumentsListOptions) {
  const { documents, isLoading } = useGroupDocuments(groupId);
  const { createDocument, isCreating } = useDocumentMutations(groupId);

  const collaboratorOptions = useMemo(() => buildCollaboratorOptions(documents), [documents]);

  const fields = useMemo(
    () =>
      buildDocumentPqlFields<GroupDocumentItem>(collaboratorOptions, {
        title: translateText('generated.inline.0086_title_768e0c1c'),
        collaborator: translateText('generated.inline.0087_collaborator_794b34c1'),
        updated: translateText('generated.inline.0088_updated_f2f8570d'),
        created: translateText('generated.inline.0089_created_accf40c8'),
      }),
    [collaboratorOptions]
  );

  const pql = usePqlCollection({
    items: documents,
    fields,
    quickFilters: [],
    storageKey,
    groupId,
    searchValues: [getDocumentSearchValues],
    sortItems: sortDocuments,
  });

  const handleCreateDocument = async (title: string) => {
    if (!userId) return;
    await createDocument(title, groupId, userId);
  };

  return {
    groupId,
    groupName,
    canManageDocuments,
    documents,
    isLoading,
    isCreating,
    fields,
    pql,
    onCreateDocument: handleCreateDocument,
  };
}

export type GroupDocumentsListModel = ReturnType<typeof useGroupDocumentsList>;
