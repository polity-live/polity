/**
 * Hook for managing group roles
 * Handles CRUD operations, holder management, history tracking, and election creation
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';

export function useGroupRoles(groupId: string) {
  const { roles: rolesData, isLoading } = useFacadeGroupRoles(groupId);
  const {
    createRole: createRoleAction,
    updateRole: updateRoleAction,
    deleteRole: deleteRoleAction,
    createRoleHolderHistory: createHistoryAction,
    updateRoleHolderHistory: updateHistoryAction,
  } = useGroupActions();
  const { createElection: createElectionAction } = useElectionActions();
  const { createAgendaItem: createAgendaItemAction } = useAgendaActions();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignHolderDialogOpen, setAssignHolderDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number] | null>(null);
  const [editingRole, setEditingRole] = useState<(typeof roles)[number] | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [term, setTerm] = useState('4');
  const [firstTermStart, setFirstTermStart] = useState('');
  const [createElection, setCreateElection] = useState(false);

  // Query roles with all relationships
  const roles = rolesData || [];

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTerm('4');
    setFirstTermStart('');
    setCreateElection(false);
  };

  const createRoleRecord = async () => {
    if (!title.trim()) {
      toast.error('Role title is required');
      return { success: false };
    }

    const termNum = parseInt(term, 10);
    if (isNaN(termNum) || termNum < 1) {
      toast.error('Term must be at least 1 year');
      return { success: false };
    }

    if (!firstTermStart) {
      toast.error('First term start date is required');
      return { success: false };
    }

    const roleTitle = title.trim();
    const hasRecurringTerm = termNum > 0;
    resetForm();
    setAddDialogOpen(false);
    toast.success('Role created successfully');

    try {
      const roleId = crypto.randomUUID();

      await createRoleAction({
        id: roleId,
        name: roleTitle,
        description: description.trim() || '',
        scope: 'group',
        group_id: groupId,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        assignment_mode: createElection ? 'elected' : 'assigned',
        visibility: 'public',
        term_start_date: new Date(firstTermStart).getTime(),
        is_recurring: hasRecurringTerm,
        recurrence_pattern: hasRecurringTerm ? 'yearly' : null,
        recurrence_rule: hasRecurringTerm ? `FREQ=YEARLY;INTERVAL=${termNum}` : null,
        recurrence_interval: hasRecurringTerm ? termNum : null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        sort_order: roles.length,
      });

      // If createElection is true, create election + agenda item
      if (createElection) {
        const electionId = crypto.randomUUID();
        const agendaItemId = crypto.randomUUID();

        await createElectionAction({
          id: electionId,
          title: `Election for ${roleTitle}`,
          description: `Vote for the ${roleTitle} role`,
          majority_type: 'simple',
          status: 'pending',
          visibility: 'public',
          max_votes: 1,
          role_id: roleId,
          agenda_item_id: agendaItemId,
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
        });

        await createAgendaItemAction({
          id: agendaItemId,
          title: `Election: ${roleTitle}`,
          description: '',
          type: 'election',
          status: 'pending',
          forwarding_status: '',
          order_index: 0,
          duration: 0,
          scheduled_time: '',
          start_time: 0,
          end_time: 0,
          activated_at: 0,
          completed_at: 0,
          event_id: null,
          amendment_id: null,
          majority_type: null,
          time_limit: null,
          voting_phase: null,
        });
      }

      return { success: true, roleId };
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error('Failed to create role. Please try again.');
      return { success: false, error };
    }
  };

  const updateRoleRecord = async () => {
    if (!editingRole || !title.trim()) {
      toast.error('Role title is required');
      return { success: false };
    }

    const termNum = parseInt(term, 10);
    if (isNaN(termNum) || termNum < 1) {
      toast.error('Term must be at least 1 year');
      return { success: false };
    }

    if (!firstTermStart) {
      toast.error('First term start date is required');
      return { success: false };
    }

    const hasRecurringTerm = termNum > 0;
    resetForm();
    setEditingRole(null);
    setEditDialogOpen(false);
    toast.success('Role updated successfully');

    try {
      await updateRoleAction({
        id: editingRole.id,
        name: title.trim(),
        description: description.trim() || '',
        term_start_date: new Date(firstTermStart).getTime(),
        is_recurring: hasRecurringTerm,
        recurrence_pattern: hasRecurringTerm ? 'yearly' : null,
        recurrence_rule: hasRecurringTerm ? `FREQ=YEARLY;INTERVAL=${termNum}` : null,
        recurrence_interval: hasRecurringTerm ? termNum : null,
        recurrence_days: null,
        recurrence_end_date: null,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role. Please try again.');
      return { success: false, error };
    }
  };

  const deleteRoleRecord = async (roleId: string) => {
    toast.success('Role deleted successfully');

    try {
      await deleteRoleAction({ id: roleId });

      return { success: true };
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Assign a holder to a role
   * Creates history entry for the new holder and ends the previous holder's entry
   */
  const assignHolder = async (
    roleId: string,
    userId: string,
    reason: 'elected' | 'appointed' = 'appointed'
  ) => {
    toast.success('Holder assigned successfully');

    try {
      const now = Date.now();
      const role = roles.find(candidateRole => candidateRole.id === roleId);

      // If there's a current holder, end their history entry
      // End the current active history entry (if exists)
      const currentHistoryEntry = role?.holder_history?.find(h => !h.end_date);
      if (currentHistoryEntry) {
        await updateHistoryAction({
          id: currentHistoryEntry.id,
          end_date: now,
        });
      }

      // Create new history entry for the new holder
      const historyId = crypto.randomUUID();
      await createHistoryAction({
        id: historyId,
        start_date: now,
        reason: reason,
        role_id: roleId,
        user_id: userId,
        end_date: null,
      });

      // Update position current holder
      // Note: current_holder_id is tracked via holder_history (active entry = no end_date)

      return { success: true };
    } catch (error) {
      console.error('Failed to assign holder:', error);
      toast.error('Failed to assign holder. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Remove the current holder from a role
   */
  const removeHolder = async (
    roleId: string,
    reason: 'resigned' | 'removed' | 'term_ended' = 'removed'
  ) => {
    try {
      const now = Date.now();
      const role = roles.find(candidateRole => candidateRole.id === roleId);

      // End the current holder's history entry
      // End the current active history entry
      const currentHistoryEntry = role?.holder_history?.find(h => !h.end_date);
      if (!currentHistoryEntry) {
        toast.error(
          'This assignee comes from an active member role. Change it from the members tab.'
        );
        return { success: false };
      }

      toast.success('Holder removed successfully');

      if (currentHistoryEntry) {
        await updateHistoryAction({
          id: currentHistoryEntry.id,
          end_date: now,
          reason: reason,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to remove holder:', error);
      toast.error('Failed to remove holder. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Create an election for a role (e.g., when term is ending)
   */
  const createElectionForRole = async (roleId: string, eventId?: string) => {
    try {
      const role = roles.find(candidateRole => candidateRole.id === roleId);
      if (!role) {
        toast.error('Role not found');
        return { success: false };
      }

      const electionId = crypto.randomUUID();
      const agendaItemId = crypto.randomUUID();

      await createElectionAction({
        id: electionId,
        title: `Election for ${role.title}`,
        description: `Vote for the ${role.title} role`,
        majority_type: 'simple',
        status: 'pending',
        visibility: 'public',
        max_votes: 1,
        role_id: roleId,
        agenda_item_id: agendaItemId,
        closing_type: null,
        closing_duration_seconds: null,
        closing_end_time: null,
      });

      await createAgendaItemAction({
        id: agendaItemId,
        title: `Election: ${role.title}`,
        description: '',
        type: 'election',
        status: 'pending',
        forwarding_status: '',
        order_index: 0,
        duration: 0,
        scheduled_time: '',
        start_time: 0,
        end_time: 0,
        activated_at: 0,
        completed_at: 0,
        event_id: eventId || null,
        amendment_id: null,
        majority_type: null,
        time_limit: null,
        voting_phase: null,
      });

      toast.success('Election created successfully');
      return { success: true, electionId };
    } catch (error) {
      console.error('Failed to create election:', error);
      toast.error('Failed to create election. Please try again.');
      return { success: false, error };
    }
  };

  /**
   * Open edit dialog with role data
   */
  const openEditDialog = (role: (typeof roles)[number]) => {
    setEditingRole(role);
    setTitle(role.title || '');
    setDescription(role.description || '');
    setTerm(String(role.term || 4));
    setFirstTermStart(
      role.first_term_start ? new Date(role.first_term_start).toISOString().split('T')[0] : ''
    );
    setEditDialogOpen(true);
  };

  /**
   * Open assign holder dialog
   */
  const openAssignHolderDialog = (role: (typeof roles)[number]) => {
    setSelectedRole(role);
    setAssignHolderDialogOpen(true);
  };

  /**
   * Open history dialog
   */
  const openHistoryDialog = (role: (typeof roles)[number]) => {
    setSelectedRole(role);
    setHistoryDialogOpen(true);
  };

  return {
    roles,
    isLoading,
    dialogs: {
      add: { open: addDialogOpen, setOpen: setAddDialogOpen },
      edit: { open: editDialogOpen, setOpen: setEditDialogOpen },
      assignHolder: { open: assignHolderDialogOpen, setOpen: setAssignHolderDialogOpen },
      history: { open: historyDialogOpen, setOpen: setHistoryDialogOpen },
    },
    form: {
      title,
      setTitle,
      description,
      setDescription,
      term,
      setTerm,
      firstTermStart,
      setFirstTermStart,
      createElection,
      setCreateElection,
      reset: resetForm,
    },
    selectedRole,
    editingRole,
    actions: {
      create: createRoleRecord,
      update: updateRoleRecord,
      delete: deleteRoleRecord,
      assignHolder,
      removeHolder,
      createElection: createElectionForRole,
      openEdit: openEditDialog,
      openAssignHolder: openAssignHolderDialog,
      openHistory: openHistoryDialog,
    },
  };
}
