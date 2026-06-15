import { useState } from 'react';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Hook for group membership mutations
 */
export function useGroupMutations(groupId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const {
    inviteMember,
    inviteGuest,
    revokeGuestAccess,
    updateMemberRole,
    syncMembershipRoles,
    acceptGuestInvitation,
    leaveGroup: leaveGroupAction,
    createRole: createRoleAction,
    deleteRole: deleteRoleAction,
    assignActionRight,
  } = useGroupActions();

  const logGeneralAssemblyEventSearchResults = async (
    membershipId: string,
    membershipUserId: string
  ) => {
    if (!session?.access_token) {
      console.warn('General assembly event search results unavailable', {
        flow: 'group-membership-request-approve',
        reason: 'missing-access-token',
        membershipId,
        membershipUserId,
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/debug/group-general-assemblies?membershipId=${encodeURIComponent(membershipId)}`,
        {
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        console.warn('General assembly event search results unavailable', {
          flow: 'group-membership-request-approve',
          membershipId,
          membershipUserId,
          status: response.status,
        });
        return;
      }

      const payload = await response.json();
      console.info('General assembly event search results', payload);
    } catch (error) {
      console.error('General assembly event search failed', {
        flow: 'group-membership-request-approve',
        membershipId,
        membershipUserId,
        error,
      });
    }
  };

  /**
   * Invite users to the group
   */
  const inviteUsers = async (
    userIds: string[],
    roleIds: string[] = [],
    senderId?: string,
    senderName?: string,
    groupName?: string
  ) => {
    void senderName;
    void groupName;

    if (userIds.length === 0) return { success: false, error: 'No users selected' };

    setIsLoading(true);
    try {
      const dedupedRoleIds = [...new Set(roleIds.filter(Boolean))];

      await Promise.all(
        userIds.map(async userId => {
          const membershipId = crypto.randomUUID();
          await serverConfirmed(
            inviteMember({
              id: membershipId,
              user_id: userId,
              group_id: groupId,
              initial_role_id: dedupedRoleIds[0] ?? null,
              visibility: '',
              status: 'invited',
            })
          );
          if (dedupedRoleIds.length > 0) {
            await serverConfirmed(
              syncMembershipRoles({
                group_membership_id: membershipId,
                role_ids: dedupedRoleIds,
                assigned_by_id: senderId ?? null,
              })
            );
          }
        })
      );
      toast.success(`Successfully invited ${userIds.length} user(s)`);
      return { success: true };
    } catch (error) {
      console.error('Failed to invite users:', error);
      toast.error(translateText('generated.inline.0555_failed_to_invite_users_4ed1a03b'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const inviteGuests = async (userIds: string[], roleIds: string[], senderId?: string) => {
    if (userIds.length === 0 || roleIds.length === 0) {
      return { success: false, error: 'Guests require at least one role and one user' };
    }

    setIsLoading(true);
    try {
      await Promise.all(
        userIds.map(userId =>
          serverConfirmed(
            inviteGuest({
              id: crypto.randomUUID(),
              group_id: groupId,
              user_id: userId,
              status: 'invited',
              role_ids: roleIds,
              invited_by_id: senderId ?? null,
            })
          )
        )
      );

      toast.success(`Successfully invited ${userIds.length} guest(s)`);
      return { success: true };
    } catch (error) {
      console.error('Failed to invite guests:', error);
      toast.error(translateText('generated.inline.0556_failed_to_invite_guests_95c747ba'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const approveGuestAccess = async (guestAccessId: string) => {
    setIsLoading(true);
    try {
      await serverConfirmed(acceptGuestInvitation({ id: guestAccessId }));
      toast.success(translateText('generated.inline.0557_guest_request_approved_4163dbb6'));
      return { success: true };
    } catch (error) {
      console.error('Failed to approve guest access:', error);
      toast.error(translateText('generated.inline.0558_failed_to_approve_guest_access_06fb9a9b'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const revokeGuest = async (guestAccessId: string) => {
    setIsLoading(true);
    try {
      await serverConfirmed(revokeGuestAccess({ id: guestAccessId }));
      toast.success(translateText('generated.inline.0559_guest_access_revoked_3c6108ee'));
      return { success: true };
    } catch (error) {
      console.error('Failed to revoke guest access:', error);
      toast.error(translateText('generated.inline.0560_failed_to_revoke_guest_access_6a0f5bb2'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Approve a membership request
   */
  const approveMembership = async (
    membershipId: string,
    userId: string,
    conversationId?: string,
    senderId?: string,
    senderName?: string,
    groupName?: string
  ) => {
    void userId;
    void conversationId;
    void senderId;
    void senderName;
    void groupName;

    setIsLoading(true);
    try {
      console.info('Client mutation started', {
        flow: 'group-membership-request-approve',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      const result = updateMemberRole({
        id: membershipId,
        status: 'active',
      });

      console.info('Server validation started', {
        flow: 'group-membership-request-approve',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      await serverConfirmed(result);

      console.info('Server successful', {
        flow: 'group-membership-request-approve',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      await logGeneralAssemblyEventSearchResults(membershipId, userId);

      console.info('Client successful', {
        flow: 'group-membership-request-approve',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });
      toast.success(translateText('generated.inline.0561_membership_approved_d02f63d7'));
      return { success: true };
    } catch (error) {
      console.error('Client error', {
        flow: 'group-membership-request-approve',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
        error,
      });
      toast.error(translateText('generated.inline.0562_failed_to_approve_membership_564b6dff'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reject a membership request
   */
  const rejectMembership = async (
    membershipId: string,
    userId: string,
    senderId?: string,
    senderName?: string,
    groupName?: string
  ) => {
    void userId;
    void senderId;
    void senderName;
    void groupName;

    setIsLoading(true);
    try {
      console.info('Client mutation started', {
        flow: 'group-membership-request-reject',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      const result = leaveGroupAction({ id: membershipId });

      console.info('Server validation started', {
        flow: 'group-membership-request-reject',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      await serverConfirmed(result);

      console.info('Server successful', {
        flow: 'group-membership-request-reject',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      console.info('Client successful', {
        flow: 'group-membership-request-reject',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });
      toast.success(translateText('generated.inline.0563_membership_request_rejected_d887e10e'));
      return { success: true };
    } catch (error) {
      console.error('Client error', {
        flow: 'group-membership-request-reject',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
        error,
      });
      toast.error(translateText('generated.inline.0564_failed_to_reject_membership_2c6cfce3'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove a member from the group
   */
  const removeMember = async (
    membershipId: string,
    userId: string,
    conversationId?: string,
    senderId?: string,
    senderName?: string,
    groupName?: string
  ) => {
    void userId;
    void conversationId;
    void senderId;
    void senderName;
    void groupName;

    setIsLoading(true);
    try {
      console.info('Client mutation started', {
        flow: 'group-member-remove',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      const result = leaveGroupAction({ id: membershipId });

      console.info('Server validation started', {
        flow: 'group-member-remove',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      await serverConfirmed(result);

      console.info('Server successful', {
        flow: 'group-member-remove',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });

      console.info('Client successful', {
        flow: 'group-member-remove',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
      });
      toast.success(translateText('generated.inline.0565_member_removed_successfully_cf2f4ee1'));
      return { success: true };
    } catch (error) {
      console.error('Client error', {
        flow: 'group-member-remove',
        membershipId,
        groupId,
        actorUserId: senderId ?? null,
        membershipUserId: userId,
        error,
      });
      toast.error(translateText('generated.inline.0566_failed_to_remove_member_d02ff7dc'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Change a member's role
   */
  const changeMemberRole = async (
    membershipId: string,
    roleId: string,
    userId: string,
    senderId?: string,
    senderName?: string,
    groupName?: string,
    roleName?: string
  ) => {
    return changeMemberRoles(
      membershipId,
      roleId ? [roleId] : [],
      userId,
      senderId,
      senderName,
      groupName,
      roleName
    );
  };

  /**
   * Change a member's roles
   */
  const changeMemberRoles = async (
    membershipId: string,
    roleIds: string[],
    userId: string,
    senderId?: string,
    senderName?: string,
    groupName?: string,
    roleName?: string
  ) => {
    void userId;
    void senderName;
    void groupName;
    void roleName;

    setIsLoading(true);
    try {
      await serverConfirmed(
        syncMembershipRoles({
          group_membership_id: membershipId,
          role_ids: roleIds,
          assigned_by_id: senderId ?? null,
        })
      );

      toast.success(translateText('generated.inline.0567_member_role_updated_4035f1b0'));
      return { success: true };
    } catch (error) {
      console.error('Failed to change member role:', error);
      toast.error(translateText('generated.inline.0568_failed_to_change_member_role_cb8b1462'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a new role
   */
  const createRole = async (
    name: string,
    description: string,
    actionRights: { resource: string; action: string }[],
    senderId?: string,
    groupName?: string,
    adminUserIds?: string[],
    sortOrder = 0
  ) => {
    void senderId;
    void groupName;
    void adminUserIds;

    setIsLoading(true);
    try {
      const roleId = crypto.randomUUID();
      await createRoleAction({
        id: roleId,
        name,
        description,
        scope: 'group',
        group_id: groupId,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: false,
        default_invite_role: false,
        sort_order: sortOrder,
      });

      // Add action rights
      for (const right of actionRights) {
        const actionRightId = crypto.randomUUID();
        await assignActionRight({
          id: actionRightId,
          resource: right.resource,
          action: right.action,
          role_id: roleId,
          group_id: groupId,
          event_id: null,
          amendment_id: null,
          blog_id: null,
        });
      }

      toast.success(translateText('generated.inline.0235_role_created_successfully_150cd5c5'));
      return { success: true, roleId };
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(translateText('generated.inline.0569_failed_to_create_role_6edfd75f'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a role
   */
  const deleteRole = async (
    roleId: string,
    roleName?: string,
    senderId?: string,
    groupName?: string,
    adminUserIds?: string[]
  ) => {
    void roleName;
    void senderId;
    void groupName;
    void adminUserIds;

    setIsLoading(true);
    try {
      await deleteRoleAction({ id: roleId });

      toast.success(translateText('generated.inline.0237_role_deleted_successfully_b714d57c'));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(translateText('generated.inline.0570_failed_to_delete_role_373bd307'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Promote member to admin
   */
  const promoteToAdmin = async (
    membershipId: string,
    userId: string,
    senderId?: string,
    groupName?: string
  ) => {
    void userId;
    void senderId;
    void groupName;

    setIsLoading(true);
    try {
      await updateMemberRole({
        id: membershipId,
        status: 'admin',
      });

      toast.success(translateText('generated.inline.0571_member_promoted_to_admin_fd9ef697'));
      return { success: true };
    } catch (error) {
      console.error('Failed to promote member:', error);
      toast.error(translateText('generated.inline.0572_failed_to_promote_member_0c6fd2cc'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Demote admin to member
   */
  const demoteToMember = async (
    membershipId: string,
    userId?: string,
    senderId?: string,
    groupName?: string
  ) => {
    void userId;
    void senderId;
    void groupName;

    setIsLoading(true);
    try {
      await updateMemberRole({
        id: membershipId,
        status: 'active',
      });

      toast.success(translateText('generated.inline.0573_admin_demoted_to_member_a4381148'));
      return { success: true };
    } catch (error) {
      console.error('Failed to demote admin:', error);
      toast.error(translateText('generated.inline.0574_failed_to_demote_admin_bf838d9d'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    inviteUsers,
    approveMembership,
    rejectMembership,
    removeMember,
    changeMemberRole,
    changeMemberRoles,
    inviteGuests,
    revokeGuest,
    approveGuestAccess,
    createRole,
    deleteRole,
    promoteToAdmin,
    demoteToMember,
    isLoading,
  };
}
