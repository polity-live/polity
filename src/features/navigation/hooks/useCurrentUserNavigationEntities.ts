import { useMemo } from 'react';

import {
  buildUserMenuAmendments,
  buildUserMenuEvents,
  buildUserMenuGroups,
} from '@/features/navigation/logic/userMenuItems';
import { useCurrentUserOpenNavigationAmendments } from '@/zero/amendments/useAmendmentState.ts';
import { useUserEventParticipations } from '@/zero/events/useEventState.ts';
import { useGroupState } from '@/zero/groups/useGroupState.ts';

export function useCurrentUserNavigationEntities(userId?: string, enabled = true) {
  const enabledUserId = enabled ? userId : undefined;
  const {
    currentUserMembershipsWithGroups,
    currentUserGuestAccessesWithGroups,
    isLoading: isLoadingGroups,
  } = useGroupState({
    includeCurrentUserMembershipsWithGroups: Boolean(enabledUserId),
    includeCurrentUserGuestAccessesWithGroups: Boolean(enabledUserId),
  });
  const { participations, isLoading: isLoadingEvents } = useUserEventParticipations(enabledUserId);
  const { amendments: openAmendments, isLoading: isLoadingAmendments } =
    useCurrentUserOpenNavigationAmendments(enabledUserId);

  const groups = useMemo(
    () =>
      enabled
        ? buildUserMenuGroups([
            ...(currentUserMembershipsWithGroups || []),
            ...(currentUserGuestAccessesWithGroups || []),
          ])
        : [],
    [currentUserGuestAccessesWithGroups, currentUserMembershipsWithGroups, enabled]
  );
  const events = useMemo(
    () => (enabled ? buildUserMenuEvents(participations) : []),
    [enabled, participations]
  );
  const amendments = useMemo(
    () => (enabled ? buildUserMenuAmendments(openAmendments) : []),
    [enabled, openAmendments]
  );

  return {
    groups,
    events,
    amendments,
    isLoading:
      Boolean(enabledUserId) && (isLoadingGroups || isLoadingEvents || isLoadingAmendments),
  };
}
