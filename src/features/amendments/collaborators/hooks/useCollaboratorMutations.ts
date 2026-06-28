import { useCallback } from 'react';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { AMENDMENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import type { Role } from '../hooks/useCollaborators';

const AMENDMENT_ACTION_RIGHT_KEYS = new Set(
  AMENDMENT_ACTION_RIGHTS.map(right => `${right.resource}:${right.action}`)
);

function assertAmendmentActionRight(resource: string, action: string) {
  if (!AMENDMENT_ACTION_RIGHT_KEYS.has(`${resource}:${action}`)) {
    throw new Error(`Action right ${resource}:${action} is not valid for amendment roles.`);
  }
}

/**
 * Orchestration hook that composes amendment + group action hooks
 * for collaborator management operations.
 *
 * Replaces direct Supabase calls in collaborator-operations.ts.
 * Server mutators handle notifications automatically.
 */
export function useCollaboratorMutations() {
  const { requestCollaboration, leaveCollaboration, updateCollaborator } = useAmendmentActions();

  const {
    createRole: createGroupRole,
    deleteRole: deleteGroupRole,
    assignActionRight,
    removeActionRight,
  } = useGroupActions();

  const inviteUsers = useCallback(
    async (userIds: string[], amendmentId: string, roleId: string) => {
      await Promise.all(
        userIds.map(userId =>
          waitForClientApply(
            requestCollaboration({
              id: crypto.randomUUID(),
              user_id: userId,
              amendment_id: amendmentId,
              role_id: roleId,
              status: 'invited',
              visibility: null,
            })
          )
        )
      );
    },
    [requestCollaboration]
  );

  const changeCollaboratorRole = useCallback(
    async (collaboratorId: string, newRoleId: string) => {
      await waitForClientApply(updateCollaborator({ id: collaboratorId, role_id: newRoleId }));
    },
    [updateCollaborator]
  );

  const changeCollaboratorRoles = useCallback(
    async (collaboratorId: string, roleIds: string[], roles: Role[]) => {
      const nextRoleId = pickPrimaryRoleId(roleIds, roles);
      await waitForClientApply(updateCollaborator({ id: collaboratorId, role_id: nextRoleId }));
    },
    [updateCollaborator]
  );

  const removeCollaborator = useCallback(
    async (collaboratorId: string) => {
      await waitForClientApply(leaveCollaboration(collaboratorId));
    },
    [leaveCollaboration]
  );

  const approveRequest = useCallback(
    async (collaboratorId: string) => {
      await waitForClientApply(updateCollaborator({ id: collaboratorId, status: 'member' }));
    },
    [updateCollaborator]
  );

  const rejectRequest = useCallback(
    async (collaboratorId: string) => {
      await waitForClientApply(leaveCollaboration(collaboratorId));
    },
    [leaveCollaboration]
  );

  const withdrawInvitation = useCallback(
    async (collaboratorId: string) => {
      await waitForClientApply(leaveCollaboration(collaboratorId));
    },
    [leaveCollaboration]
  );

  const promoteToAdmin = useCallback(
    async (collaboratorId: string, roles: Role[]) => {
      const authorRole = roles.find(r => r.name === 'Author');
      if (authorRole) {
        await waitForClientApply(
          updateCollaborator({ id: collaboratorId, role_id: authorRole.id })
        );
      }
    },
    [updateCollaborator]
  );

  const demoteToMember = useCallback(
    async (collaboratorId: string, roles: Role[]) => {
      const collaboratorRole = roles.find(r => r.name === 'Collaborator');
      if (collaboratorRole) {
        await waitForClientApply(
          updateCollaborator({ id: collaboratorId, role_id: collaboratorRole.id })
        );
      }
    },
    [updateCollaborator]
  );

  const createRole = useCallback(
    async (name: string, description: string, amendmentId: string) => {
      await waitForClientApply(
        createGroupRole({
          id: crypto.randomUUID(),
          name,
          description: description || '',
          scope: 'amendment',
          amendment_id: amendmentId,
          group_id: null,
          event_id: null,
          blog_id: null,
          sort_order: 0,
        })
      );
    },
    [createGroupRole]
  );

  const deleteRole = useCallback(
    async (roleId: string) => {
      await waitForClientApply(deleteGroupRole({ id: roleId }));
    },
    [deleteGroupRole]
  );

  const toggleActionRight = useCallback(
    async (
      roleId: string,
      resource: string,
      action: string,
      currentlyHas: boolean,
      roles: Role[],
      amendmentId: string
    ) => {
      if (currentlyHas) {
        const role = roles.find(r => r.id === roleId);
        const ar = role?.action_rights?.find(a => a.resource === resource && a.action === action);
        if (ar) {
          await waitForClientApply(removeActionRight({ id: ar.id }));
        }
      } else {
        assertAmendmentActionRight(resource, action);
        const role = roles.find(r => r.id === roleId);
        await waitForClientApply(
          assignActionRight({
            id: crypto.randomUUID(),
            resource,
            action,
            role_id: roleId,
            amendment_id: role?.scope === 'amendment' ? amendmentId : null,
            group_id: null,
            event_id: null,
            blog_id: null,
          })
        );
      }
    },
    [assignActionRight, removeActionRight]
  );

  return {
    inviteUsers,
    changeCollaboratorRole,
    changeCollaboratorRoles,
    removeCollaborator,
    approveRequest,
    rejectRequest,
    withdrawInvitation,
    promoteToAdmin,
    demoteToMember,
    createRole,
    deleteRole,
    toggleActionRight,
  };
}

function pickPrimaryRoleId(roleIds: string[], roles: Role[]) {
  const uniqueRoleIds = [...new Set(roleIds.filter(Boolean))];
  if (uniqueRoleIds.length === 0) {
    return (
      roles.find(role => role.default_request_role)?.id ||
      roles.find(role => role.name === 'Collaborator')?.id ||
      roles[0]?.id ||
      null
    );
  }

  const roleById = new Map(roles.map(role => [role.id, role]));
  const sortedByPriority = [...uniqueRoleIds].sort((leftId, rightId) => {
    const left = roleById.get(leftId);
    const right = roleById.get(rightId);

    return (
      (right?.sort_order ?? -1) - (left?.sort_order ?? -1) ||
      (left?.name ?? '').localeCompare(right?.name ?? '', undefined, {
        sensitivity: 'base',
      })
    );
  });

  return sortedByPriority[0] ?? null;
}
