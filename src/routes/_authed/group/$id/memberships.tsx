import { useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@rocicorp/zero/react';
import { useTranslation } from 'react-i18next';
import { MembershipTabs } from '@/features/groups/ui/MembershipTabs';
import { ActiveMembersTable } from '@/features/groups/ui/ActiveMembersTable';
import { MembershipsByRoleTables } from '@/features/groups/ui/MembershipsByRoleTables';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
import { OpenAssignmentsPanel } from '@/features/groups/ui/OpenAssignmentsPanel';
import { PendingRequestsTable } from '@/features/groups/ui/PendingRequestsTable';
import { PendingInvitationsTable } from '@/features/groups/ui/PendingInvitationsTable';
import { InviteMembersDialog } from '@/features/groups/ui/InviteMembersDialog';
import { GuestsTable } from '@/features/groups/ui/GuestsTable';
import { ChangeRoleDialog } from '@/features/groups/ui/ChangeRoleDialog';
import { MemberRightsDialog } from '@/features/groups/ui/MemberRightsDialog';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { RoleDetailsTable } from '@/features/groups/ui/RoleDetailsTable';
import { AddRoleDialog } from '@/features/groups/ui/AddRoleDialog';
import { AssignHolderDialog } from '@/features/groups/ui/AssignHolderDialog';
import {
  OfflineRosterCard,
  type OfflineRosterCandidateUser,
  type OfflineRosterGroupReference,
  type OfflineRosterRow,
} from '@/features/offline-roster/ui/OfflineRosterCard';
import { RoleHolderHistoryDialog } from '@/features/roles/ui/RoleHolderHistoryDialog';
import {
  useGroupMemberships,
  useGroupGuestAccesses,
  useGroupAccessRoles,
  useGroupData,
} from '@/features/groups/hooks/useGroupData';
import { useMembershipActivationPreflight } from '@/features/groups/hooks/useMembershipActivationPreflight';
import { useGroupMutations } from '@/features/groups/hooks/useGroupMutations';
import { useGroupMembershipComposition } from '@/features/groups/hooks/useGroupMembershipComposition';
import { useGroupOpenAssignments } from '@/features/groups/hooks/useGroupOpenAssignments';
import { useMembershipSearch } from '@/features/groups/hooks/useMembershipSearch';
import { useRoleManagement } from '@/features/groups/hooks/useRoleManagement';
import { useGroupRoles } from '@/features/roles/hooks/useGroupRoles';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';
import { emptyRoleEditorForm, roleToEditorForm } from '@/features/groups/logic/roleFormHelpers';
import { getMembershipDisplayRoles } from '@/features/groups/logic/buildMembershipRightsSummary';
import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';
import { resolveOfflineRosterProvenance } from '@/features/groups/logic/offlineRosterProvenance';
import type { MembershipCompositionGroupLike } from '@/features/groups/logic/membershipComposition';
import { queries } from '@/zero/queries';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useGroupOfflineMembershipsByGroupIds, useGroupState } from '@/zero/groups/useGroupState';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type {
  ParticipationProvenanceGroupLike,
  ParticipationRoleLike,
  ParticipationUserLike,
} from '@/features/shared/types/participation';
import type {
  GroupMembershipWithUser,
  GroupRole,
  MembershipSort,
  MembershipSortField,
  MembershipTab,
} from '@/features/groups/types/group.types';
import type { GroupOfflineMembershipWithRolesAndRightsByGroupIdsRow } from '@/zero/groups/queries';

export const Route = createFileRoute('/_authed/group/$id/memberships')({
  component: GroupMembershipsPage,
});

type EffectiveOfflineMembership = GroupOfflineMembershipWithRolesAndRightsByGroupIdsRow & {
  membershipKind: 'offline';
  user_id: string;
  user: ParticipationUserLike;
  roles: ParticipationRoleLike[];
  role: ParticipationRoleLike | null;
  partGroup?: ParticipationProvenanceGroupLike | null;
  baseGroup?: ParticipationProvenanceGroupLike | null;
};

type MembershipParticipant = GroupMembershipWithUser | EffectiveOfflineMembership;

function isOfflineMembershipParticipant(
  membership: MembershipParticipant | null | undefined
): membership is EffectiveOfflineMembership {
  return Boolean(
    membership && 'membershipKind' in membership && membership.membershipKind === 'offline'
  );
}

type GroupReferenceWithType = OfflineRosterGroupReference & { group_type?: string | null };
interface GroupReferenceLike {
  id?: string | null;
  name?: string | null;
  group_type?: string | null;
  connected_group_id?: string | null;
  sibling_membership_mode?: string | null;
}

function toMembershipCompositionGroup(
  groupRef: GroupReferenceLike | null | undefined
): MembershipCompositionGroupLike | null {
  if (!groupRef?.id) {
    return null;
  }

  return {
    id: groupRef.id,
    name: groupRef.name ?? groupRef.id,
    group_type: groupRef.group_type ?? null,
    connected_group_id: groupRef.connected_group_id ?? null,
    sibling_membership_mode: groupRef.sibling_membership_mode ?? null,
  };
}

function toOfflineRosterGroupReference(
  groupRef: GroupReferenceLike | null | undefined
): GroupReferenceWithType | null {
  if (!groupRef?.id) {
    return null;
  }

  return {
    id: groupRef.id,
    name: groupRef.name ?? groupRef.id,
    group_type: groupRef.group_type ?? null,
  };
}

function GroupMembershipsPage() {
  const { id: groupId } = Route.useParams();
  const { can, isMember, isLoading } = usePermissions({ groupId });
  const canManageMembers = can('manage', 'groupMemberships');
  const canManageAssignments =
    can('manage', 'events') || can('manage', 'elections') || can('manage', 'agendaItems');

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!isMember() || (!canManageMembers && !canManageAssignments)) {
    return <AccessDenied />;
  }

  return (
    <GroupMembershipsContent
      groupId={groupId}
      canManageMembers={canManageMembers}
      canManageAssignments={canManageAssignments}
    />
  );
}

function GroupMembershipsContent({
  groupId,
  canManageMembers,
  canManageAssignments,
}: {
  groupId: string;
  canManageMembers: boolean;
  canManageAssignments: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { group } = useGroupData(groupId);
  const { allRelationshipsWithGroups } = useGroupState({ includeAllRelationshipsWithGroups: true });
  const compositionGroup = useMemo(() => toMembershipCompositionGroup(group), [group]);
  const hierarchyRelationships = useMemo(
    () => allRelationshipsWithGroups as Parameters<typeof resolveChildBaseGroups>[1],
    [allRelationshipsWithGroups]
  );
  const groupName = group?.name || 'Group';

  const [activeTab, setActiveTab] = useState<MembershipTab>(
    canManageMembers ? 'membershipsByUser' : 'openAssignments'
  );
  const [membershipSort, setMembershipSort] = useState<MembershipSort>({
    field: 'user',
    direction: 'asc',
  });

  const { activeMemberships, invitedMemberships, requestedMemberships } =
    useGroupMemberships(groupId);
  const { activeGuestAccesses, requestedGuestAccesses, invitedGuestAccesses } =
    useGroupGuestAccesses(groupId);
  const {
    showComposition,
    membershipsWithProvenance,
    compositionBuckets,
    isLoading: compositionIsLoading,
  } = useGroupMembershipComposition(
    compositionGroup,
    activeMemberships as GroupMembershipWithUser[]
  );
  const {
    openAssignments,
    availableEvents,
    isLoading: assignmentsAreLoading,
    isScheduling: assignmentsAreScheduling,
    scheduleDelegateElection,
    scheduleRoleRenewal,
    scheduleProcessTask,
  } = useGroupOpenAssignments(groupId);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const searchableMemberships = [
    ...membershipsWithProvenance,
    ...requestedMemberships,
    ...invitedMemberships,
  ] as GroupMembershipWithUser[];
  const { activeMembers, pendingRequests, pendingInvitations } = useMembershipSearch(
    searchableMemberships,
    memberSearchQuery,
    membershipSort
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedInviteRoleIds, setSelectedInviteRoleIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [selectedGuestUserIds, setSelectedGuestUserIds] = useState<string[]>([]);
  const [selectedGuestRoleIds, setSelectedGuestRoleIds] = useState<string[]>([]);
  const [isInvitingGuests, setIsInvitingGuests] = useState(false);

  const existingMemberIds = Array.from(
    new Set(
      [...activeMemberships, ...requestedMemberships, ...invitedMemberships]
        .map(membership => membership.user?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const {
    inviteUsers,
    inviteGuests,
    approveGuestAccess,
    revokeGuest,
    approveMembership,
    rejectMembership,
    removeMember,
    changeMemberRoles,
  } = useGroupMutations(groupId);
  const {
    createOfflineMember,
    updateOfflineMember,
    deleteOfflineMember,
    importOfflineMembers,
    syncOfflineMembershipRoles,
  } = useGroupActions();

  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleMembership, setChangeRoleMembership] = useState<MembershipParticipant | null>(
    null
  );
  const [memberRightsOpen, setMemberRightsOpen] = useState(false);
  const [memberRightsMembership, setMemberRightsMembership] =
    useState<MembershipParticipant | null>(null);

  const handleOpenChangeRoleDialog = (membership: MembershipParticipant) => {
    setChangeRoleMembership(membership);
    setChangeRoleOpen(true);
  };

  const handleConfirmRoleChange = async (newRoleIds: string[]) => {
    if (!changeRoleMembership) return;

    if (isOfflineMembershipParticipant(changeRoleMembership)) {
      await serverConfirmed(
        syncOfflineMembershipRoles({
          group_offline_membership_id: changeRoleMembership.id,
          role_ids: newRoleIds,
          assigned_by_id: authUser?.id ?? null,
        })
      );
      return;
    }

    const userId = changeRoleMembership.user?.id;
    if (!userId) return;

    await changeMemberRoles(
      changeRoleMembership.id,
      newRoleIds,
      userId,
      authUser?.id ?? undefined,
      undefined,
      groupName
    );
  };

  const handleOpenMemberRights = (membership: MembershipParticipant) => {
    setMemberRightsMembership(membership);
    setMemberRightsOpen(true);
  };

  const handleMembershipSortChange = (field: MembershipSortField) => {
    setMembershipSort(currentSort => {
      if (currentSort.field === field) {
        return {
          field,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        field,
        direction: 'asc',
      };
    });
  };

  const handleInvite = async () => {
    if (selectedUserIds.length === 0 || inviteMembershipPreflight.blocking) return;

    setIsInviting(true);
    try {
      await inviteUsers(selectedUserIds, selectedInviteRoleIds, authUser?.id ?? undefined);
      setSelectedUserIds([]);
      setSelectedInviteRoleIds([]);
      setInviteOpen(false);
    } finally {
      setIsInviting(false);
    }
  };

  const handleInviteGuests = async () => {
    if (selectedGuestUserIds.length === 0 || selectedGuestRoleIds.length === 0) return;

    setIsInvitingGuests(true);
    try {
      await inviteGuests(selectedGuestUserIds, selectedGuestRoleIds, authUser?.id ?? undefined);
      setSelectedGuestUserIds([]);
      setSelectedGuestRoleIds([]);
      setInviteOpen(false);
    } finally {
      setIsInvitingGuests(false);
    }
  };

  const { roles: accessRoles } = useGroupAccessRoles(groupId);
  const guestRoles = accessRoles.filter(role => role.assignee_kind === 'guest');
  const memberRoles = accessRoles.filter(role => role.assignee_kind !== 'guest');
  const guestOnlyMembershipFlow =
    group?.group_type === 'sibling' &&
    ['all_members', 'role_members', 'selected_source_groups'].includes(
      group.primary_sibling_membership_mode ?? ''
    );
  const { addRole, updateRole, reorderRoles, toggleActionRight } = useRoleManagement(groupId, {
    guestOnlyMembershipFlow,
  });
  const inviteMembershipPreflight = useMembershipActivationPreflight(groupId, selectedUserIds, {
    enabled:
      inviteOpen &&
      !guestOnlyMembershipFlow &&
      activeTab !== 'guests' &&
      selectedUserIds.length > 0,
  });
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState(emptyRoleEditorForm());
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<GroupRole | null>(null);
  const [editRoleForm, setEditRoleForm] = useState(emptyRoleEditorForm());

  const handleAddRole = async () => {
    const result = await addRole(newRoleForm, accessRoles.length);
    if (!result.success) return;

    setNewRoleForm(emptyRoleEditorForm());
    setAddRoleOpen(false);
  };

  const handleTogglePermission = async (
    roleId: string,
    resource: string,
    action: string,
    currentlyHas: boolean
  ) => {
    const role = accessRoles.find(candidateRole => candidateRole.id === roleId);
    await toggleActionRight(roleId, resource, action, currentlyHas, [
      ...(role?.action_rights || []),
    ]);
  };

  const handleOpenEditRole = (roleRow: { id: string }) => {
    const role = accessRoles.find(candidateRole => candidateRole.id === roleRow.id);
    if (!role) return;

    setEditingRole(role);
    setEditRoleForm(roleToEditorForm(role));
    setEditRoleOpen(true);
  };

  const handleSaveEditedRole = async () => {
    if (!editingRole) return;

    const result = await updateRole(editingRole.id, editRoleForm);
    if (!result.success) return;

    setEditRoleOpen(false);
    setEditingRole(null);
  };

  const handleRemoveRoleFromMembershipTypeView = async (
    membership: MembershipParticipant,
    roleId: string
  ) => {
    const nextRoleIds = getMembershipDisplayRoles(membership)
      .filter(role => role.id !== roleId)
      .map(role => role.id);

    if (isOfflineMembershipParticipant(membership)) {
      await serverConfirmed(
        syncOfflineMembershipRoles({
          group_offline_membership_id: membership.id,
          role_ids: nextRoleIds,
          assigned_by_id: authUser?.id ?? null,
        })
      );
      return;
    }

    const userId = membership.user?.id;
    if (!userId) return;

    await changeMemberRoles(
      membership.id,
      nextRoleIds,
      userId,
      authUser?.id ?? undefined,
      undefined,
      groupName
    );
  };

  const groupRoleHook = useGroupRoles(groupId);

  const compositionGroupIds = useMemo(() => {
    if (!compositionGroup) {
      return [groupId];
    }

    if (
      compositionGroup.group_type !== 'hierarchical' &&
      compositionGroup.group_type !== 'sibling'
    ) {
      return [groupId];
    }

    const groupsById = new Map<
      string,
      { id: string; group_type?: string | null; name?: string | null }
    >();
    for (const relationship of allRelationshipsWithGroups) {
      if (relationship.group?.id) {
        groupsById.set(relationship.group.id, relationship.group);
      }
      if (relationship.related_group?.id) {
        groupsById.set(relationship.related_group.id, relationship.related_group);
      }
    }
    groupsById.set(compositionGroup.id, compositionGroup);

    if (compositionGroup.group_type === 'hierarchical') {
      return [
        compositionGroup.id,
        ...resolveChildBaseGroups(compositionGroup.id, hierarchyRelationships, groupsById),
      ];
    }

    const sourceGroupIds =
      compositionGroup.sibling_membership_mode === 'elected'
        ? compositionGroup.connected_group_id
          ? [compositionGroup.connected_group_id]
          : []
        : (group?.sibling_sources || [])
            .map(source => source.source_group?.id || source.source_group_id)
            .filter((candidate): candidate is string => Boolean(candidate));
    const expandedGroupIds = new Set<string>([compositionGroup.id]);

    for (const sourceGroupId of sourceGroupIds) {
      expandedGroupIds.add(sourceGroupId);
      const sourceGroup = groupsById.get(sourceGroupId);
      if (sourceGroup?.group_type === 'hierarchical') {
        for (const baseGroupId of resolveChildBaseGroups(
          sourceGroupId,
          hierarchyRelationships,
          groupsById
        )) {
          expandedGroupIds.add(baseGroupId);
        }
      }
    }

    return [...expandedGroupIds];
  }, [compositionGroup, group, groupId, hierarchyRelationships]);

  const [offlineMembersData] = useQuery(
    compositionGroupIds.length > 0
      ? queries.groups.offlineMembersByGroupIds({ groupIds: compositionGroupIds })
      : undefined
  );
  const { offlineMemberships: offlineMembershipsData } =
    useGroupOfflineMembershipsByGroupIds(compositionGroupIds);

  const groupsById = useMemo(() => {
    const nextMap = new Map<string, OfflineRosterGroupReference & { group_type?: string | null }>();
    const currentGroupRef = toOfflineRosterGroupReference(group);
    if (currentGroupRef) {
      nextMap.set(currentGroupRef.id, currentGroupRef);
    }
    for (const relationship of allRelationshipsWithGroups) {
      const sourceGroupRef = toOfflineRosterGroupReference(relationship.group);
      if (sourceGroupRef) {
        nextMap.set(sourceGroupRef.id, sourceGroupRef);
      }
      const relatedGroupRef = toOfflineRosterGroupReference(relationship.related_group);
      if (relatedGroupRef) {
        nextMap.set(relatedGroupRef.id, relatedGroupRef);
      }
    }
    for (const offlineMember of offlineMembersData || []) {
      const offlineMemberGroupRef = toOfflineRosterGroupReference(offlineMember.group);
      if (offlineMemberGroupRef) {
        nextMap.set(offlineMemberGroupRef.id, offlineMemberGroupRef);
      }
    }
    for (const offlineMembership of offlineMembershipsData || []) {
      const membershipGroupRef = toOfflineRosterGroupReference(offlineMembership.group);
      if (membershipGroupRef) {
        nextMap.set(membershipGroupRef.id, membershipGroupRef);
      }
      const sourceGroupRef = toOfflineRosterGroupReference(offlineMembership.source_group);
      if (sourceGroupRef) {
        nextMap.set(sourceGroupRef.id, sourceGroupRef);
      }
      const offlineMemberGroupRef = toOfflineRosterGroupReference(
        offlineMembership.group_offline_member?.group
      );
      if (offlineMemberGroupRef) {
        nextMap.set(offlineMemberGroupRef.id, offlineMemberGroupRef);
      }
    }
    return nextMap;
  }, [allRelationshipsWithGroups, group, offlineMembersData, offlineMembershipsData]);

  const siblingRootGroupIds = useMemo(() => {
    if (!group || group.group_type !== 'sibling') {
      return [] as string[];
    }

    if (group.sibling_membership_mode === 'elected') {
      return group.connected_group_id ? [group.connected_group_id] : [];
    }

    return (group.sibling_sources || [])
      .map(source => source.source_group?.id || source.source_group_id)
      .filter((candidate): candidate is string => Boolean(candidate));
  }, [group]);

  const offlineProvenanceByMemberId = useMemo(
    () =>
      resolveOfflineRosterProvenance({
        group: compositionGroup,
        offlineMembers: offlineMembersData || [],
        relationships: hierarchyRelationships,
        groupsById,
        siblingRootGroupIds,
      }),
    [compositionGroup, groupsById, hierarchyRelationships, offlineMembersData, siblingRootGroupIds]
  );

  const effectiveOfflineMemberships = useMemo<EffectiveOfflineMembership[]>(() => {
    const searchValue = memberSearchQuery.trim().toLowerCase();

    return (offlineMembershipsData || [])
      .filter(membership => membership.group_id === groupId)
      .filter(membership => {
        if (!searchValue) {
          return true;
        }

        const offlineMember = membership.group_offline_member;
        const haystack = [
          offlineMember?.first_name,
          offlineMember?.last_name,
          offlineMember?.reason_not_signed_up,
          offlineMember?.connected_user?.first_name,
          offlineMember?.connected_user?.last_name,
          offlineMember?.connected_user?.handle,
          ...(membership.roles ?? []).map(role => role.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchValue);
      })
      .map(membership => {
        const offlineMember = membership.group_offline_member;
        const provenance = offlineMember?.id
          ? offlineProvenanceByMemberId.get(offlineMember.id)
          : undefined;

        return {
          ...membership,
          membershipKind: 'offline' as const,
          user_id: `offline:${membership.group_offline_member_id}`,
          user: {
            id: null,
            first_name: offlineMember?.first_name ?? null,
            last_name: offlineMember?.last_name ?? null,
            handle: null,
            avatar: null,
            email: null,
          },
          roles: membership.roles ?? [],
          role: membership.role ?? null,
          partGroup: showComposition ? (provenance?.partGroup ?? null) : null,
          baseGroup: showComposition ? (provenance?.baseGroup ?? null) : null,
        };
      });
  }, [
    groupId,
    memberSearchQuery,
    offlineMembershipsData,
    offlineProvenanceByMemberId,
    showComposition,
  ]);

  const offlineRows = useMemo(() => {
    const searchValue = memberSearchQuery.trim().toLowerCase();
    const effectiveMembershipByOfflineMemberId = new Map(
      effectiveOfflineMemberships.map(membership => [
        membership.group_offline_member_id,
        membership,
      ])
    );

    if (showComposition) {
      return (offlineMembersData || [])
        .filter(offlineMember => {
          if (!searchValue) {
            return true;
          }

          const effectiveMembership = effectiveMembershipByOfflineMemberId.get(offlineMember.id);
          const haystack = [
            offlineMember.first_name,
            offlineMember.last_name,
            offlineMember.reason_not_signed_up,
            offlineMember.connected_user?.first_name,
            offlineMember.connected_user?.last_name,
            offlineMember.connected_user?.handle,
            ...(effectiveMembership?.roles ?? []).map(role => role.name),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(searchValue);
        })
        .map<OfflineRosterRow>(offlineMember => {
          const effectiveMembership = effectiveMembershipByOfflineMemberId.get(offlineMember.id);
          const provenance = offlineProvenanceByMemberId.get(offlineMember.id);

          return {
            id: offlineMember.id,
            kind: 'offline',
            effectiveMembershipId: effectiveMembership?.id ?? null,
            user: null,
            firstName: offlineMember.first_name,
            lastName: offlineMember.last_name,
            isActiveUser: false,
            reasonNotSignedUp: offlineMember.reason_not_signed_up,
            connectedUser: offlineMember.connected_user ?? null,
            partGroup: provenance?.partGroup ?? null,
            baseGroup: provenance?.baseGroup ?? null,
            roles: effectiveMembership?.roles ?? [],
            canViewRights: Boolean(effectiveMembership),
            canManageRoles: canManageMembers && Boolean(effectiveMembership),
            readOnlyIdentity: true,
            canConnect: false,
            canEdit: false,
            canDelete: false,
          };
        });
    }

    return (offlineMembersData || [])
      .filter(offlineMember => offlineMember.group_id === groupId)
      .filter(offlineMember => {
        if (!searchValue) {
          return true;
        }

        const haystack = [
          offlineMember.first_name,
          offlineMember.last_name,
          offlineMember.reason_not_signed_up,
          offlineMember.connected_user?.first_name,
          offlineMember.connected_user?.last_name,
          offlineMember.connected_user?.handle,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchValue);
      })
      .map<OfflineRosterRow>(offlineMember => {
        const effectiveMembership = effectiveMembershipByOfflineMemberId.get(offlineMember.id);
        let partGroup: OfflineRosterGroupReference | null | undefined;
        let baseGroup: OfflineRosterGroupReference | null | undefined;

        return {
          id: offlineMember.id,
          kind: 'offline',
          effectiveMembershipId: effectiveMembership?.id ?? null,
          user: null,
          firstName: offlineMember.first_name,
          lastName: offlineMember.last_name,
          isActiveUser: false,
          reasonNotSignedUp: offlineMember.reason_not_signed_up,
          connectedUser: offlineMember.connected_user ?? null,
          partGroup,
          baseGroup,
          roles: effectiveMembership?.roles ?? [],
          canViewRights: Boolean(effectiveMembership),
          canManageRoles: canManageMembers && Boolean(effectiveMembership),
          readOnlyIdentity: false,
          canConnect: true,
          canEdit: true,
          canDelete: true,
        };
      });
  }, [
    canManageMembers,
    effectiveOfflineMemberships,
    groupId,
    memberSearchQuery,
    offlineMembersData,
    offlineProvenanceByMemberId,
    showComposition,
  ]);

  const allUserRows = useMemo<OfflineRosterRow[]>(() => {
    const activeRows = activeMembers.map(membership => ({
      id: `active:${membership.id}`,
      kind: 'active' as const,
      user: membership.user ?? null,
      firstName: membership.user?.first_name || '',
      lastName: membership.user?.last_name || '',
      isActiveUser: true,
      connectedUser: null,
      reasonNotSignedUp: null,
      roles: getMembershipDisplayRoles(membership),
      partGroup: showComposition ? membership.partGroup || null : null,
      baseGroup: showComposition ? membership.baseGroup || null : null,
    }));

    return [...activeRows, ...offlineRows];
  }, [activeMembers, offlineRows, showComposition]);

  const membershipsByRoleMembers = useMemo<MembershipParticipant[]>(
    () => [...activeMembers, ...effectiveOfflineMemberships],
    [activeMembers, effectiveOfflineMemberships]
  );
  const offlineMembershipsById = useMemo(
    () =>
      new Map(effectiveOfflineMemberships.map(membership => [membership.id, membership] as const)),
    [effectiveOfflineMemberships]
  );

  const offlineConnectedUserIds = useMemo(
    () =>
      new Set(
        (offlineMembersData || [])
          .map(offlineMember => offlineMember.connected_user_id)
          .filter((candidate): candidate is string => Boolean(candidate))
      ),
    [offlineMembersData]
  );

  const connectedUserCandidates = useMemo<OfflineRosterCandidateUser[]>(
    () =>
      activeMemberships.flatMap(membership => {
        const user = membership.user;
        if (!user?.id || offlineConnectedUserIds.has(user.id)) {
          return [];
        }

        return [user as OfflineRosterCandidateUser];
      }),
    [activeMemberships, offlineConnectedUserIds]
  );

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Group Memberships</h1>

      {canManageMembers &&
      activeTab !== 'roles' &&
      activeTab !== 'composition' &&
      activeTab !== 'openAssignments' ? (
        <EntitySearchBar
          searchQuery={memberSearchQuery}
          onSearchQueryChange={setMemberSearchQuery}
          placeholder="Search members..."
          className="mb-4"
        />
      ) : null}

      <MembershipTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabBarAction={
          !canManageMembers ? null : activeTab === 'guests' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={selectedGuestUserIds}
              onSelectedUsersChange={setSelectedGuestUserIds}
              excludeUserIds={[
                ...existingMemberIds,
                ...activeGuestAccesses
                  .map(guestAccess => guestAccess.user?.id)
                  .filter((userId): userId is string => Boolean(userId)),
              ]}
              excludeUserId={authUser?.id}
              roles={[...guestRoles]}
              selectedRoleIds={selectedGuestRoleIds}
              onSelectedRoleIdsChange={setSelectedGuestRoleIds}
              onInvite={handleInviteGuests}
              isInviting={isInvitingGuests}
              triggerLabel="Invite Guest"
              dialogTitle="Invite Guests"
              dialogDescription="Invite users as guests with guest roles. Guests get access rights but are not official members."
              roleSectionDescription="Guest invitations must always include at least one guest role."
              emptyRolesLabel="Create a guest role first before inviting guests."
            />
          ) : activeTab === 'membershipsByUser' || activeTab === 'membershipsByRole' ? (
            <InviteMembersDialog
              isOpen={inviteOpen}
              onOpenChange={setInviteOpen}
              selectedUsers={guestOnlyMembershipFlow ? selectedGuestUserIds : selectedUserIds}
              onSelectedUsersChange={
                guestOnlyMembershipFlow ? setSelectedGuestUserIds : setSelectedUserIds
              }
              excludeUserIds={
                guestOnlyMembershipFlow
                  ? [
                      ...existingMemberIds,
                      ...activeGuestAccesses
                        .map(guestAccess => guestAccess.user?.id)
                        .filter((userId): userId is string => Boolean(userId)),
                      ...requestedGuestAccesses
                        .map(guestAccess => guestAccess.user?.id)
                        .filter((userId): userId is string => Boolean(userId)),
                      ...invitedGuestAccesses
                        .map(guestAccess => guestAccess.user?.id)
                        .filter((userId): userId is string => Boolean(userId)),
                    ]
                  : existingMemberIds
              }
              excludeUserId={authUser?.id}
              roles={guestOnlyMembershipFlow ? [...guestRoles] : [...memberRoles]}
              selectedRoleIds={
                guestOnlyMembershipFlow ? selectedGuestRoleIds : selectedInviteRoleIds
              }
              onSelectedRoleIdsChange={
                guestOnlyMembershipFlow ? setSelectedGuestRoleIds : setSelectedInviteRoleIds
              }
              onInvite={guestOnlyMembershipFlow ? handleInviteGuests : handleInvite}
              isInviting={guestOnlyMembershipFlow ? isInvitingGuests : isInviting}
              submitDisabled={!guestOnlyMembershipFlow && inviteMembershipPreflight.blocking}
              submitDisabledReason={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.blocking
                  ? (inviteMembershipPreflight.response.summary ??
                    inviteMembershipPreflight.response.conflicts[0]?.summary ??
                    'Diese Einladung ist aktuell blockiert.')
                  : undefined
              }
              submitConflictResponse={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.blocking
                  ? inviteMembershipPreflight.response
                  : null
              }
              submitConflictLoading={
                !guestOnlyMembershipFlow && inviteMembershipPreflight.isLoading
              }
              disabled={group?.group_type === 'hierarchical'}
              disabledReason="Members join through subgroups"
              triggerLabel={guestOnlyMembershipFlow ? 'Invite Guest' : undefined}
              dialogTitle={guestOnlyMembershipFlow ? 'Invite Guests' : undefined}
              dialogDescription={
                guestOnlyMembershipFlow
                  ? 'This sibling group only allows guest access invitations. Official member roles are not available here.'
                  : undefined
              }
              roleSectionDescription={
                guestOnlyMembershipFlow
                  ? 'Only guest roles can be used as invite defaults for this group.'
                  : undefined
              }
              emptyRolesLabel={
                guestOnlyMembershipFlow
                  ? 'Create a guest role first before inviting people to this group.'
                  : undefined
              }
            />
          ) : null
        }
        showMembershipsByUser={canManageMembers}
        showMembershipsByRole={canManageMembers}
        membershipsByUserContent={
          <div className="space-y-4">
            <PendingRequestsTable
              requests={pendingRequests}
              getApprovePreflightInput={membership => ({
                kind: 'membership_activation',
                membership_id: membership.id,
              })}
              onApprove={(membershipId, userId) => {
                console.info('Accept button clicked in memberships.tsx', {
                  flow: 'group-membership-request-approve',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return approveMembership(
                  membershipId,
                  userId,
                  undefined,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
              onReject={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-membership-request-reject',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return rejectMembership(
                  membershipId,
                  userId,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onWithdraw={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-membership-invitation-withdraw',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return rejectMembership(
                  membershipId,
                  userId,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            <ActiveMembersTable
              members={activeMembers}
              sort={membershipSort}
              onSortChange={handleMembershipSortChange}
              onOpenRightsDialog={handleOpenMemberRights}
              onOpenChangeRoleDialog={handleOpenChangeRoleDialog}
              showProvenanceColumns={showComposition}
              onRemove={(membershipId, userId) => {
                console.info('Delete button clicked', {
                  flow: 'group-member-remove',
                  membershipId,
                  groupId,
                  actorUserId: authUser?.id ?? null,
                  membershipUserId: userId,
                });

                return removeMember(
                  membershipId,
                  userId,
                  undefined,
                  authUser?.id ?? undefined,
                  undefined,
                  groupName
                );
              }}
            />
            <OfflineRosterCard
              title="All users (incl. non signed-up offline users)"
              description="Some real group members may never sign up on the platform. Use this roster to include those offline users, map them to active platform users when needed, and keep counts and delegate calculations grounded in the full real-world membership."
              rows={allUserRows}
              connectedUserCandidates={connectedUserCandidates}
              tableVariant="membership"
              fallbackRoleLabel="No user role"
              showManageButton={canManageMembers && !showComposition}
              showProvenanceColumns={showComposition}
              onOpenRightsDialog={row => {
                if (!row.effectiveMembershipId) {
                  return;
                }

                const membership = offlineMembershipsById.get(row.effectiveMembershipId);
                if (membership) {
                  handleOpenMemberRights(membership);
                }
              }}
              onOpenChangeRoleDialog={row => {
                if (!row.effectiveMembershipId) {
                  return;
                }

                const membership = offlineMembershipsById.get(row.effectiveMembershipId);
                if (membership) {
                  handleOpenChangeRoleDialog(membership);
                }
              }}
              manageDialogTitle="Manage non signed up users"
              manageDialogDescription="Add single offline users or import them from CSV so the full group roster remains complete."
              onCreate={(entry, correlationId) =>
                serverConfirmed(
                  createOfflineMember({
                    id: crypto.randomUUID(),
                    group_id: groupId,
                    first_name: entry.firstName,
                    last_name: entry.lastName,
                    reason_not_signed_up: entry.reasonNotSignedUp || null,
                    connected_user_id: null,
                    debug_correlation_id: correlationId,
                  })
                )
              }
              onImport={(entries, correlationId) =>
                serverConfirmed(
                  importOfflineMembers({
                    group_id: groupId,
                    entries: entries.map(entry => ({
                      first_name: entry.firstName,
                      last_name: entry.lastName,
                      reason_not_signed_up: entry.reasonNotSignedUp || null,
                    })),
                    debug_correlation_id: correlationId,
                  })
                )
              }
              onConnect={(row, userId, correlationId) =>
                serverConfirmed(
                  updateOfflineMember({
                    id: row.id,
                    connected_user_id: userId,
                    debug_correlation_id: correlationId,
                  })
                )
              }
              onEdit={(row, entry, correlationId) =>
                serverConfirmed(
                  updateOfflineMember({
                    id: row.id,
                    first_name: entry.firstName,
                    last_name: entry.lastName,
                    reason_not_signed_up: entry.reasonNotSignedUp || null,
                    debug_correlation_id: correlationId,
                  })
                )
              }
              onDelete={(row, correlationId) =>
                serverConfirmed(
                  deleteOfflineMember({
                    id: row.id,
                    debug_correlation_id: correlationId,
                  })
                )
              }
            />
          </div>
        }
        membershipsByRoleContent={
          <div className="space-y-4">
            <MembershipsByRoleTables
              roles={[...memberRoles]}
              members={membershipsByRoleMembers}
              onOpenRightsDialog={handleOpenMemberRights}
              onRemoveRole={handleRemoveRoleFromMembershipTypeView}
              onSecondaryAction={handleOpenChangeRoleDialog}
              secondaryActionLabel="Manage Roles"
              showProvenanceColumns={showComposition}
            />
          </div>
        }
        compositionContent={
          <MembershipCompositionPanel
            buckets={compositionBuckets}
            isLoading={compositionIsLoading}
          />
        }
        openAssignmentsContent={
          <OpenAssignmentsPanel
            groupId={groupId}
            groupName={group?.name}
            assignments={openAssignments}
            availableEvents={availableEvents}
            isLoading={assignmentsAreLoading}
            isScheduling={assignmentsAreScheduling}
            onScheduleRoleRenewal={scheduleRoleRenewal}
            onScheduleDelegateElection={scheduleDelegateElection}
            onScheduleProcessTask={scheduleProcessTask}
          />
        }
        guestsContent={
          <div className="space-y-4">
            <GuestsTable
              guests={[...requestedGuestAccesses, ...activeGuestAccesses, ...invitedGuestAccesses]}
              onApprove={guestAccessId => void approveGuestAccess(guestAccessId)}
              onRevoke={guestAccessId => void revokeGuest(guestAccessId)}
            />
          </div>
        }
        showComposition={showComposition}
        showOpenAssignments={canManageAssignments}
        compositionLabel={t('features.groups.memberships.tabs.composition')}
        openAssignmentsLabel={t('features.groups.memberships.tabs.openAssignments')}
        showGuests={canManageMembers}
        showRoles={canManageMembers}
        rolesContent={
          <>
            <RoleDetailsTable
              roles={groupRoleHook.roles}
              onEdit={handleOpenEditRole}
              onDelete={roleId => groupRoleHook.actions.delete(roleId)}
              onAssignHolder={groupRoleHook.actions.openAssignHolder}
              onViewHistory={groupRoleHook.actions.openHistory}
              onCreateElection={roleId => groupRoleHook.actions.createElection(roleId)}
              addRoleButton={
                <AddRoleDialog
                  isOpen={addRoleOpen}
                  onOpenChange={setAddRoleOpen}
                  form={newRoleForm}
                  onFormChange={patch => setNewRoleForm(current => ({ ...current, ...patch }))}
                  onSubmit={handleAddRole}
                  guestOnlyMembershipFlow={guestOnlyMembershipFlow}
                />
              }
            />
            <RolesPermissionsTable
              roles={[...accessRoles]}
              onTogglePermission={handleTogglePermission}
              onReorderRoles={reorderRoles}
            />
          </>
        }
      />

      <MemberRightsDialog
        isOpen={memberRightsOpen}
        onOpenChange={setMemberRightsOpen}
        membership={memberRightsMembership}
        onNavigateToUser={userId => navigate({ to: '/user/$id', params: { id: userId } })}
      />

      <ChangeRoleDialog
        isOpen={changeRoleOpen}
        onOpenChange={setChangeRoleOpen}
        memberName={
          changeRoleMembership
            ? [changeRoleMembership.user?.first_name, changeRoleMembership.user?.last_name]
                .filter(Boolean)
                .join(' ') || 'Unknown User'
            : ''
        }
        currentRoles={
          changeRoleMembership?.roles ??
          (changeRoleMembership?.role ? [changeRoleMembership.role] : [])
        }
        roles={[...memberRoles]}
        onConfirm={handleConfirmRoleChange}
      />

      <AddRoleDialog
        isOpen={editRoleOpen}
        onOpenChange={open => {
          setEditRoleOpen(open);
          if (!open) {
            setEditingRole(null);
          }
        }}
        form={editRoleForm}
        onFormChange={patch => setEditRoleForm(current => ({ ...current, ...patch }))}
        onSubmit={handleSaveEditedRole}
        title={editingRole?.name ? `Edit ${editingRole.name}` : 'Edit Role'}
        description="Adjust how this role is assigned, who can see it, and when it should come up for a revote."
        submitLabel="Save Role"
        trigger={null}
        guestOnlyMembershipFlow={guestOnlyMembershipFlow}
      />

      {groupRoleHook.selectedRole ? (
        <AssignHolderDialog
          open={groupRoleHook.dialogs.assignHolder.open}
          onOpenChange={groupRoleHook.dialogs.assignHolder.setOpen}
          role={groupRoleHook.selectedRole}
          groupId={groupId}
          onAssign={(userId, reason) => {
            const selectedRole = groupRoleHook.selectedRole;
            if (!selectedRole) return Promise.resolve();
            return groupRoleHook.actions.assignHolder(selectedRole.id, userId, reason);
          }}
        />
      ) : null}

      {groupRoleHook.selectedRole ? (
        <RoleHolderHistoryDialog
          open={groupRoleHook.dialogs.history.open}
          onOpenChange={groupRoleHook.dialogs.history.setOpen}
          role={groupRoleHook.selectedRole}
        />
      ) : null}
    </div>
  );
}
