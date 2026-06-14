import { Check, Trash2 } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import { GroupConflictDialog } from './GroupConflictPanel';

interface PendingRequestActionCellViewProps {
  membership: { id: string };
  userId: string | null;
  onApprove: (membershipId: string, userId: string) => void;
  onReject: (membershipId: string, userId: string) => void;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  blocking: boolean;
  response: any;
  labels: {
    why: string;
    blockedTitle: string;
  };
}

export function PendingRequestActionCellView({
  membership,
  userId,
  onApprove,
  onReject,
  primaryActionLabel,
  secondaryActionLabel,
  blocking,
  response,
  labels,
}: PendingRequestActionCellViewProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={!userId || blocking}
        onClick={() => userId && onApprove(membership.id, userId)}
      >
        <Check className="mr-1 h-4 w-4" />
        {primaryActionLabel}
      </Button>
      {blocking ? (
        <GroupConflictDialog
          response={response}
          triggerLabel={labels.why}
          triggerVariant="ghost"
          title={labels.blockedTitle}
        />
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={!userId}
        onClick={() => userId && onReject(membership.id, userId)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="ml-2">{secondaryActionLabel}</span>
      </Button>
    </div>
  );
}
