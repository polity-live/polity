/**
 * Hook for role management operations
 */

import { useState } from 'react';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { toast } from '@/features/shared/ui/ui/sonner';
import { roleEditorFormToMutationWithOptions } from '../logic/roleFormHelpers';
import type { RoleEditorFormState } from '../types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return { success: false };
    }

    setIsLoading(true);
    try {
      const roleId = crypto.randomUUID();
      const roleFields = roleEditorFormToMutationWithOptions(form, {
        allowGuestRequestDefault: Boolean(options?.guestOnlyMembershipFlow),
        allowGuestInviteDefault: Boolean(options?.guestOnlyMembershipFlow),
      });

      await waitForClientApply(
        createRoleAction({
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
        })
      );

      return { success: true, roleId };
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(
        translateText('generated.inline.0236_failed_to_create_role_please_try_again_7383aeaf')
      );
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const updateRole = async (roleId: string, form: RoleEditorFormState) => {
    if (!form.name.trim()) {
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return { success: false };
    }

    setIsLoading(true);
    try {
      const roleFields = roleEditorFormToMutationWithOptions(form, {
        allowGuestRequestDefault: Boolean(options?.guestOnlyMembershipFlow),
        allowGuestInviteDefault: Boolean(options?.guestOnlyMembershipFlow),
      });

      await waitForClientApply(
        updateRoleAction({
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
        })
      );

      toast.success(translateText('generated.inline.0588_role_updated_successfully_87ea8999'));
      return { success: true };
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error(
        translateText('generated.inline.0589_failed_to_update_role_please_try_again_215d1ee3')
      );
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const reorderRoles = async (orderedRoleIds: string[]) => {
    setIsLoading(true);
    try {
      for (let i = 0; i < orderedRoleIds.length; i++) {
        await waitForClientApply(updateRoleAction({ id: orderedRoleIds[i], sort_order: i }));
      }
      toast.success(translateText('generated.inline.0475_role_order_updated_4d399d91'));
      return { success: true };
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      toast.error(translateText('generated.inline.0590_failed_to_update_role_order_9c527021'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const removeRole = async (roleId: string) => {
    setIsLoading(true);
    try {
      await waitForClientApply(deleteRoleAction({ id: roleId }));
      return { success: true };
    } catch (error) {
      console.error('Failed to remove role:', error);
      toast.error(
        translateText('generated.inline.0464_failed_to_remove_role_please_try_again_68f512d7')
      );
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
          await waitForClientApply(removeActionRight({ id: actionRightToRemove.id }));
        }
      } else {
        // Add the action right
        const actionRightId = crypto.randomUUID();
        await waitForClientApply(
          assignActionRight({
            id: actionRightId,
            resource,
            action,
            group_id: groupId,
            event_id: null,
            amendment_id: null,
            blog_id: null,
            role_id: roleId,
          })
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to toggle action right:', error);
      toast.error(
        translateText('generated.inline.0465_failed_to_update_permission_please_try_again_c9f90034')
      );
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
