import { useMemo } from 'react';

import {
  buildUserMenuAmendments,
  buildUserMenuEvents,
  buildUserMenuGroups,
} from '@/features/navigation/logic/userMenuItems';
import { useCurrentUserOpenNavigationAmendments } from '@/zero/amendments/useAmendmentState.ts';
import { useUserEventParticipations } from '@/zero/events/useEventState.ts';
import { useGroupState } from '@/zero/groups/useGroupState.ts';

export function useCurrentUserNavigationEntities(userId?: string) {
  const { currentUserMembershipsWithGroups, isLoading: isLoadingGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: Boolean(userId),
  });
  const { participations, isLoading: isLoadingEvents } = useUserEventParticipations(userId);
  const { amendments: openAmendments, isLoading: isLoadingAmendments } =
    useCurrentUserOpenNavigationAmendments(userId);

  const groups = useMemo(
    () => buildUserMenuGroups(currentUserMembershipsWithGroups || []),
    [currentUserMembershipsWithGroups]
  );
  const events = useMemo(() => buildUserMenuEvents(participations), [participations]);
  const amendments = useMemo(() => buildUserMenuAmendments(openAmendments), [openAmendments]);

  return {
    groups,
    events,
    amendments,
    isLoading: Boolean(userId) && (isLoadingGroups || isLoadingEvents || isLoadingAmendments),
  };
}
