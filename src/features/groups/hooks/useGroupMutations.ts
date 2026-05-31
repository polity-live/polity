import { useState } from 'react';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';

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

      for (const userId of userIds) {
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
      }
      toast.success(`Successfully invited ${userIds.length} user(s)`);
      return { success: true };
    } catch (error) {
      console.error('Failed to invite users:', error);
      toast.error('Failed to invite users');
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
      for (const userId of userIds) {
        await serverConfirmed(
          inviteGuest({
            id: crypto.randomUUID(),
            group_id: groupId,
            user_id: userId,
            status: 'invited',
            role_ids: roleIds,
            invited_by_id: senderId ?? null,
          })
        );
      }

      toast.success(`Successfully invited ${userIds.length} guest(s)`);
      return { success: true };
    } catch (error) {
      console.error('Failed to invite guests:', error);
      toast.error('Failed to invite guests');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const revokeGuest = async (guestAccessId: string) => {
    setIsLoading(true);
    try {
      await serverConfirmed(revokeGuestAccess({ id: guestAccessId }));
      toast.success('Guest access revoked');
      return { success: true };
    } catch (error) {
      console.error('Failed to revoke guest access:', error);
      toast.error('Failed to revoke guest access');
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
      toast.success('Membership approved');
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
      toast.error('Failed to approve membership');
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
      toast.success('Membership request rejected');
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
      toast.error('Failed to reject membership');
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
      toast.success('Member removed successfully');
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
      toast.error('Failed to remove member');
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

      toast.success('Member role updated');
      return { success: true };
    } catch (error) {
      console.error('Failed to change member role:', error);
      toast.error('Failed to change member role');
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

      toast.success('Role created successfully');
      return { success: true, roleId };
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error('Failed to create role');
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

      toast.success('Role deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role');
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

      toast.success('Member promoted to admin');
      return { success: true };
    } catch (error) {
      console.error('Failed to promote member:', error);
      toast.error('Failed to promote member');
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

      toast.success('Admin demoted to member');
      return { success: true };
    } catch (error) {
      console.error('Failed to demote admin:', error);
      toast.error('Failed to demote admin');
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
    createRole,
    deleteRole,
    promoteToAdmin,
    demoteToMember,
    isLoading,
  };
}
