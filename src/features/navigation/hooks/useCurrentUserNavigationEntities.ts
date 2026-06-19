import { useMemo } from 'react';

import {
  buildUserMenuEvents,
  buildUserMenuGroups,
} from '@/features/navigation/logic/userMenuItems';
import { useUserEventParticipations } from '@/zero/events/useEventState.ts';
import { useGroupState } from '@/zero/groups/useGroupState.ts';

export function useCurrentUserNavigationEntities(userId?: string) {
  const { currentUserMembershipsWithGroups, isLoading: isLoadingGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: Boolean(userId),
  });
  const { participations, isLoading: isLoadingEvents } = useUserEventParticipations(userId);

  const groups = useMemo(
    () => buildUserMenuGroups(currentUserMembershipsWithGroups || []),
    [currentUserMembershipsWithGroups]
  );
  const events = useMemo(() => buildUserMenuEvents(participations), [participations]);

  return {
    groups,
    events,
    isLoading: Boolean(userId) && (isLoadingGroups || isLoadingEvents),
  };
}
