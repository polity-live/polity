import { useMemo } from 'react';
import { useGroupMembershipComposition } from '@/features/groups/hooks/useGroupMembershipComposition';
import type {
  MembershipCompositionGroupLike,
  MembershipProvenanceFields,
  MembershipWithCompositionSource,
} from '@/features/groups/logic/membershipComposition';
import type { ParticipationLike } from '@/features/shared/types/participation';

interface DelegateLike {
  user_id?: string | null;
  group_id?: string | null;
  group?: MembershipCompositionGroupLike | null;
}

interface DelegateAssemblyEventLike {
  event_type?: string | null;
  group?: MembershipCompositionGroupLike | null;
  delegates?: readonly DelegateLike[] | null;
}

type CompositionParticipant = MembershipWithCompositionSource & MembershipProvenanceFields;

export function useDelegateAssemblyParticipantsComposition<
  TParticipant extends ParticipationLike,
  TEvent extends DelegateAssemblyEventLike,
>(event: TEvent | null | undefined, participants: readonly TParticipant[]) {
  const isDelegateAssembly = event?.event_type === 'delegate_assembly';

  const participantsWithDelegateSource = useMemo(() => {
    if (!isDelegateAssembly) {
      return participants as (TParticipant & MembershipProvenanceFields)[];
    }

    const delegateByUserId = new Map<string, DelegateLike>();
    for (const delegate of event?.delegates || []) {
      if (!delegate.user_id || !delegate.group_id) {
        continue;
      }

      delegateByUserId.set(delegate.user_id, delegate);
    }

    return participants.map(participant => {
      const delegate = participant.user_id ? delegateByUserId.get(participant.user_id) : undefined;
      if (!delegate?.group_id) {
        return participant;
      }

      return {
        ...participant,
        source_group_id: delegate.group_id,
        source_group: delegate.group ?? participant.source_group ?? null,
      };
    }) as (TParticipant & MembershipProvenanceFields)[];
  }, [event?.delegates, isDelegateAssembly, participants]);

  const composition = useGroupMembershipComposition(
    isDelegateAssembly ? event?.group : null,
    participantsWithDelegateSource as CompositionParticipant[]
  );

  return {
    isDelegateAssembly,
    showComposition: isDelegateAssembly && composition.showComposition,
    participantsWithProvenance: composition.membershipsWithProvenance as (TParticipant &
      MembershipProvenanceFields)[],
    compositionBuckets: composition.compositionBuckets,
    isLoading: composition.isLoading,
  };
}
