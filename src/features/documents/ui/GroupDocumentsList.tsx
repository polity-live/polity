import { useGroupDocumentsList } from '../hooks/useGroupDocumentsList';
import { GroupDocumentsListView } from './GroupDocumentsListView';

interface GroupDocumentsListProps {
  groupId: string;
  groupName?: string;
  userId?: string;
  storageKey?: string;
  canManageDocuments?: boolean;
}

export function GroupDocumentsList({
  groupId,
  groupName,
  userId,
  storageKey = `group-${groupId}-documents`,
  canManageDocuments = true,
}: GroupDocumentsListProps) {
  const model = useGroupDocumentsList({
    groupId,
    groupName,
    userId,
    storageKey,
    canManageDocuments,
  });

  return <GroupDocumentsListView {...model} />;
}
