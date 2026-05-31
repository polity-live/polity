import { useState } from 'react';
import { useQuery, useZero } from '@rocicorp/zero/react';
import { useUserMembershipInGroup } from '@/zero/groups/useGroupState';
import { queries } from '@/zero/queries';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupConflictPreflight } from './useGroupConflictPreflight';
import { toast } from 'sonner';

export type MembershipStatus = 'invited' | 'requested' | 'member' | 'admin';

function isAdminRole(roleName: string | null | undefined) {
  return roleName === 'Admin' || roleName === 'Board Member';
}

function isMemberRole(roleName: string | null | undefined) {
  return roleName === 'Member' || isAdminRole(roleName);
}

function isActiveMembershipStatus(status: string | null | undefined) {
  return status === 'active' || status === 'member' || status === 'admin';
}

function normalizeMembershipStatus(
  status: string | null | undefined,
  roleName: string | null | undefined
): MembershipStatus | null {
  if (status === 'requested' || status === 'invited') {
    return status;
  }

  if (status === 'admin' || isAdminRole(roleName)) {
    return 'admin';
  }

  if (status === 'active' || status === 'member' || isMemberRole(roleName)) {
    return 'member';
  }

  return null;
}

export function useGroupMembership(groupId: string) {
  const zero = useZero();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [group, groupResult] = useQuery(groupId ? queries.groups.byId({ id: groupId }) : undefined);
  const {
    memberships: membershipsData,
    allMemberships: allMembershipsData,
    isLoading: queryLoading,
  } = useUserMembershipInGroup(user?.id, groupId);
  const { memberships: connectedGroupMemberships, isLoading: connectedMembershipLoading } =
    useUserMembershipInGroup(user?.id, group?.connected_group_id ?? undefined);
  const [isLoading, setIsLoading] = useState(false);

  const data = { groupMemberships: membershipsData || [] };

  // Handle multiple memberships - prioritize admin, then member, then invited, then requested
  const memberships = data.groupMemberships || [];
  let membership = memberships[0];

  if (memberships.length > 1) {
    const adminMembership = memberships.find(
      candidate => candidate.status === 'admin' || isAdminRole(candidate.role?.name)
    );
    const memberMembership = memberships.find(
      candidate =>
        candidate.status === 'active' ||
        candidate.status === 'member' ||
        isMemberRole(candidate.role?.name)
    );
    const invitedMembership = memberships.find(candidate => candidate.status === 'invited');
    const requestedMembership = memberships.find(candidate => candidate.status === 'requested');

    membership =
      adminMembership || memberMembership || invitedMembership || requestedMembership || membership;

    console.warn('Multiple memberships found for user in group:', {
      groupId,
      userId: user?.id,
      count: memberships.length,
      memberships: memberships.map(candidate => ({
        id: candidate.id,
        status: candidate.status,
        role: candidate.role?.name,
      })),
      selected: { id: membership?.id, status: membership?.status, role: membership?.role?.name },
    });
  }

  const memberCount =
    (allMembershipsData || []).filter(
      candidate =>
        candidate.status === 'active' ||
        candidate.status === 'member' ||
        candidate.status === 'admin' ||
        isMemberRole(candidate.role?.name)
    ).length || 0;
  const status = normalizeMembershipStatus(membership?.status, membership?.role?.name);
  const isMember = status === 'member' || status === 'admin';
  const isAdmin = status === 'admin';
  const hasRequested = status === 'requested';
  const isInvited = status === 'invited';
  const isConnectedGroupMember = (connectedGroupMemberships || []).some(candidate =>
    isActiveMembershipStatus(candidate.status)
  );
  const siblingJoinRequiresConnectedMembership =
    group?.group_type === 'sibling' &&
    group?.sibling_membership_mode === 'open' &&
    Boolean(group?.connected_group_id);
  const joinEligibilityLoading =
    groupResult.type === 'unknown' ||
    (siblingJoinRequiresConnectedMembership && connectedMembershipLoading);
  const joinConflictPreflight = useGroupConflictPreflight(
    user?.id && !membership && !joinEligibilityLoading && groupId
      ? {
          kind: 'membership_activation',
          group_id: groupId,
          user_id: user.id,
        }
      : null
  );
  const acceptConflictPreflight = useGroupConflictPreflight(
    membership?.id && status === 'invited'
      ? {
          kind: 'membership_activation',
          membership_id: membership.id,
        }
      : null
  );

  let requestJoinDisabledReason: string | undefined;
  if (group?.group_type === 'hierarchical') {
    requestJoinDisabledReason = t('features.groups.hierarchicalMembershipDisabled');
  } else if (group?.group_type === 'sibling') {
    if (group.sibling_membership_mode !== 'open') {
      requestJoinDisabledReason = t('features.groups.automaticSiblingMembershipDisabled');
    } else if (group.connected_group_id && !joinEligibilityLoading && !isConnectedGroupMember) {
      requestJoinDisabledReason = t(
        'features.groups.openSiblingMembershipRequiresConnectedGroupMember'
      );
    }
  }

  if (!requestJoinDisabledReason && joinConflictPreflight.blocking) {
    requestJoinDisabledReason =
      joinConflictPreflight.response.summary ??
      joinConflictPreflight.response.conflicts[0]?.summary ??
      'Diese Anfrage ist aktuell blockiert.';
  }

  const canRequestJoin =
    Boolean(user?.id) && !membership && !joinEligibilityLoading && !requestJoinDisabledReason;
  const canAcceptInvitation =
    status === 'invited' && Boolean(user?.id) && !acceptConflictPreflight.blocking;

  const requestJoin = async () => {
    if (!user?.id || membership || !canRequestJoin) return;

    setIsLoading(true);
    try {
      const result = zero.mutate(
        mutators.groups.joinGroup({
          id: crypto.randomUUID(),
          status: 'requested',
          user_id: user.id,
          group_id: groupId,
          visibility: '',
        })
      );

      await serverConfirmed(result);
      toast.success(t('features.auth.success.membershipRequestSent'));
    } catch (error) {
      toast.error(t('features.groups.toasts.joinFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const leaveGroup = async () => {
    if (!membership?.id) return;

    setIsLoading(true);
    try {
      const result = zero.mutate(
        mutators.groups.leaveGroup({
          id: membership.id,
        })
      );

      await serverConfirmed(result);

      if (status === 'requested') {
        toast.success('Request successfully withdrawn.');
      } else {
        toast.success(t('features.groups.toasts.left'));
      }
    } catch (error) {
      toast.error(t('features.groups.toasts.leaveFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!membership?.id || !canAcceptInvitation || !user?.id) return;

    console.info('Accept button clicked in useGroupMembership', {
      flow: 'group-membership-invitation-accept',
      membershipId: membership.id,
      groupId,
      actorUserId: user.id,
      membershipStatus: membership.status,
    });

    setIsLoading(true);
    try {
      console.info('Client mutation started', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership.id,
        groupId,
        actorUserId: user.id,
      });

      const result = zero.mutate(
        mutators.groups.acceptInvitation({
          id: membership.id,
        })
      );

      console.info('Server validation started', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership.id,
        groupId,
        actorUserId: user.id,
      });

      await serverConfirmed(result);

      console.info('Server successful', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership.id,
        groupId,
        actorUserId: user.id,
      });

      console.info('Client successful', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership.id,
        groupId,
        actorUserId: user.id,
      });
      toast.success(t('features.groups.toasts.invitationAccepted'));
    } catch (error) {
      console.error('Client error', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership.id,
        groupId,
        actorUserId: user.id,
        error,
      });
      toast.error(t('features.groups.toasts.acceptInvitationFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    membership,
    status,
    isMember,
    isAdmin,
    hasRequested,
    isInvited,
    canRequestJoin,
    canAcceptInvitation,
    requestJoinDisabledReason,
    requestJoinConflictResponse: joinConflictPreflight.blocking
      ? joinConflictPreflight.response
      : null,
    acceptInvitationConflictResponse: acceptConflictPreflight.blocking
      ? acceptConflictPreflight.response
      : null,
    memberCount,
    isLoading:
      queryLoading ||
      joinEligibilityLoading ||
      joinConflictPreflight.isLoading ||
      acceptConflictPreflight.isLoading ||
      isLoading,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  };
}
