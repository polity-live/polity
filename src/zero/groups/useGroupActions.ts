import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import { DEFAULT_GROUP_ROLES } from '../rbac/constants';
import { handleMutationError } from '../rbac/handleMutationError';

/**
 * Action hook for group mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useGroupActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── CRUD ───────────────────────────────────────────────────────────
  const createGroup = useCallback(
    (args: Parameters<typeof mutators.groups.create>[0]) => {
      const result = zero.mutate(mutators.groups.create(args));
      toast.success(t('features.groups.toasts.created'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.createFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const updateGroup = useCallback(
    (args: Parameters<typeof mutators.groups.update>[0]) => {
      const result = zero.mutate(mutators.groups.update(args));
      toast.success(t('features.groups.toasts.updated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.updateFailed'), t)
      );
    },
    [zero]
  );

  const deleteGroup = useCallback(
    (args: Parameters<typeof mutators.groups.delete>[0]) => {
      const result = zero.mutate(mutators.groups.delete(args));
      toast.success(t('features.groups.toasts.deleted'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.deleteFailed'), t)
      );
    },
    [zero]
  );

  // ── Membership ─────────────────────────────────────────────────────
  const joinGroup = useCallback(
    (args: Parameters<typeof mutators.groups.joinGroup>[0]) => {
      const result = zero.mutate(mutators.groups.joinGroup(args));
      toast.success(t('features.groups.toasts.joined'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.joinFailed'), t)
      );
    },
    [zero]
  );

  const leaveGroup = useCallback(
    (args: Parameters<typeof mutators.groups.leaveGroup>[0]) => {
      const result = zero.mutate(mutators.groups.leaveGroup(args));
      toast.success(t('features.groups.toasts.left'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.leaveFailed'), t)
      );
    },
    [zero]
  );

  const inviteMember = useCallback(
    (args: Parameters<typeof mutators.groups.inviteMember>[0]) => {
      const result = zero.mutate(mutators.groups.inviteMember(args));
      toast.success(t('features.groups.toasts.invitationSent'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.inviteFailed'), t)
      );
    },
    [zero]
  );

  const acceptInvitation = useCallback(
    (args: Parameters<typeof mutators.groups.acceptInvitation>[0]) => {
      const result = zero.mutate(mutators.groups.acceptInvitation(args));
      toast.success(t('features.groups.toasts.invitationAccepted'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.acceptInvitationFailed'), t)
      );
    },
    [zero]
  );

  const updateMemberRole = useCallback(
    (args: Parameters<typeof mutators.groups.updateMemberRole>[0]) => {
      const result = zero.mutate(mutators.groups.updateMemberRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.memberRoleUpdateFailed'), t)
      );
    },
    [zero]
  );

  const addMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.addMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.addMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.memberRoleUpdateFailed'), t)
      );
    },
    [zero]
  );

  const removeMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.removeMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.removeMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.memberRoleUpdateFailed'), t)
      );
    },
    [zero]
  );

  const syncMembershipRoles = useCallback(
    (args: Parameters<typeof mutators.groups.syncMembershipRoles>[0]) => {
      const result = zero.mutate(mutators.groups.syncMembershipRoles(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.memberRoleUpdateFailed'), t)
      );
    },
    [zero]
  );

  // ── Roles ──────────────────────────────────────────────────────────
  const createRole = useCallback(
    (args: Parameters<typeof mutators.groups.createRole>[0]) => {
      const result = zero.mutate(mutators.groups.createRole(args));
      toast.success(t('features.groups.toasts.roleCreated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.roleCreateFailed'), t)
      );
    },
    [zero]
  );

  const deleteRole = useCallback(
    (args: Parameters<typeof mutators.groups.deleteRole>[0]) => {
      const result = zero.mutate(mutators.groups.deleteRole(args));
      toast.success(t('features.groups.toasts.roleDeleted'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.roleDeleteFailed'), t)
      );
    },
    [zero]
  );

  const updateRole = useCallback(
    (args: Parameters<typeof mutators.groups.updateRole>[0]) => {
      const result = zero.mutate(mutators.groups.updateRole(args));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.roleUpdateFailed'), t)
      );
    },
    [zero]
  );

  const assignActionRight = useCallback(
    (args: Parameters<typeof mutators.groups.assignActionRight>[0]) => {
      const result = zero.mutate(mutators.groups.assignActionRight(args));
      toast.success(t('features.groups.toasts.actionRightAssigned'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.actionRightAssignFailed'), t)
      );
    },
    [zero]
  );

  const removeActionRight = useCallback(
    (args: Parameters<typeof mutators.groups.removeActionRight>[0]) => {
      const result = zero.mutate(mutators.groups.removeActionRight(args));
      toast.success(t('features.groups.toasts.actionRightRemoved'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.actionRightRemoveFailed'), t)
      );
    },
    [zero]
  );

  // ── Admin setup (silent batch — no individual toasts) ────────────
  const setupGroupAdminRoles = useCallback(
    (groupId: string) => {
      let adminRoleId: string | null = null;
      const totalRoles = DEFAULT_GROUP_ROLES.length;
      for (let i = 0; i < totalRoles; i++) {
        const roleDef = DEFAULT_GROUP_ROLES[i];
        const roleId = crypto.randomUUID();
        if (roleDef.name === 'Admin') adminRoleId = roleId;
        // Reverse the index so the last default role (Member) gets sort_order 0 (least rights)
        // and first (Admin) gets the highest sort_order (most rights)
        const sortOrder = totalRoles - 1 - i;
        const roleResult = zero.mutate(
          mutators.groups.createRole({
            id: roleId,
            name: roleDef.name,
            description: roleDef.description,
            scope: 'group',
            group_id: groupId,
            event_id: null,
            amendment_id: null,
            blog_id: null,
            sort_order: sortOrder,
          })
        );
        onServerError(roleResult, msg => console.error('Failed to create role:', msg));
        for (const perm of roleDef.permissions) {
          const permResult = zero.mutate(
            mutators.groups.assignActionRight({
              id: crypto.randomUUID(),
              resource: perm.resource,
              action: perm.action,
              role_id: roleId,
              group_id: groupId,
              event_id: null,
              amendment_id: null,
              blog_id: null,
            })
          );
          onServerError(permResult, msg => console.error('Failed to assign action right:', msg));
        }
      }
      if (adminRoleId) {
        const membershipId = crypto.randomUUID();
        const joinResult = zero.mutate(
          mutators.groups.joinGroup({
            id: membershipId,
            group_id: groupId,
            status: 'active',
            visibility: 'public',
          })
        );
        onServerError(joinResult, msg => console.error('Failed to join group as admin:', msg));

        const syncResult = zero.mutate(
          mutators.groups.syncMembershipRoles({
            group_membership_id: membershipId,
            role_ids: [adminRoleId],
            assigned_by_id: null,
          })
        );
        onServerError(syncResult, msg =>
          console.error('Failed to assign admin role to creator membership:', msg)
        );
      }
    },
    [zero]
  );

  // ── Relationships ──────────────────────────────────────────────────
  const createRelationship = useCallback(
    (args: Parameters<typeof mutators.groups.createRelationship>[0]) => {
      const result = zero.mutate(mutators.groups.createRelationship(args));
      toast.success(t('features.groups.toasts.relationshipCreated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.relationshipCreateFailed'), t)
      );
    },
    [zero]
  );

  const updateRelationship = useCallback(
    (args: Parameters<typeof mutators.groups.updateRelationship>[0]) => {
      const result = zero.mutate(mutators.groups.updateRelationship(args));
      toast.success(t('features.groups.toasts.relationshipUpdated'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.relationshipUpdateFailed'), t)
      );
    },
    [zero]
  );

  const deleteRelationship = useCallback(
    (args: Parameters<typeof mutators.groups.deleteRelationship>[0]) => {
      const result = zero.mutate(mutators.groups.deleteRelationship(args));
      toast.success(t('features.groups.toasts.relationshipDeleted'));
      onServerError(result, msg =>
        handleMutationError(new Error(msg), t('features.groups.toasts.relationshipDeleteFailed'), t)
      );
    },
    [zero]
  );

  const createRoleHolderHistory = useCallback(
    (args: Parameters<typeof mutators.groups.createRoleHolderHistory>[0]) => {
      const result = zero.mutate(mutators.groups.createRoleHolderHistory(args));
      toast.success(t('features.groups.toasts.roleHolderHistoryCreated'));
      onServerError(result, msg =>
        handleMutationError(
          new Error(msg),
          t('features.groups.toasts.roleHolderHistoryCreateFailed'),
          t
        )
      );
    },
    [zero]
  );

  const updateRoleHolderHistory = useCallback(
    (args: Parameters<typeof mutators.groups.updateRoleHolderHistory>[0]) => {
      const result = zero.mutate(mutators.groups.updateRoleHolderHistory(args));
      toast.success(t('features.groups.toasts.roleHolderHistoryUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          new Error(msg),
          t('features.groups.toasts.roleHolderHistoryUpdateFailed'),
          t
        )
      );
    },
    [zero]
  );

  return {
    // CRUD
    createGroup,
    updateGroup,
    deleteGroup,

    // Membership
    joinGroup,
    leaveGroup,
    inviteMember,
    acceptInvitation,
    updateMemberRole,
    addMembershipRole,
    removeMembershipRole,
    syncMembershipRoles,

    // Roles
    createRole,
    updateRole,
    deleteRole,
    assignActionRight,
    removeActionRight,
    setupGroupAdminRoles,

    // Relationships
    createRelationship,
    updateRelationship,
    deleteRelationship,

    createRoleHolderHistory,
    updateRoleHolderHistory,
  };
}
