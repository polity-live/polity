import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useUserState } from '@/zero/users';
import { useEventAccessRoles } from '@/zero/events/useEventState';
import { useAuth } from '@/providers/auth-provider';
import { useEventData } from './useEventData';
import { useEventMutations } from './useEventMutations';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// Define available action rights for events
export const ACTION_RIGHTS = [
  {
    resource: 'events',
    action: 'view',
    label: translateText('generated.inline.0094_view_event_9ea3a72c'),
  },
  {
    resource: 'events',
    action: 'update',
    label: translateText('generated.inline.0095_update_event_a2295718'),
  },
  {
    resource: 'events',
    action: 'delete',
    label: translateText('generated.inline.0096_delete_event_d45effe5'),
  },
  {
    resource: 'events',
    action: 'manage',
    label: translateText('generated.inline.0097_manage_event_643f3eef'),
  },
  {
    resource: 'events',
    action: 'manage_participants',
    label: translateText('generated.inline.0098_manage_participants_16e85d0e'),
  },
  {
    resource: 'events',
    action: 'manage_speakers',
    label: translateText('generated.inline.0099_manage_speakers_7c299ed7'),
  },
  {
    resource: 'events',
    action: 'manage_votes',
    label: translateText('generated.inline.0100_manage_votes_48682559'),
  },
  {
    resource: 'events',
    action: 'speak',
    label: translateText('generated.inline.0101_speak_in_events_47b45d28'),
  },
  {
    resource: 'events',
    action: 'active_voting',
    label: translateText('generated.inline.0102_active_voting_rights_c85cd127'),
  },
  {
    resource: 'events',
    action: 'passive_voting',
    label: translateText('generated.inline.0103_passive_voting_rights_can_be_candidate_c6e8a741'),
  },
  {
    resource: 'agendaItems',
    action: 'view',
    label: translateText('generated.inline.0104_view_agenda_items_aa984b00'),
  },
  {
    resource: 'agendaItems',
    action: 'create',
    label: translateText('generated.inline.0105_create_agenda_items_89252d81'),
  },
  {
    resource: 'agendaItems',
    action: 'update',
    label: translateText('generated.inline.0106_update_agenda_items_88802540'),
  },
  {
    resource: 'agendaItems',
    action: 'delete',
    label: translateText('generated.inline.0107_delete_agenda_items_b774cfce'),
  },
  {
    resource: 'agendaItems',
    action: 'manage',
    label: translateText('generated.inline.0108_manage_agenda_38983d6b'),
  },
  {
    resource: 'notifications',
    action: 'manageNotifications',
    label: translateText('generated.inline.0040_manage_notifications_32133a0a'),
  },
];

export function useEventParticipants(eventId: string) {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [activeTab, setActiveTab] = useState('participants');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);

  // Query event and participants using hook
  const { event, participants, isLoading, error } = useEventData(eventId);

  const { createRole, deleteRole, assignActionRight, removeActionRight } = useGroupActions();

  // Query all users for user search
  const { allUsers: usersData, isLoading: isLoadingUsers } = useUserState({
    includeAllUsers: true,
  });

  // Check if current user is admin
  const { user } = useAuth();
  const currentUserId = user?.id;

  // Query event-scoped roles separately (event has no 'roles' relationship)
  const { roles: eventRoles } = useEventAccessRoles(eventId);
  const rolesData = { roles: eventRoles };
  const organizerRole = eventRoles.find(role => role.name === 'Organizer');
  const participantRole = eventRoles.find(role => role.name === 'Participant');

  // Get existing participant IDs to exclude from invite search
  const existingParticipantIds = participants.map(p => p.user?.id).filter(Boolean) as string[];

  // Filter users for invite search
  const filteredUsers = usersData.filter(user => {
    if (!user?.id) return false;
    if (existingParticipantIds.includes(user.id)) return false;

    const query = inviteSearchQuery.toLowerCase();
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return (
      fullName.toLowerCase().includes(query) ||
      user.handle?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Initialize event mutations hook
  const {
    inviteParticipants,
    removeParticipant,
    changeParticipantRole,
    changeParticipantRoles,
    approveParticipation,
  } = useEventMutations(eventId);

  const handleInviteUsers = async () => {
    if (selectedUsers.length === 0) return;

    setIsInviting(true);
    try {
      await inviteParticipants(selectedUsers, undefined, currentUserId, event?.title ?? undefined);

      // Reset state
      setSelectedUsers([]);
      setInviteSearchQuery('');
      setInviteDialogOpen(false);
    } catch (error) {
      console.error('Failed to invite participants:', error);
    } finally {
      setIsInviting(false);
    }
  };

  // Handle removing participant
  const handleRemoveParticipant = async (participantId: string, userId?: string) => {
    try {
      await removeParticipant(participantId, userId, currentUserId, event?.title ?? undefined);
    } catch (err) {
      console.error('Error removing participant:', err);
    }
  };

  // Handle changing participant role
  const handleChangeRole = async (participantId: string, newRoleId: string) => {
    if (!newRoleId) return;

    try {
      await changeParticipantRole(participantId, newRoleId);
    } catch (err) {
      console.error('Error changing role:', err);
    }
  };

  const handleToggleRole = async (
    participantId: string,
    roleId: string,
    shouldHaveRole: boolean,
    currentRoleIds: string[]
  ) => {
    const nextRoleIds = shouldHaveRole
      ? [...new Set([...currentRoleIds, roleId])]
      : currentRoleIds.filter(currentRoleId => currentRoleId !== roleId);

    try {
      await changeParticipantRoles(participantId, nextRoleIds);
    } catch (err) {
      console.error('Error toggling role:', err);
    }
  };

  // Handle accepting request
  const handleAcceptRequest = async (participantId: string, userId?: string) => {
    try {
      await approveParticipation(participantId, userId, currentUserId, event?.title ?? undefined);
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  // Role management handlers
  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      toast.error(translateText('generated.inline.0234_role_name_is_required_6193b4dd'));
      return;
    }

    try {
      const roleId = crypto.randomUUID();
      await createRole({
        id: roleId,
        name: newRoleName,
        description: newRoleDescription,
        scope: 'event',
        sort_order: 0,
        event_id: eventId,
        group_id: null,
        amendment_id: null,
        blog_id: null,
      });

      toast.success(translateText('generated.inline.0235_role_created_successfully_150cd5c5'));

      setNewRoleName('');
      setNewRoleDescription('');
      setAddRoleDialogOpen(false);
    } catch (error) {
      console.error('Failed to create role:', error);
      toast.error(
        translateText('generated.inline.0236_failed_to_create_role_please_try_again_7383aeaf')
      );
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    try {
      await deleteRole({ id: roleId });
      toast.success(translateText('generated.inline.0463_role_removed_successfully_2812ce44'));
    } catch (error) {
      console.error('Failed to remove role:', error);
      toast.error(
        translateText('generated.inline.0464_failed_to_remove_role_please_try_again_68f512d7')
      );
    }
  };

  const handleToggleActionRight = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHasRight: boolean
  ) => {
    try {
      if (currentlyHasRight) {
        const role = rolesData?.roles?.find(r => r.id === roleId);
        const actionRightToRemove = role?.action_rights?.find(
          ar => ar.resource === resource && ar.action === action
        );
        if (actionRightToRemove) {
          await removeActionRight({ id: actionRightToRemove.id });
        }
      } else {
        const actionRightId = crypto.randomUUID();
        await assignActionRight({
          id: actionRightId,
          resource,
          action,
          role_id: roleId,
          event_id: eventId,
          group_id: null,
          amendment_id: null,
          blog_id: null,
        });
      }
    } catch (error) {
      console.error('Failed to toggle action right:', error);
      toast.error(
        translateText('generated.inline.0465_failed_to_update_permission_please_try_again_c9f90034')
      );
    }
  };

  // Filter participants based on search query
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;

    const query = searchQuery.toLowerCase();
    return participants.filter(participant => {
      const userName = `${participant.user?.first_name ?? ''} ${participant.user?.last_name ?? ''}`
        .trim()
        .toLowerCase();
      const userEmail = participant.user?.email?.toLowerCase() || '';
      const userHandle = participant.user?.handle?.toLowerCase() || '';
      const status = participant.status?.toLowerCase() || '';
      return (
        userName.includes(query) ||
        userEmail.includes(query) ||
        userHandle.includes(query) ||
        status.includes(query)
      );
    });
  }, [participants, searchQuery]);

  const pendingRequests = useMemo(
    () => filteredParticipants.filter(p => p.status === 'requested'),
    [filteredParticipants]
  );
  const activeParticipants = useMemo(
    () =>
      filteredParticipants.filter(
        p =>
          p.status === 'active' ||
          p.status === 'member' ||
          p.status === 'confirmed' ||
          p.status === 'admin' ||
          p.role?.name === 'Organizer' ||
          p.roles?.some(role => role.name === 'Organizer')
      ),
    [filteredParticipants]
  );
  const invitedUsers = useMemo(
    () => filteredParticipants.filter(p => p.status === 'invited'),
    [filteredParticipants]
  );

  return {
    event,
    participants,
    isLoading,
    error,
    currentUserId,
    rolesData,
    organizerRole,
    participantRole,
    filteredUsers,
    isLoadingUsers,

    state: {
      searchQuery,
      setSearchQuery,
      inviteSearchQuery,
      setInviteSearchQuery,
      selectedUsers,
      setSelectedUsers,
      inviteDialogOpen,
      setInviteDialogOpen,
      isInviting,
      activeTab,
      setActiveTab,
      newRoleName,
      setNewRoleName,
      newRoleDescription,
      setNewRoleDescription,
      addRoleDialogOpen,
      setAddRoleDialogOpen,
    },

    derived: {
      pendingRequests,
      activeParticipants,
      invitedUsers,
    },

    actions: {
      toggleUserSelection,
      inviteUsers: handleInviteUsers,
      removeParticipant: handleRemoveParticipant,
      changeRole: handleChangeRole,
      toggleRole: handleToggleRole,
      acceptRequest: handleAcceptRequest,
      addRole: handleAddRole,
      removeRole: handleRemoveRole,
      toggleActionRight: handleToggleActionRight,
      goBack: () => navigate({ to: '..' }),
    },
  };
}
