import { useState } from 'react';
import { toast } from 'sonner';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventRolesData } from '@/zero/events/useEventState';

export function useEventRoles(eventId: string) {
  const { createRole, updateRole, deleteRole } = useEventActions();

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
        title: roleTitle,
        description: description.trim(),
        event_id: eventId,
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
        title: title.trim(),
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
    },
  };
}
