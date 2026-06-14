import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '../logic/groupConflictPreflight';
import { PendingRequestActionCellView } from './PendingRequestActionCellView';

interface PendingRequestActionCellProps<TParticipation extends ParticipationLike> {
  membership: TParticipation;
  onApprove: (membershipId: string, userId: string) => void;
  onReject: (membershipId: string, userId: string) => void;
  getApprovePreflightInput?: (
    membership: TParticipation
  ) => GroupConflictMembershipPreflight | null | undefined;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}

export function PendingRequestActionCell<TParticipation extends ParticipationLike>({
  membership,
  onApprove,
  onReject,
  getApprovePreflightInput,
  primaryActionLabel,
  secondaryActionLabel,
}: PendingRequestActionCellProps<TParticipation>) {
  const userId = membership.user?.id ?? null;
  const preflightInput = getApprovePreflightInput?.(membership) ?? null;
  const { response, blocking } = useGroupConflictPreflight(preflightInput, {
    enabled: Boolean(preflightInput),
  });

  return (
    <PendingRequestActionCellView
      membership={membership}
      userId={userId}
      onApprove={onApprove}
      onReject={onReject}
      primaryActionLabel={primaryActionLabel}
      secondaryActionLabel={secondaryActionLabel}
      blocking={blocking}
      response={response}
      labels={{
        why: translateText('generated.inline.0693_warum_194dad5c'),
        blockedTitle: translateText(
          'generated.inline.0709_warum_ist_diese_freigabe_blockiert_29129791'
        ),
      }}
    />
  );
}
