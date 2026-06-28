import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, toMutationError } from '../mutate-with-server-check';
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
        handleMutationError(toMutationError(msg), t('features.groups.toasts.createFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const createFullGroup = useCallback(
    (args: Parameters<typeof mutators.groups.createFull>[0]) => {
      const result = zero.mutate(mutators.groups.createFull(args));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.createFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const updateGroup = useCallback(
    (
      args: Parameters<typeof mutators.groups.update>[0],
      options?: {
        silent?: boolean;
      }
    ) => {
      const result = zero.mutate(mutators.groups.update(args));
      if (!options?.silent) {
        toast.success(t('features.groups.toasts.updated'));
      }
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.updateFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const deleteGroup = useCallback(
    (args: Parameters<typeof mutators.groups.delete>[0]) => {
      const result = zero.mutate(mutators.groups.delete(args));
      toast.success(t('features.groups.toasts.deleted'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.deleteFailed'), t)
      );
    },
    [zero]
  );

  const createOfflineMember = useCallback(
    (args: Parameters<typeof mutators.groups.createOfflineMember>[0]) => {
      const result = zero.mutate(mutators.groups.createOfflineMember(args));
      toast.success(translateText('generated.inline.1280_offline_member_added_53457a7c'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to add offline member', t)
      );
      return result;
    },
    [zero]
  );

  const updateOfflineMember = useCallback(
    (args: Parameters<typeof mutators.groups.updateOfflineMember>[0]) => {
      const result = zero.mutate(mutators.groups.updateOfflineMember(args));
      toast.success(translateText('generated.inline.1281_offline_member_updated_67288e4f'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to update offline member', t)
      );
      return result;
    },
    [zero]
  );

  const deleteOfflineMember = useCallback(
    (args: Parameters<typeof mutators.groups.deleteOfflineMember>[0]) => {
      const result = zero.mutate(mutators.groups.deleteOfflineMember(args));
      toast.success(translateText('generated.inline.1282_offline_member_removed_868d862f'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to remove offline member', t)
      );
      return result;
    },
    [zero]
  );

  const importOfflineMembers = useCallback(
    (args: Parameters<typeof mutators.groups.importOfflineMembers>[0]) => {
      const result = zero.mutate(mutators.groups.importOfflineMembers(args));
      toast.success(translateText('generated.inline.1283_offline_members_imported_d757a0cf'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to import offline members', t)
      );
      return result;
    },
    [zero]
  );

  // ── Membership ─────────────────────────────────────────────────────
  const joinGroup = useCallback(
    (args: Parameters<typeof mutators.groups.joinGroup>[0]) => {
      const result = zero.mutate(mutators.groups.joinGroup(args));
      toast.success(t('features.groups.toasts.joined'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.joinFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const requestGuestAccess = useCallback(
    (args: Parameters<typeof mutators.groups.requestGuestAccess>[0]) => {
      const result = zero.mutate(mutators.groups.requestGuestAccess(args));
      toast.success(t('features.auth.success.membershipRequestSent'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.joinFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const leaveGroup = useCallback(
    (args: Parameters<typeof mutators.groups.leaveGroup>[0]) => {
      const result = zero.mutate(mutators.groups.leaveGroup(args));
      toast.success(t('features.groups.toasts.left'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.leaveFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const inviteMember = useCallback(
    (args: Parameters<typeof mutators.groups.inviteMember>[0]) => {
      const result = zero.mutate(mutators.groups.inviteMember(args));
      toast.success(t('features.groups.toasts.invitationSent'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.inviteFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const acceptInvitation = useCallback(
    (args: Parameters<typeof mutators.groups.acceptInvitation>[0]) => {
      const result = zero.mutate(mutators.groups.acceptInvitation(args));
      toast.success(t('features.groups.toasts.invitationAccepted'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.acceptInvitationFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const inviteGuest = useCallback(
    (args: Parameters<typeof mutators.groups.inviteGuest>[0]) => {
      const result = zero.mutate(mutators.groups.inviteGuest(args));
      toast.success(translateText('generated.inline.1284_guest_invitation_sent_dd6015e7'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to invite guest', t)
      );
      return result;
    },
    [zero]
  );

  const acceptGuestInvitation = useCallback(
    (args: Parameters<typeof mutators.groups.acceptGuestInvitation>[0]) => {
      const result = zero.mutate(mutators.groups.acceptGuestInvitation(args));
      toast.success(translateText('generated.inline.1285_guest_invitation_accepted_28e5e390'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to accept guest invitation', t)
      );
      return result;
    },
    [zero]
  );

  const revokeGuestAccess = useCallback(
    (args: Parameters<typeof mutators.groups.revokeGuestAccess>[0]) => {
      const result = zero.mutate(mutators.groups.revokeGuestAccess(args));
      toast.success(translateText('generated.inline.0559_guest_access_revoked_3c6108ee'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to revoke guest access', t)
      );
      return result;
    },
    [zero]
  );

  const syncGuestRoles = useCallback(
    (args: Parameters<typeof mutators.groups.syncGuestRoles>[0]) => {
      const result = zero.mutate(mutators.groups.syncGuestRoles(args));
      toast.success(translateText('generated.inline.1286_guest_roles_updated_a2e608e8'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), 'Failed to update guest roles', t)
      );
      return result;
    },
    [zero]
  );

  const updateMembership = useCallback(
    (args: Parameters<typeof mutators.groups.updateMembership>[0]) => {
      const result = zero.mutate(mutators.groups.updateMembership(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const addMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.addMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.addMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const removeMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.removeMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.removeMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const syncMembershipRoles = useCallback(
    (args: Parameters<typeof mutators.groups.syncMembershipRoles>[0]) => {
      const result = zero.mutate(mutators.groups.syncMembershipRoles(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const addOfflineMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.addOfflineMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.addOfflineMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const removeOfflineMembershipRole = useCallback(
    (args: Parameters<typeof mutators.groups.removeOfflineMembershipRole>[0]) => {
      const result = zero.mutate(mutators.groups.removeOfflineMembershipRole(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const syncOfflineMembershipRoles = useCallback(
    (args: Parameters<typeof mutators.groups.syncOfflineMembershipRoles>[0]) => {
      const result = zero.mutate(mutators.groups.syncOfflineMembershipRoles(args));
      toast.success(t('features.groups.toasts.memberRoleUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.memberRoleUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  // ── Roles ──────────────────────────────────────────────────────────
  const createRole = useCallback(
    (args: Parameters<typeof mutators.groups.createRole>[0]) => {
      const result = zero.mutate(mutators.groups.createRole(args));
      toast.success(t('features.groups.toasts.roleCreated'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.roleCreateFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const deleteRole = useCallback(
    (args: Parameters<typeof mutators.groups.deleteRole>[0]) => {
      const result = zero.mutate(mutators.groups.deleteRole(args));
      toast.success(t('features.groups.toasts.roleDeleted'));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.roleDeleteFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const updateRole = useCallback(
    (args: Parameters<typeof mutators.groups.updateRole>[0]) => {
      const result = zero.mutate(mutators.groups.updateRole(args));
      onServerError(result, msg =>
        handleMutationError(toMutationError(msg), t('features.groups.toasts.roleUpdateFailed'), t)
      );
      return result;
    },
    [zero]
  );

  const assignActionRight = useCallback(
    (args: Parameters<typeof mutators.groups.assignActionRight>[0]) => {
      const result = zero.mutate(mutators.groups.assignActionRight(args));
      toast.success(t('features.groups.toasts.actionRightAssigned'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.actionRightAssignFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const removeActionRight = useCallback(
    (args: Parameters<typeof mutators.groups.removeActionRight>[0]) => {
      const result = zero.mutate(mutators.groups.removeActionRight(args));
      toast.success(t('features.groups.toasts.actionRightRemoved'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.actionRightRemoveFailed'),
          t
        )
      );
      return result;
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

  const createRoleHolderHistory = useCallback(
    (args: Parameters<typeof mutators.groups.createRoleHolderHistory>[0]) => {
      const result = zero.mutate(mutators.groups.createRoleHolderHistory(args));
      toast.success(t('features.groups.toasts.roleHolderHistoryCreated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.roleHolderHistoryCreateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  const updateRoleHolderHistory = useCallback(
    (args: Parameters<typeof mutators.groups.updateRoleHolderHistory>[0]) => {
      const result = zero.mutate(mutators.groups.updateRoleHolderHistory(args));
      toast.success(t('features.groups.toasts.roleHolderHistoryUpdated'));
      onServerError(result, msg =>
        handleMutationError(
          toMutationError(msg),
          t('features.groups.toasts.roleHolderHistoryUpdateFailed'),
          t
        )
      );
      return result;
    },
    [zero]
  );

  return {
    // CRUD
    createGroup,
    createFullGroup,
    updateGroup,
    deleteGroup,
    createOfflineMember,
    updateOfflineMember,
    deleteOfflineMember,
    importOfflineMembers,

    // Membership
    joinGroup,
    requestGuestAccess,
    leaveGroup,
    inviteMember,
    acceptInvitation,
    inviteGuest,
    acceptGuestInvitation,
    revokeGuestAccess,
    updateMembership,
    addMembershipRole,
    removeMembershipRole,
    syncMembershipRoles,
    addOfflineMembershipRole,
    removeOfflineMembershipRole,
    syncOfflineMembershipRoles,
    syncGuestRoles,

    // Roles
    createRole,
    updateRole,
    deleteRole,
    assignActionRight,
    removeActionRight,
    setupGroupAdminRoles,

    createRoleHolderHistory,
    updateRoleHolderHistory,
  };
}
