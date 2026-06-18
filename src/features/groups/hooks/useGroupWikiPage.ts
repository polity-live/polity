import { useGroupWikiData } from '@/zero/groups/useGroupState';
import { useSubscribeGroup } from '@/features/groups/hooks/useSubscribeGroup';
import { useGroupMembership } from '@/features/groups/hooks/useGroupMembership';
import { countAcceptedMemberships } from '@/features/groups/logic/groupWikiHelpers';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { useAuth } from '@/providers/auth-provider';
import { getGroupTypeFlags } from '@/features/groups/logic/groupTypeFlags';

export function useGroupWikiPage(groupId: string) {
  const { user } = useAuth();

  // Subscribe hook
  const {
    isSubscribed,
    subscriberCount,
    isLoading: subscribeLoading,
    toggleSubscribe,
  } = useSubscribeGroup(groupId);

  // Membership hook
  const {
    status,
    isMember,
    hasRequested,
    isInvited,
    canRequestJoin,
    canAcceptInvitation,
    requestJoinDisabledReason,
    requestJoinConflictResponse,
    acceptInvitationConflictResponse,
    memberCount: membershipCount,
    isLoading: membershipLoading,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  } = useGroupMembership(groupId);

  // Fetch group data
  const { group } = useGroupWikiData(groupId);
  const groupTypeFlags = getGroupTypeFlags(group);

  // ── Derived counts ────────────────────────────────────────────────
  const memberCount =
    group?.member_count ?? membershipCount ?? countAcceptedMemberships(group?.memberships);
  const eventsCount = group?.event_count ?? group?.events?.length ?? 0;
  const amendmentsCount = group?.amendment_count ?? group?.amendments?.length ?? 0;

  // Visibility access check
  const canAccess = checkEntityAccess(group?.visibility, !!user, isMember);

  return {
    // Group data
    group,
    canAccess,
    isAuthenticated: !!user,

    // Derived counts
    memberCount,
    eventsCount,
    amendmentsCount,
    subscriberCount,

    // Subscription
    isSubscribed,
    subscribeLoading,
    toggleSubscribe,

    // Group type
    isBase: groupTypeFlags.isBase,
    isHierarchical: groupTypeFlags.isHierarchical,
    isSibling: groupTypeFlags.isSibling,
    isOpenSibling: groupTypeFlags.isSibling && group?.primary_sibling_membership_mode === 'none',

    // Membership
    status,
    isMember,
    hasRequested,
    isInvited,
    canRequestJoin,
    canAcceptInvitation,
    requestJoinDisabledReason,
    requestJoinConflictResponse,
    acceptInvitationConflictResponse,
    membershipLoading,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  };
}
