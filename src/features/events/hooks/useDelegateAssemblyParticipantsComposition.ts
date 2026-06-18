import { useMemo } from 'react';
import { useGroupMembershipComposition } from '@/features/groups/hooks/useGroupMembershipComposition';
import type { ParticipationLike } from '@/features/shared/types/participation';
import {
  buildEventParticipantCompositionBuckets,
  buildEventParticipantCompositionSources,
  maskUnmatchedEventParticipantComposition,
  type EventParticipantCompositionEventLike,
  type EventParticipantWithCompositionProvenance,
} from '../logic/eventParticipantComposition';

export function useEventParticipantsComposition<
  TParticipant extends ParticipationLike,
  TEvent extends EventParticipantCompositionEventLike,
>(event: TEvent | null | undefined, participants: readonly TParticipant[]) {
  const compositionSources = useMemo(
    () => buildEventParticipantCompositionSources(event, participants),
    [event, participants]
  );

  const composition = useGroupMembershipComposition(
    compositionSources.shouldResolveGroupComposition ? event?.group : null,
    compositionSources.participants
  );

  const participantsWithProvenance = useMemo(
    () =>
      maskUnmatchedEventParticipantComposition(
        (composition.showComposition
          ? composition.membershipsWithProvenance
          : compositionSources.participants) as EventParticipantWithCompositionProvenance<TParticipant>[]
      ),
    [
      composition.membershipsWithProvenance,
      composition.showComposition,
      compositionSources.participants,
    ]
  );

  const compositionBuckets = useMemo(
    () =>
      composition.isLoading
        ? []
        : buildEventParticipantCompositionBuckets(participantsWithProvenance),
    [composition.isLoading, participantsWithProvenance]
  );

  return {
    isDelegateAssembly: compositionSources.isDelegateAssembly,
    showComposition:
      compositionSources.hasGroupBackedComposition ||
      compositionSources.shouldResolveGroupComposition ||
      compositionBuckets.length > 0,
    participantsWithProvenance,
    compositionBuckets,
    isLoading: composition.isLoading,
  };
}

export const useDelegateAssemblyParticipantsComposition = useEventParticipantsComposition;
