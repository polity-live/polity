import { useState } from 'react';
import { toast } from 'sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventAccessRoles, useEventRolesData } from '@/zero/events/useEventState';
import { useGroupActions } from '@/zero/groups/useGroupActions';

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
      toast.error('Role title is required');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }

    // Optimistic update: close dialog and show success immediately
    resetForm();
    setAddDialogOpen(false);
    toast.success('Role created successfully');

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
      toast.error('Failed to create role. Please try again.');
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !title.trim()) {
      toast.error('Role title is required');
      return;
    }

    const capacityNum = parseInt(capacity, 10);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }

    // Optimistic update: close dialog and show success immediately
    resetForm();
    setEditingRole(null);
    setEditDialogOpen(false);
    toast.success('Role updated successfully');

    try {
      await updateRole({
        id: editingRole.id,
        name: title.trim(),
        description: description.trim(),
      });
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role. Please try again.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    // Optimistic update: show success immediately
    toast.success('Role deleted successfully');

    try {
      await deleteRole({ id: roleId });
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role. Please try again.');
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
      toast.error('Failed to update permission. Please try again.');
    }
  };

  const handleReorderRoles = async (orderedRoleIds: string[]) => {
    try {
      for (let index = 0; index < orderedRoleIds.length; index++) {
        await updateRole({ id: orderedRoleIds[index], sort_order: index });
      }

      toast.success('Role order updated');
    } catch (error) {
      console.error('Failed to reorder roles:', error);
      toast.error('Failed to update role order.');
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
