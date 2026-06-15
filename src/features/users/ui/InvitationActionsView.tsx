import { Check, X } from 'lucide-react';

import { GroupConflictDialog } from '@/features/groups/ui/GroupConflictPanel';
import { Button } from '@/features/shared/ui/ui/button';

interface InvitationActionsViewProps {
  item: { id: string };
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  blocking: boolean;
  acceptDisabled?: boolean;
  response: any;
  labels: {
    accept: string;
    decline: string;
    why: string;
    blockedTitle: string;
  };
}

export function InvitationActionsView({
  item,
  onAccept,
  onDecline,
  blocking,
  acceptDisabled = false,
  response,
  labels,
}: InvitationActionsViewProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={blocking || acceptDisabled}
        onClick={() => onAccept?.(item.id)}
      >
        <Check className="mr-1 h-4 w-4" />
        {labels.accept}
      </Button>
      {blocking ? (
        <GroupConflictDialog
          response={response}
          triggerLabel={labels.why}
          triggerVariant="ghost"
          title={labels.blockedTitle}
        />
      ) : null}
      <Button variant="outline" size="sm" onClick={() => onDecline?.(item.id)}>
        <X className="mr-1 h-4 w-4" />
        {labels.decline}
      </Button>
    </div>
  );
}
