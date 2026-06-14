import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import type { GroupConflictMembershipPreflight } from '@/features/groups/logic/groupConflictPreflight';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { FilterableRecord } from '../hooks/useUserMembershipsFilters';
import { InvitationActionsView } from './InvitationActionsView';

interface InvitationActionsProps {
  item: FilterableRecord;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  getAcceptPreflightInput?: (
    membership: FilterableRecord
  ) => GroupConflictMembershipPreflight | null | undefined;
}

export function InvitationActions({
  item,
  onAccept,
  onDecline,
  getAcceptPreflightInput,
}: InvitationActionsProps) {
  const preflightInput = getAcceptPreflightInput?.(item) ?? null;
  const { response, blocking } = useGroupConflictPreflight(preflightInput, {
    enabled: Boolean(preflightInput),
  });

  return (
    <InvitationActionsView
      item={item}
      onAccept={onAccept}
      onDecline={onDecline}
      blocking={blocking}
      response={response}
      labels={{
        accept: translateText('generated.inline.0121_accept_bb54db51'),
        decline: translateText('generated.inline.0122_decline_b59cf9ed'),
        why: translateText('generated.inline.0693_warum_194dad5c'),
        blockedTitle: translateText(
          'generated.inline.1195_warum_ist_diese_annahme_blockiert_1fd1c7d1'
        ),
      }}
    />
  );
}
