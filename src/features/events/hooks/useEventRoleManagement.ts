import { useMemo, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useEventActions } from '@/zero/events/useEventActions';
import { useEventAccessRoles, useEventRolesData } from '@/zero/events/useEventState';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import {
  emptyRoleEditorForm,
  roleEditorFormToMutationWithOptions,
  roleToEditorForm,
} from '@/features/groups/logic/roleFormHelpers';
import type { RoleEditorFormState } from '@/features/groups/types/group.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

function isAssemblyEventType(eventType: string | null | undefined) {
  return eventType === 'general_assembly' || eventType === 'delegate_assembly';
}

export function useEventRoleManagement(eventId: string) {
  const { event, roles, isLoading } = useEventRolesData(eventId);
  const { roles: accessRoles } = useEventAccessRoles(eventId);
  const { createRole, updateRole, deleteRole } = useEventActions();
  const { assignActionRight, removeActionRight } = useGroupActions();
  const { createElection } = useElectionActions();
  const { createAgendaItem } = useAgendaActions();

  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<RoleEditorFormState>(emptyRoleEditorForm());
  const [editRoleForm, setEditRoleForm] = useState<RoleEditorFormState>(emptyRoleEditorForm());
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const rolesWithRights = useMemo(() => {
    const rightsByRoleId = new Map(accessRoles.map(role => [role.id, role.action_rights ?? []]));
    return roles.map(role => ({
      ...role,
      action_rights: rightsByRoleId.get(role.id) ?? role.action_rights ?? [],
    }));
  }, [accessRoles, roles]);

  const editingRole =
    rolesWithRights.find(role => role.id === editingRoleId) ??
    accessRoles.find(role => role.id === editingRoleId) ??
    null;

  const allowGuestRequestDefault = isAssemblyEventType(event?.event_type);
  const allowGuestInviteDefault = allowGuestRequestDefault;

  const buildRoleMutation = (form: RoleEditorFormState) =>
    roleEditorFormToMutationWithOptions(form, {
      allowGuestRequestDefault,
      allowGuestInviteDefault,
      includeRecurringFields: false,
    });

  const addRole = async () => {
    if (!event) {
      toast.error(translateText('generated.inline.0474_event_not_found_231b810d'));
      return;
    }

    if (!newRoleForm.name.trim()) {
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return;
    }

    const roleFields = buildRoleMutation(newRoleForm);
    await createRole({
      id: crypto.randomUUID(),
      name: roleFields.name,
      description: roleFields.description,
      scope: 'event',
      group_id: null,
      event_id: eventId,
      amendment_id: null,
      blog_id: null,
      assignee_kind: roleFields.assignee_kind,
      assignment_mode: roleFields.assignment_mode,
      visibility: roleFields.visibility,
      term_start_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
      scheduled_revote_date: null,
      default_request_role: roleFields.default_request_role,
      default_invite_role: roleFields.default_invite_role,
      sort_order: rolesWithRights.length,
    });

    setNewRoleForm(emptyRoleEditorForm());
    setAddRoleOpen(false);
  };

  const openEditRole = (role: (typeof rolesWithRights)[number]) => {
    setEditingRoleId(role.id);
    setEditRoleForm(roleToEditorForm(role));
    setEditRoleOpen(true);
  };

  const saveEditedRole = async () => {
    if (!editingRoleId) return;
    if (!editRoleForm.name.trim()) {
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return;
    }

    const roleFields = buildRoleMutation(editRoleForm);
    await updateRole({
      id: editingRoleId,
      name: roleFields.name,
      description: roleFields.description,
      assignee_kind: roleFields.assignee_kind,
      assignment_mode: roleFields.assignment_mode,
      visibility: roleFields.visibility,
      term_start_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_rule: null,
      recurrence_interval: null,
      recurrence_days: null,
      recurrence_end_date: null,
      scheduled_revote_date: null,
      default_request_role: roleFields.default_request_role,
      default_invite_role: roleFields.default_invite_role,
    });

    setEditRoleOpen(false);
    setEditingRoleId(null);
  };

  const togglePermission = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHasRight: boolean
  ) => {
    const role = accessRoles.find(candidateRole => candidateRole.id === roleId);

    if (currentlyHasRight) {
      const existingRight = role?.action_rights?.find(
        candidateRight => candidateRight.resource === resource && candidateRight.action === action
      );

      if (existingRight?.id) {
        await removeActionRight({ id: existingRight.id });
      }
      return;
    }

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
  };

  const reorderRoles = async (orderedRoleIds: string[]) => {
    for (let index = 0; index < orderedRoleIds.length; index++) {
      await updateRole({ id: orderedRoleIds[index], sort_order: index });
    }
    toast.success(translateText('generated.inline.0475_role_order_updated_4d399d91'));
  };

  const createElectionForRole = async (roleId: string) => {
    const role = rolesWithRights.find(candidateRole => candidateRole.id === roleId);
    if (!role) {
      toast.error(translateText('generated.inline.0476_role_not_found_70623637'));
      return;
    }

    const agendaItemId = crypto.randomUUID();
    const electionId = crypto.randomUUID();

    await createAgendaItem({
      id: agendaItemId,
      title: translateText('generated.inline.0109_election_value6a1b_d06db811', {
        value6a1b: role.title || role.name || translateText('features.events.agenda.role'),
      }),
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
      event_id: eventId,
      amendment_id: null,
      majority_type: null,
      time_limit: null,
      voting_phase: null,
    });

    await createElection({
      id: electionId,
      title: translateText('generated.inline.0110_election_for_value6a1b_f7382ef9', {
        value6a1b: role.title || role.name || translateText('features.events.agenda.role'),
      }),
      description: translateText('generated.inline.0111_vote_for_the_value8446_1262ec2b', {
        value8446: role.title || role.name || translateText('features.events.agenda.roleLowercase'),
      }),
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
  };

  const getPermissionDisabledReason = (
    role: (typeof accessRoles)[number],
    resource: string,
    action: string
  ) => {
    if (
      role.assignee_kind === 'guest' &&
      resource === 'events' &&
      (action === 'active_voting' || action === 'passive_voting')
    ) {
      return translateText('features.events.roles.guestVotingRightsDisabled');
    }

    return null;
  };

  return {
    event,
    roles: rolesWithRights,
    accessRoles,
    isLoading,
    addRoleOpen,
    setAddRoleOpen,
    newRoleForm,
    setNewRoleForm,
    editRoleOpen,
    setEditRoleOpen,
    editRoleForm,
    setEditRoleForm,
    editingRole,
    addRole,
    openEditRole,
    saveEditedRole,
    removeRole: deleteRole,
    togglePermission,
    reorderRoles,
    createElectionForRole,
    getPermissionDisabledReason,
  };
}
