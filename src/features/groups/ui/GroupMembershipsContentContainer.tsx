import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@rocicorp/zero/react';
import { useTranslation } from 'react-i18next';
import { GroupMembershipsContentView } from '@/features/groups/ui/GroupMembershipsContentView';
import {
  type OfflineRosterCandidateUser,
  type OfflineRosterGroupReference,
  type OfflineRosterRow,
} from '@/features/offline-roster/ui/OfflineRosterCard';
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
import { emptyRoleEditorForm, roleToEditorForm } from '@/features/groups/logic/roleFormHelpers';
import {
  augmentMembershipsWithCurrentRoleHolders,
  getMembershipAssignedRoles,
  getMembershipDisplayRoles,
} from '@/features/groups/logic/buildMembershipRightsSummary';
import { resolveChildBaseGroups } from '@/features/groups/logic/hierarchy';
import { buildMembershipRightsAlignmentRowsFromRelationships } from '@/features/groups/logic/membershipRightsAlignment';
import { resolveOfflineRosterProvenance } from '@/features/groups/logic/offlineRosterProvenance';
import {
  buildMembershipCompositionBuckets,
  type MembershipCompositionGroupLike,
} from '@/features/groups/logic/membershipComposition';
import { selectMaterializedHierarchicalMemberships } from '@/features/groups/logic/effectiveMemberships';
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

type EffectiveOfflineMembership = GroupOfflineMembershipWithRolesAndRightsByGroupIdsRow & {
  membershipKind: 'offline';
  user_id: string;
  user: ParticipationUserLike;
  roles: ParticipationRoleLike[];
  role: ParticipationRoleLike | null;
  partGroup?: ParticipationProvenanceGroupLike | null;
  baseGroup?: ParticipationProvenanceGroupLike | null;
  provenanceBucketLabel?: string | null;
  effectiveReadOnly?: boolean;
  effectiveSourceMembershipId?: string;
};

type MembershipParticipant = GroupMembershipWithUser | EffectiveOfflineMembership;

export function buildCompositionOfflineRosterRows(
  memberships: readonly EffectiveOfflineMembership[],
  canManageMembers: boolean
): OfflineRosterRow[] {
  return memberships.map<OfflineRosterRow>(membership => {
    const offlineMember = membership.group_offline_member;

    return {
      id: offlineMember?.id ?? membership.group_offline_member_id,
      kind: 'offline',
      effectiveMembershipId: membership.id,
      user: null,
      firstName: offlineMember?.first_name ?? membership.user.first_name ?? '',
      lastName: offlineMember?.last_name ?? membership.user.last_name ?? '',
      isActiveUser: false,
      reasonNotSignedUp: offlineMember?.reason_not_signed_up ?? null,
      connectedUser: offlineMember?.connected_user ?? null,
      partGroup: membership.partGroup ?? null,
      baseGroup: membership.baseGroup ?? null,
      roles: membership.roles ?? [],
      canViewRights: true,
      canManageRoles: canManageMembers,
      readOnlyIdentity: true,
      canConnect: false,
      canEdit: false,
      canDelete: false,
    };
  });
}

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

function toProvenanceGroupReference(
  groupRef: GroupReferenceLike | null | undefined
): ParticipationProvenanceGroupLike | null {
  if (!groupRef?.id) {
    return null;
  }

  return {
    id: groupRef.id,
    name: groupRef.name ?? groupRef.id,
    group_type: groupRef.group_type ?? null,
  };
}

export function GroupMembershipsContentContainer({
  groupId,
  canManageMembers,
  canManageAssignments,
  defaultTab,
  focusAssignmentId,
}: {
  groupId: string;
  canManageMembers: boolean;
  canManageAssignments: boolean;
  defaultTab?: MembershipTab;
  focusAssignmentId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { group } = useGroupData(groupId);
  const { allRelationshipsWithGroups } = useGroupState({ includeAllRelationshipsWithGroups: true });
  const compositionGroup = useMemo(() => toMembershipCompositionGroup(group), [group]);
  const showRightsAlignment = canManageMembers && compositionGroup?.group_type === 'hierarchical';
  const hierarchyRelationships = useMemo(
    () => allRelationshipsWithGroups as Parameters<typeof resolveChildBaseGroups>[1],
    [allRelationshipsWithGroups]
  );
  const groupName = group?.name || t('features.groups.detail.title');

  const resolvedDefaultTab = useMemo<MembershipTab>(() => {
    if (
      defaultTab === 'openAssignments' &&
      canManageAssignments &&
      (!canManageMembers || defaultTab === 'openAssignments')
    ) {
      return 'openAssignments';
    }

    if (defaultTab === 'rightsAlignment' && showRightsAlignment) {
      return 'rightsAlignment';
    }

    if (
      defaultTab &&
      canManageMembers &&
      ['membershipsByUser', 'membershipsByRole', 'composition', 'guests', 'roles'].includes(
        defaultTab
      )
    ) {
      return defaultTab;
    }

    return canManageMembers ? 'membershipsByUser' : 'openAssignments';
  }, [canManageAssignments, canManageMembers, defaultTab, showRightsAlignment]);
  const [activeTab, setActiveTab] = useState<MembershipTab>(resolvedDefaultTab);
  const [membershipSort, setMembershipSort] = useState<MembershipSort>({
    field: 'user',
    direction: 'asc',
  });

  useEffect(() => {
    setActiveTab(resolvedDefaultTab);
  }, [resolvedDefaultTab]);

  const { activeMemberships, invitedMemberships, requestedMemberships } =
    useGroupMemberships(groupId);
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
  const activeMembershipsWithElectedRoles = useMemo(
    () =>
      augmentMembershipsWithCurrentRoleHolders(
        activeMemberships as GroupMembershipWithUser[],
        groupRoleHook.roles
      ),
    [activeMemberships, groupRoleHook.roles]
  );
  const effectiveActiveMemberships = useMemo(
    () => activeMembershipsWithElectedRoles as GroupMembershipWithUser[],
    [activeMembershipsWithElectedRoles]
  );
  const { activeGuestAccesses, requestedGuestAccesses, invitedGuestAccesses } =
    useGroupGuestAccesses(groupId);
  const {
    showComposition,
    membershipsWithProvenance,
    isLoading: compositionIsLoading,
  } = useGroupMembershipComposition(
    compositionGroup,
    effectiveActiveMemberships as GroupMembershipWithUser[]
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
      [...activeMembershipsWithElectedRoles, ...requestedMemberships, ...invitedMemberships]
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
    if ((changeRoleMembership as { effectiveReadOnly?: boolean }).effectiveReadOnly) return;

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
    if ((membership as { effectiveReadOnly?: boolean }).effectiveReadOnly) {
      return;
    }

    const nextRoleIds = getMembershipAssignedRoles(membership)
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

  const [offlineMembersData, offlineMembersResult] = useQuery(
    compositionGroupIds.length > 0
      ? queries.groups.offlineMembersByGroupIds({ groupIds: compositionGroupIds })
      : undefined
  );
  const { offlineMemberships: offlineMembershipsData, isLoading: offlineMembershipsIsLoading } =
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

  const allEffectiveOfflineMemberships = useMemo<EffectiveOfflineMembership[]>(() => {
    const hierarchyOfflineMemberships =
      compositionGroup?.group_type === 'hierarchical'
        ? selectMaterializedHierarchicalMemberships({
            targetGroup: compositionGroup,
            memberships: offlineMembershipsData || [],
            relationships: hierarchyRelationships,
          })
        : (offlineMembershipsData || []).filter(membership => membership.group_id === groupId);

    return hierarchyOfflineMemberships.map(membership => {
      const effectiveFields = membership as typeof membership & {
        effectiveReadOnly?: boolean;
        effectiveSourceMembershipId?: string;
      };
      const offlineMember = membership.group_offline_member;
      const provenance = offlineMember?.id
        ? offlineProvenanceByMemberId.get(offlineMember.id)
        : undefined;
      const sourceGroupRef = toProvenanceGroupReference(
        membership.source_group ?? offlineMember?.group
      );

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
        partGroup: showComposition ? (provenance?.partGroup ?? sourceGroupRef ?? null) : null,
        baseGroup: showComposition ? (provenance?.baseGroup ?? sourceGroupRef ?? null) : null,
        provenanceBucketLabel: showComposition ? (provenance?.provenanceBucketLabel ?? null) : null,
        effectiveReadOnly: effectiveFields.effectiveReadOnly,
        effectiveSourceMembershipId: effectiveFields.effectiveSourceMembershipId,
      };
    });
  }, [
    compositionGroup,
    groupId,
    hierarchyRelationships,
    offlineMembershipsData,
    offlineProvenanceByMemberId,
    showComposition,
  ]);

  const effectiveOfflineMemberships = useMemo<EffectiveOfflineMembership[]>(() => {
    const searchValue = memberSearchQuery.trim().toLowerCase();

    if (!searchValue) {
      return allEffectiveOfflineMemberships;
    }

    return allEffectiveOfflineMemberships.filter(membership => {
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
    });
  }, [allEffectiveOfflineMemberships, memberSearchQuery]);

  const offlineRows = useMemo(() => {
    const searchValue = memberSearchQuery.trim().toLowerCase();
    const effectiveMembershipByOfflineMemberId = new Map(
      effectiveOfflineMemberships.map(membership => [
        membership.group_offline_member_id,
        membership,
      ])
    );

    if (showComposition) {
      return buildCompositionOfflineRosterRows(effectiveOfflineMemberships, canManageMembers);
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
          partGroup: null,
          baseGroup: null,
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
  const compositionPanelIsLoading =
    compositionIsLoading ||
    (showComposition &&
      compositionGroupIds.length > 0 &&
      (offlineMembersResult.type === 'unknown' || offlineMembershipsIsLoading));
  const compositionPanelBuckets = useMemo(() => {
    if (!showComposition || compositionPanelIsLoading) {
      return [];
    }

    return buildMembershipCompositionBuckets([
      ...membershipsWithProvenance,
      ...allEffectiveOfflineMemberships,
    ]);
  }, [
    allEffectiveOfflineMemberships,
    compositionPanelIsLoading,
    membershipsWithProvenance,
    showComposition,
  ]);
  const rightsAlignmentRows = useMemo(
    () =>
      showRightsAlignment
        ? buildMembershipRightsAlignmentRowsFromRelationships({
            targetGroupId: groupId,
            memberships: [...membershipsWithProvenance, ...allEffectiveOfflineMemberships],
            relationships: allRelationshipsWithGroups,
          })
        : [],
    [
      allEffectiveOfflineMemberships,
      allRelationshipsWithGroups,
      groupId,
      membershipsWithProvenance,
      showRightsAlignment,
    ]
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
      effectiveActiveMemberships.flatMap(membership => {
        const user = membership.user;
        if (!user?.id || offlineConnectedUserIds.has(user.id)) {
          return [];
        }

        return [user as OfflineRosterCandidateUser];
      }),
    [effectiveActiveMemberships, offlineConnectedUserIds]
  );

  return (
    <GroupMembershipsContentView
      accessRoles={accessRoles}
      activeGuestAccesses={activeGuestAccesses}
      activeMembers={activeMembers}
      activeTab={activeTab}
      addRoleOpen={addRoleOpen}
      allUserRows={allUserRows}
      approveGuestAccess={approveGuestAccess}
      approveMembership={approveMembership}
      assignmentsAreLoading={assignmentsAreLoading}
      assignmentsAreScheduling={assignmentsAreScheduling}
      authUser={authUser}
      availableEvents={availableEvents}
      canManageAssignments={canManageAssignments}
      canManageMembers={canManageMembers}
      changeRoleMembership={changeRoleMembership}
      changeRoleOpen={changeRoleOpen}
      compositionBuckets={compositionPanelBuckets}
      compositionIsLoading={compositionPanelIsLoading}
      connectedUserCandidates={connectedUserCandidates}
      createOfflineMember={createOfflineMember}
      deleteOfflineMember={deleteOfflineMember}
      editingRole={editingRole}
      editRoleForm={editRoleForm}
      editRoleOpen={editRoleOpen}
      existingMemberIds={existingMemberIds}
      group={group}
      groupId={groupId}
      groupName={groupName}
      groupRoleHook={groupRoleHook}
      guestOnlyMembershipFlow={guestOnlyMembershipFlow}
      guestRoles={guestRoles}
      handleAddRole={handleAddRole}
      handleConfirmRoleChange={handleConfirmRoleChange}
      handleInvite={handleInvite}
      handleInviteGuests={handleInviteGuests}
      handleMembershipSortChange={handleMembershipSortChange}
      handleOpenChangeRoleDialog={handleOpenChangeRoleDialog}
      handleOpenEditRole={handleOpenEditRole}
      handleOpenMemberRights={handleOpenMemberRights}
      handleRemoveRoleFromMembershipTypeView={handleRemoveRoleFromMembershipTypeView}
      handleSaveEditedRole={handleSaveEditedRole}
      handleTogglePermission={handleTogglePermission}
      importOfflineMembers={importOfflineMembers}
      invitedGuestAccesses={invitedGuestAccesses}
      inviteMembershipPreflight={inviteMembershipPreflight}
      inviteOpen={inviteOpen}
      isInviting={isInviting}
      isInvitingGuests={isInvitingGuests}
      memberRightsMembership={memberRightsMembership}
      memberRightsOpen={memberRightsOpen}
      memberRoles={memberRoles}
      memberSearchQuery={memberSearchQuery}
      membershipsByRoleMembers={membershipsByRoleMembers}
      membershipSort={membershipSort}
      navigate={navigate}
      newRoleForm={newRoleForm}
      offlineMembershipsById={offlineMembershipsById}
      openAssignments={openAssignments}
      focusAssignmentId={focusAssignmentId}
      pendingInvitations={pendingInvitations}
      pendingRequests={pendingRequests}
      rejectMembership={rejectMembership}
      removeMember={removeMember}
      reorderRoles={reorderRoles}
      requestedGuestAccesses={requestedGuestAccesses}
      revokeGuest={revokeGuest}
      rightsAlignmentRows={rightsAlignmentRows}
      scheduleDelegateElection={scheduleDelegateElection}
      scheduleProcessTask={scheduleProcessTask}
      scheduleRoleRenewal={scheduleRoleRenewal}
      selectedGuestRoleIds={selectedGuestRoleIds}
      selectedGuestUserIds={selectedGuestUserIds}
      selectedInviteRoleIds={selectedInviteRoleIds}
      selectedUserIds={selectedUserIds}
      setActiveTab={setActiveTab}
      setAddRoleOpen={setAddRoleOpen}
      setChangeRoleOpen={setChangeRoleOpen}
      setEditingRole={setEditingRole}
      setEditRoleForm={setEditRoleForm}
      setEditRoleOpen={setEditRoleOpen}
      setInviteOpen={setInviteOpen}
      setMemberRightsOpen={setMemberRightsOpen}
      setMemberSearchQuery={setMemberSearchQuery}
      setNewRoleForm={setNewRoleForm}
      setSelectedGuestRoleIds={setSelectedGuestRoleIds}
      setSelectedGuestUserIds={setSelectedGuestUserIds}
      setSelectedInviteRoleIds={setSelectedInviteRoleIds}
      setSelectedUserIds={setSelectedUserIds}
      showComposition={showComposition}
      showRightsAlignment={showRightsAlignment}
      t={t}
      updateOfflineMember={updateOfflineMember}
    />
  );
}
