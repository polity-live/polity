import { useNewConversationDialogController } from '../hooks/useNewConversationDialogController';
import { NewConversationDialogView } from './NewConversationDialogView';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onUserSelect: (userId: string) => void;
  initialSearchQuery?: string;
  existingConversationUserIds?: string[]; // User IDs that already have a direct conversation
}

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
  onUserSelect,
  initialSearchQuery,
  existingConversationUserIds = [],
}: NewConversationDialogProps) {
  return (
    <NewConversationDialogView
      open={open}
      onOpenChange={onOpenChange}
      onUserSelect={onUserSelect}
      {...useNewConversationDialogController({
        open,
        currentUserId,
        initialSearchQuery,
        existingConversationUserIds,
      })}
    />
  );
}
