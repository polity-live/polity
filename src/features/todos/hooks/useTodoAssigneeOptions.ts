import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useGroupState, useAssignableGroupMembersByGroupIds } from '@/zero/groups/useGroupState';
import {
  useUserEventParticipations,
  useEventParticipantsByParticipatedEventIds,
} from '@/zero/events/useEventState';
import {
  collectUserIds,
  uniqueUserIds,
  isActiveGroupMemberStatus,
  isActiveEventParticipantStatus,
} from '@/features/create/logic/eligibleUsers';

/** The same eligibility rules as the create flow, loaded only while editing assignees. */
export function useTodoAssigneeOptions(groupId?: string | null) {
  const { user } = useAuth();
  const { currentUserMembershipsWithGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: !groupId,
  });
  const groupIds = useMemo(
    () =>
      groupId
        ? [groupId]
        : currentUserMembershipsWithGroups
            .filter(row => isActiveGroupMemberStatus(row.status))
            .flatMap(row => (row.group_id ? [row.group_id] : [])),
    [groupId, currentUserMembershipsWithGroups]
  );
  const { members, isLoading: groupsLoading } = useAssignableGroupMembersByGroupIds(groupIds);
  const { participations } = useUserEventParticipations(groupId ? undefined : user?.id);
  const eventIds = useMemo(
    () =>
      groupId
        ? []
        : participations
            .filter(row => isActiveEventParticipantStatus(row.status))
            .flatMap(row => (row.event_id ? [row.event_id] : [])),
    [groupId, participations]
  );
  const { participants, isLoading: eventsLoading } =
    useEventParticipantsByParticipatedEventIds(eventIds);
  return {
    allowedUserIds: uniqueUserIds(collectUserIds(members), collectUserIds(participants)),
    isLoading: groupsLoading || eventsLoading,
  };
}
