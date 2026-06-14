import { useState } from 'react';
import { toast } from 'sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventAccessRoles, useEventRolesData } from '@/zero/events/useEventState';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function useEventRoles(eventId: string) {
  const { createRole, updateRole, deleteRole } = useEventActions();
  const { assignActionRight, removeActionRight } = useGroupActions();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<(typeof roles)[number] | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [createElection, setCreateElection] = useState(false);

  // Query event and roles
  const { event, roles, isLoading } = useEventRolesData(eventId);
  const { roles: accessRoles } = useEventAccessRoles(eventId);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCapacity('1');
    setCreateElection(false);
  };

  const handleAddRole = async () => {
    if (!title.trim()) {
      toast.error(translateText('generated.inline.1023_role_title_is_required_887ec72a'));
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast.error(translateText('generated.inline.1024_capacity_must_be_at_least_1_5849bcc5'));
      return;
    }

    // Optimistic update: close dialog and show success immediately
    resetForm();
    setAddDialogOpen(false);
    toast.success(translateText('generated.inline.0235_role_created_successfully_150cd5c5'));

    try {
      const roleId = crypto.randomUUID();
      const roleTitle = title.trim();

      await createRole({
        id: roleId,
        name: roleTitle,
        description: description.trim(),
        event_id: eventId,
        assignment_mode: 'assigned',
        visibility: 'public',
        is_recurring: false,
        sort_order: roles.length,
      });
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(
        translateText('generated.inline.0236_failed_to_create_role_please_try_again_7383aeaf')
      );
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !title.trim()) {
      toast.error(translateText('generated.inline.1023_role_title_is_required_887ec72a'));
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast.error(translateText('generated.inline.1024_capacity_must_be_at_least_1_5849bcc5'));
      return;
    }

    // Optimistic update: close dialog and show success immediately
    resetForm();
    setEditingRole(null);
    setEditDialogOpen(false);
    toast.success(translateText('generated.inline.0588_role_updated_successfully_87ea8999'));

    try {
      await updateRole({
        id: editingRole.id,
        name: title.trim(),
        description: description.trim(),
      });
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error(
        translateText('generated.inline.0589_failed_to_update_role_please_try_again_215d1ee3')
      );
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    // Optimistic update: show success immediately
    toast.success(translateText('generated.inline.0237_role_deleted_successfully_b714d57c'));

    try {
      await deleteRole({ id: roleId });
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(
        translateText('generated.inline.0238_failed_to_delete_role_please_try_again_fe4624de')
      );
    }
  };

  const handleTogglePermission = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHasRight: boolean
  ) => {
    try {
      if (currentlyHasRight) {
        const role = accessRoles.find(candidateRole => candidateRole.id === roleId);
        const actionRightToRemove = role?.action_rights?.find(
          candidateRight => candidateRight.resource === resource && candidateRight.action === action
        );

        if (actionRightToRemove?.id) {
          await removeActionRight({ id: actionRightToRemove.id });
        }
      } else {
        await assignActionRight({
          id: crypto.randomUUID(),
          resource,
          action,
          role_id: roleId,
          group_id: null,
          event_id: eventId,
          amendment_id: null,
          blog_id: null,
        });
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      toast.error(
        translateText('generated.inline.0465_failed_to_update_permission_please_try_again_c9f90034')
      );
    }
  };

  const handleReorderRoles = async (orderedRoleIds: string[]) => {
    try {
      for (let index = 0; index < orderedRoleIds.length; index++) {
        await updateRole({ id: orderedRoleIds[index], sort_order: index });
      }

      toast.success(translateText('generated.inline.0475_role_order_updated_4d399d91'));
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      toast.error(translateText('generated.inline.0590_failed_to_update_role_order_9c527021'));
    }
  };

  const openEditDialog = (role: (typeof roles)[number]) => {
    setEditingRole(role);
    setTitle(role.title || '');
    setDescription(role.description || '');
    setCapacity('1');
    setCreateElection(false);
    setEditDialogOpen(true);
  };

  return {
    event,
    roles,
    accessRoles,
    isLoading,
    dialogs: {
      add: { open: addDialogOpen, setOpen: setAddDialogOpen },
      edit: { open: editDialogOpen, setOpen: setEditDialogOpen },
    },
    form: {
      title,
      setTitle,
      description,
      setDescription,
      capacity,
      setCapacity,
      createElection,
      setCreateElection,
      reset: resetForm,
    },
    actions: {
      add: handleAddRole,
      edit: handleEditRole,
      delete: handleDeleteRole,
      openEdit: openEditDialog,
      togglePermission: handleTogglePermission,
      reorderRoles: handleReorderRoles,
    },
  };
}
