import { useState } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { useViewerMembershipOverview } from '@/zero/groups/useGroupState';
import { mutators } from '@/zero/mutators';
import { trackServerFinalization, waitForClientApply } from '@/zero/mutate-with-server-check';
import { useAuth } from '@/providers/auth-provider';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useGroupConflictPreflight } from './useGroupConflictPreflight';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { ProjectedGroupMembershipState } from '@/features/search/types/projected-card-state';

export type MembershipStatus = 'invited' | 'requested' | 'member' | 'admin';

function isGuestOnlySiblingMembershipMode(mode: string | null | undefined) {
  return mode === 'all_members' || mode === 'role_members' || mode === 'selected_source_groups';
}

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

export function useGroupMembership(
  groupId: string,
  projectedState?: ProjectedGroupMembershipState
) {
  const zero = useZero();
  const { t } = useTranslation();
  const { user } = useAuth();
  const viewerOverview = useViewerMembershipOverview(projectedState ? undefined : groupId);
  const queriedGroup = viewerOverview.group;
  const queriedGroupLoading = viewerOverview.isLoading;
  const group = projectedState?.group ?? queriedGroup;
  const groupLoading = projectedState ? false : queriedGroupLoading;
  const membershipsData = viewerOverview.memberships;
  const guestAccessesData = viewerOverview.guestAccesses;
  const connectedGroupMemberships = viewerOverview.connectedGroupMemberships;
  const queryLoading = viewerOverview.isLoading;
  const connectedMembershipLoading = viewerOverview.isLoading;
  const [isLoading, setIsLoading] = useState(false);

  const data = {
    groupMemberships: projectedState?.memberships ?? membershipsData ?? [],
  };

  // Handle multiple memberships - prioritize admin, then member, then invited, then requested
  const memberships = data.groupMemberships || [];
  let membership = memberships[0];
  const guestAccess = projectedState?.guestAccesses[0] ?? (guestAccessesData || [])[0] ?? null;

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
    projectedState?.memberCount ?? viewerOverview.group?.signed_up_member_count ?? 0;
  const status = normalizeMembershipStatus(membership?.status, membership?.role?.name);
  const requiresGuestAccessFlow =
    group?.group_type === 'sibling' &&
    isGuestOnlySiblingMembershipMode(group?.primary_sibling_membership_mode ?? null);
  const effectiveStatus: MembershipStatus | null =
    status ??
    (guestAccess?.status === 'requested'
      ? 'requested'
      : guestAccess?.status === 'invited'
        ? 'invited'
        : guestAccess?.status === 'active'
          ? 'member'
          : null);
  const isMember = effectiveStatus === 'member' || effectiveStatus === 'admin';
  const isAdmin = effectiveStatus === 'admin';
  const hasRequested = effectiveStatus === 'requested';
  const isInvited = effectiveStatus === 'invited';
  const isConnectedGroupMember = (
    projectedState?.connectedGroupMemberships ??
    connectedGroupMemberships ??
    []
  ).some(candidate => isActiveMembershipStatus(candidate.status));
  const primarySiblingMembershipMode = group?.primary_sibling_membership_mode ?? null;
  const siblingJoinRequiresConnectedMembership =
    group?.group_type === 'sibling' &&
    primarySiblingMembershipMode === 'none' &&
    Boolean(group?.connected_group_id);
  const joinEligibilityLoading =
    groupLoading || (siblingJoinRequiresConnectedMembership && connectedMembershipLoading);
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
    if (primarySiblingMembershipMode !== 'none' && !requiresGuestAccessFlow) {
      requestJoinDisabledReason = t('features.groups.automaticSiblingMembershipDisabled');
    } else if (group.connected_group_id && !joinEligibilityLoading && !isConnectedGroupMember) {
      requestJoinDisabledReason = t(
        'features.groups.openSiblingMembershipRequiresConnectedGroupMember'
      );
    }
  }

  if (!requestJoinDisabledReason && !requiresGuestAccessFlow && joinConflictPreflight.blocking) {
    requestJoinDisabledReason =
      joinConflictPreflight.response.summary ??
      joinConflictPreflight.response.conflicts[0]?.summary ??
      'Diese Anfrage ist aktuell blockiert.';
  }

  const canRequestJoin =
    Boolean(user?.id) &&
    !membership &&
    !guestAccess &&
    !joinEligibilityLoading &&
    !requestJoinDisabledReason;
  const canAcceptInvitation =
    effectiveStatus === 'invited' &&
    Boolean(user?.id) &&
    (requiresGuestAccessFlow || !acceptConflictPreflight.blocking);

  const requestJoin = async () => {
    if (!user?.id || membership || guestAccess || !canRequestJoin) return;

    setIsLoading(true);
    try {
      const result = requiresGuestAccessFlow
        ? zero.mutate(
            mutators.groups.requestGuestAccess({
              id: crypto.randomUUID(),
              status: 'requested',
              user_id: user.id,
              group_id: groupId,
            })
          )
        : zero.mutate(
            mutators.groups.joinGroup({
              id: crypto.randomUUID(),
              status: 'requested',
              user_id: user.id,
              group_id: groupId,
              visibility: '',
            })
          );

      trackServerFinalization(result, {
        onError: error =>
          toast.error(t('features.groups.toasts.joinFailed'), {
            description: error.message,
          }),
      });
      await waitForClientApply(result);
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
    if (!membership?.id && !guestAccess?.id) return;
    const guestAccessId = guestAccess?.id;

    setIsLoading(true);
    try {
      const result = membership?.id
        ? zero.mutate(
            mutators.groups.leaveGroup({
              id: membership.id,
            })
          )
        : !guestAccessId
          ? null
          : zero.mutate(
              mutators.groups.revokeGuestAccess({
                id: guestAccessId,
              })
            );

      if (!result) {
        return;
      }

      trackServerFinalization(result, {
        onError: error =>
          toast.error(t('features.groups.toasts.leaveFailed'), {
            description: error.message,
          }),
      });
      await waitForClientApply(result);

      if (effectiveStatus === 'requested') {
        toast.success(
          translateText('generated.inline.0554_request_successfully_withdrawn_d63ad8e3')
        );
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
    if ((!membership?.id && !guestAccess?.id) || !canAcceptInvitation || !user?.id) return;
    const guestAccessId = guestAccess?.id;

    setIsLoading(true);
    try {
      console.info('Client mutation started', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership?.id ?? guestAccess?.id,
        groupId,
        actorUserId: user.id,
      });

      const result = membership?.id
        ? zero.mutate(
            mutators.groups.acceptInvitation({
              id: membership.id,
            })
          )
        : !guestAccessId
          ? null
          : zero.mutate(
              mutators.groups.acceptGuestInvitation({
                id: guestAccessId,
              })
            );

      if (!result) {
        return;
      }
      trackServerFinalization(result, {
        onSuccess: () =>
          console.info('Server successful', {
            flow: 'group-membership-invitation-accept',
            membershipId: membership?.id ?? guestAccess?.id,
            groupId,
            actorUserId: user.id,
          }),
        onError: error => {
          console.error('Server error', {
            flow: 'group-membership-invitation-accept',
            membershipId: membership?.id ?? guestAccess?.id,
            groupId,
            actorUserId: user.id,
            error,
          });
          toast.error(t('features.groups.toasts.acceptInvitationFailed'), {
            description: error.message,
          });
        },
      });
      await waitForClientApply(result);
      toast.success(t('features.groups.toasts.invitationAccepted'));
    } catch (error) {
      console.error('Client error', {
        flow: 'group-membership-invitation-accept',
        membershipId: membership?.id ?? guestAccess?.id,
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
    membership: membership ?? guestAccess,
    status: effectiveStatus,
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
      (projectedState?.isLoading ?? queryLoading) ||
      joinEligibilityLoading ||
      (!requiresGuestAccessFlow && joinConflictPreflight.isLoading) ||
      (!requiresGuestAccessFlow && acceptConflictPreflight.isLoading) ||
      isLoading,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  };
}
