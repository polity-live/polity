import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface DocumentStateOptions {
  documentId?: string;
  includeVersions?: boolean;
  includeCollaborators?: boolean;
}

/**
 * Reactive state hook for document data.
 * Returns all query-derived state — no mutations.
 */
export function useDocumentState(options: DocumentStateOptions) {
  const { documentId, includeVersions, includeCollaborators } = options;

  const [document, documentResult] = useQuery(
    documentId ? queries.documents.byId({ id: documentId }) : undefined
  );

  const [threads, threadsResult] = useQuery(
    documentId ? queries.documents.threads({ document_id: documentId }) : undefined
  );

  const [versions, versionsResult] = useQuery(
    includeVersions && documentId
      ? queries.documents.versions({ document_id: documentId })
      : undefined
  );

  const [collaborators, collaboratorsResult] = useQuery(
    includeCollaborators && documentId
      ? queries.documents.collaborators({ document_id: documentId })
      : undefined
  );

  const isLoading =
    (!!documentId && documentResult.type === 'unknown') ||
    (!!documentId && threadsResult.type === 'unknown') ||
    (includeVersions === true && !!documentId && versionsResult.type === 'unknown') ||
    (includeCollaborators === true && !!documentId && collaboratorsResult.type === 'unknown');

  return {
    document,
    threads,
    versions: versions ?? [],
    collaborators: collaborators ?? [],
    isLoading,
  };
}
