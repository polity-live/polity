/**
 * Hook for role management operations
 */

import { useState } from 'react';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { toast } from 'sonner';
import { roleEditorFormToMutationWithOptions } from '../logic/roleFormHelpers';
import type { RoleEditorFormState } from '../types/group.types';

export function useRoleManagement(
  groupId: string,
  options?: { guestOnlyMembershipFlow?: boolean }
) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    createRole: createRoleAction,
    updateRole: updateRoleAction,
    deleteRole: deleteRoleAction,
    assignActionRight,
    removeActionRight,
  } = useGroupActions();

  const addRole = async (form: RoleEditorFormState, nextSortOrder = 0) => {
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return { success: false };
    }

    setIsLoading(true);
    try {
      const roleId = crypto.randomUUID();
      const roleFields = roleEditorFormToMutationWithOptions(form, {
        allowGuestRequestDefault: Boolean(options?.guestOnlyMembershipFlow),
        allowGuestInviteDefault: Boolean(options?.guestOnlyMembershipFlow),
      });

      await createRoleAction({
        id: roleId,
        name: roleFields.name,
        description: roleFields.description,
        scope: 'group',
        group_id: groupId,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        assignee_kind: roleFields.assignee_kind,
        assignment_mode: roleFields.assignment_mode,
        visibility: roleFields.visibility,
        term_start_date: roleFields.term_start_date,
        is_recurring: roleFields.is_recurring,
        recurrence_pattern: roleFields.recurrence_pattern,
        recurrence_rule: roleFields.recurrence_rule,
        recurrence_interval: roleFields.recurrence_interval,
        recurrence_days: roleFields.recurrence_days,
        recurrence_end_date: roleFields.recurrence_end_date,
        scheduled_revote_date: roleFields.scheduled_revote_date,
        default_request_role: roleFields.default_request_role,
        default_invite_role: roleFields.default_invite_role,
        sort_order: nextSortOrder,
      });

      toast.success('Role created successfully');

      return { success: true, roleId };
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error('Failed to create role. Please try again.');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const updateRole = async (roleId: string, form: RoleEditorFormState) => {
    if (!form.name.trim()) {
      toast.error('Role name is required');
      return { success: false };
    }

    setIsLoading(true);
    try {
      const roleFields = roleEditorFormToMutationWithOptions(form, {
        allowGuestRequestDefault: Boolean(options?.guestOnlyMembershipFlow),
        allowGuestInviteDefault: Boolean(options?.guestOnlyMembershipFlow),
      });

      await updateRoleAction({
        id: roleId,
        name: roleFields.name,
        description: roleFields.description,
        assignee_kind: roleFields.assignee_kind,
        assignment_mode: roleFields.assignment_mode,
        visibility: roleFields.visibility,
        term_start_date: roleFields.term_start_date,
        is_recurring: roleFields.is_recurring,
        recurrence_pattern: roleFields.recurrence_pattern,
        recurrence_rule: roleFields.recurrence_rule,
        recurrence_interval: roleFields.recurrence_interval,
        recurrence_days: roleFields.recurrence_days,
        recurrence_end_date: roleFields.recurrence_end_date,
        scheduled_revote_date: roleFields.scheduled_revote_date,
        default_request_role: roleFields.default_request_role,
        default_invite_role: roleFields.default_invite_role,
      });

      toast.success('Role updated successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role. Please try again.');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const reorderRoles = async (orderedRoleIds: string[]) => {
    setIsLoading(true);
    try {
      for (let i = 0; i < orderedRoleIds.length; i++) {
        await updateRoleAction({ id: orderedRoleIds[i], sort_order: i });
      }
      toast.success('Role order updated');
      return { success: true };
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      toast.error('Failed to update role order.');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const removeRole = async (roleId: string) => {
    setIsLoading(true);
    try {
      await deleteRoleAction({ id: roleId });
      toast.success('Role removed successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to remove role:', error);
      toast.error('Failed to remove role. Please try again.');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActionRight = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHasRight: boolean,
    roleActionRights: readonly { id: string; resource: string | null; action: string | null }[]
  ) => {
    setIsLoading(true);
    try {
      if (currentlyHasRight) {
        // Find and remove the action right
        const actionRightToRemove = roleActionRights.find(
          ar => ar.resource === resource && ar.action === action
        );
        if (actionRightToRemove) {
          await removeActionRight({ id: actionRightToRemove.id });
        }
      } else {
        // Add the action right
        const actionRightId = crypto.randomUUID();
        await assignActionRight({
          id: actionRightId,
          resource,
          action,
          group_id: groupId,
          event_id: null,
          amendment_id: null,
          blog_id: null,
          role_id: roleId,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to toggle action right:', error);
      toast.error('Failed to update permission. Please try again.');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    addRole,
    updateRole,
    removeRole,
    reorderRoles,
    toggleActionRight,
    isLoading,
  };
}
