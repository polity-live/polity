import { useCreateDocumentDialogController } from '../hooks/useCreateDocumentDialogController';
import { CreateDocumentDialogView } from './CreateDocumentDialogView';

interface CreateDocumentDialogProps {
  groupId: string;
  groupName?: string;
  onCreateDocument: (title: string) => Promise<void>;
  isCreating?: boolean;
}

export function CreateDocumentDialog({
  groupName,
  onCreateDocument,
  isCreating = false,
}: CreateDocumentDialogProps) {
  return (
    <CreateDocumentDialogView
      groupName={groupName}
      isCreating={isCreating}
      {...useCreateDocumentDialogController({ onCreateDocument, isCreating })}
    />
  );
}
