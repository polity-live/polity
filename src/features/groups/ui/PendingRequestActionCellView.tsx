import { Check, Trash2 } from 'lucide-react';

import { TableActionIconButton } from '@/features/shared/ui/data-table';
import { GroupConflictDialog } from './GroupConflictPanel';

interface PendingRequestActionCellViewProps {
  membership: { id: string };
  userId: string | null;
  onApprove: (membershipId: string, userId: string) => void;
  onReject: (membershipId: string, userId: string) => void;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  blocking: boolean;
  checking?: boolean;
  response: any;
  labels: {
    why: string;
    checking: string;
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
  checking = false,
  response,
  labels,
}: PendingRequestActionCellViewProps) {
  return (
    <div className="flex justify-end gap-2">
      <TableActionIconButton
        data-action-id="groups.requests.approve.membership"
        label={primaryActionLabel}
        icon={<Check className="h-4 w-4" />}
        loading={checking}
        loadingLabel={labels.checking}
        variant="default"
        disabled={!userId || blocking}
        onClick={() => userId && !checking && onApprove(membership.id, userId)}
      />
      {blocking ? (
        <GroupConflictDialog
          response={response}
          triggerLabel={labels.why}
          triggerVariant="ghost"
          title={labels.blockedTitle}
        />
      ) : null}
      <TableActionIconButton
        data-action-id="groups.requests.reject.membership"
        label={secondaryActionLabel}
        icon={<Trash2 className="h-4 w-4" />}
        variant="ghost"
        destructive
        disabled={!userId}
        onClick={() => userId && onReject(membership.id, userId)}
      />
    </div>
  );
}
