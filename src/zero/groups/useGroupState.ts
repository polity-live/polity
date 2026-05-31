import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

interface GroupStateOptions {
  groupId?: string;
  userId?: string;
  includeSearch?: boolean;
  includeAllRelationships?: boolean;
  includeByUser?: boolean;
  includeMembershipsWithUsers?: boolean;
  includeCurrentUserMembershipsWithGroups?: boolean;
  includeAllRelationshipsWithGroups?: boolean;
}

interface GroupRoleDisplayLike {
  name?: string | null;
  term_start_date?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_interval?: number | null;
}

interface GroupRoleLike {
  id?: string | null;
  name?: string | null;
  sort_order?: number | null;
  action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
}

interface GroupMembershipRoleLinkLike<TRole extends GroupRoleLike = GroupRoleLike> {
  role?: TRole | null;
}

interface GroupGuestRoleLinkLike<TRole extends GroupRoleLike = GroupRoleLike> {
  role?: TRole | null;
}

function selectPrimaryGroupRole<TRole extends GroupRoleLike>(roles: readonly TRole[]) {
  if (roles.length === 0) return null;

  return (
    [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1))[0] ?? null
  );
}

function normalizeMembershipWithRoles<
  TMembership extends {
    membership_roles?: readonly GroupMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(membership: TMembership) {
  const roles: TRole[] = [];
  for (const link of membership.membership_roles || []) {
    if (link.role) {
      roles.push(link.role);
    }
  }
  const primaryRole = selectPrimaryGroupRole(roles) ?? membership.role ?? null;

  return {
    ...membership,
    roles,
    role: primaryRole,
  };
}

function normalizeMemberships<
  TMembership extends {
    membership_roles?: readonly GroupMembershipRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(memberships: readonly TMembership[] | null | undefined) {
  return (memberships || []).map(membership => normalizeMembershipWithRoles(membership));
}

function normalizeGuestAccesses<
  TGuestAccess extends {
    guest_roles?: readonly GroupGuestRoleLinkLike<TRole>[] | null;
    role?: TRole | null;
  },
  TRole extends GroupRoleLike,
>(guestAccesses: readonly TGuestAccess[] | null | undefined) {
  return (guestAccesses || []).map(guestAccess => {
    const roles: TRole[] = [];
    for (const link of guestAccess.guest_roles || []) {
      if (link.role) {
        roles.push(link.role);
      }
    }
    return {
      ...guestAccess,
      roles,
      role: selectPrimaryGroupRole(roles) ?? guestAccess.role ?? null,
    };
  });
}

function mapRoleForDisplay<T extends GroupRoleDisplayLike>(role: T) {
  return {
    ...role,
    title: role.name,
    term:
      Boolean(role.is_recurring) && role.recurrence_pattern === 'yearly'
        ? String(role.recurrence_interval ?? 1)
        : null,
    first_term_start: role.term_start_date ?? null,
  };
}

/**
 * Reactive state hook for group data.
 * Returns all query-derived state — no mutations.
 */
export function useGroupState(options: GroupStateOptions = {}) {
  const {
    groupId,
    userId,
    includeSearch,
    includeAllRelationships,
    includeByUser,
    includeMembershipsWithUsers,
    includeCurrentUserMembershipsWithGroups,
    includeAllRelationshipsWithGroups,
  } = options;

  const [group, groupResult] = useQuery(groupId ? queries.groups.byId({ id: groupId }) : undefined);

  const [memberships, membershipsResult] = useQuery(
    groupId ? queries.groups.memberships({ groupId }) : undefined
  );

  const [roles, rolesResult] = useQuery(groupId ? queries.groups.roles({ groupId }) : undefined);

  const [scopedRoles, scopedRolesResult] = useQuery(
    groupId ? queries.groups.scopedRoles({ groupId }) : undefined
  );

  const [relationships, relationshipsResult] = useQuery(
    groupId ? queries.groups.hierarchy({ groupId }) : undefined
  );

  const [relationshipsAsTarget, relationshipsAsTargetResult] = useQuery(
    groupId ? queries.groups.hierarchyAsTarget({ groupId }) : undefined
  );

  // ── User memberships (opt-in) ──────────────────────────────────────
  const [userMemberships, userMembershipsResult] = useQuery(
    userId ? queries.groups.membershipsByUser({ user_id: userId }) : undefined
  );

  // ── Search all groups (opt-in) ─────────────────────────────────────
  const [searchResults, searchResult] = useQuery(
    includeSearch ? queries.groups.search({ query: '' }) : undefined
  );

  // ── All relationships (opt-in) ─────────────────────────────────────
  const [allRelationships, allRelationshipsResult] = useQuery(
    includeAllRelationships ? queries.groups.allRelationships({}) : undefined
  );

  // ── All relationships with groups (opt-in) ─────────────────────────
  const [allRelationshipsWithGroups, allRelationshipsWithGroupsResult] = useQuery(
    includeAllRelationshipsWithGroups ? queries.groups.allRelationshipsWithGroups({}) : undefined
  );

  // ── Current user's groups via byUser (opt-in) ──────────────────────
  const [userGroupMemberships, userGroupMembershipsResult] = useQuery(
    includeByUser ? queries.groups.byUser({}) : undefined
  );

  // ── Memberships with user data (opt-in, needs groupId) ─────────────
  const [membershipsWithUsers, membershipsWithUsersResult] = useQuery(
    includeMembershipsWithUsers && groupId
      ? queries.groups.membershipsWithUsers({ groupId })
      : undefined
  );

  // ── Current user memberships with group data (opt-in) ──────────────
  const [currentUserMembershipsWithGroups, currentUserMembershipsWithGroupsResult] = useQuery(
    includeCurrentUserMembershipsWithGroups
      ? queries.groups.currentUserMembershipsWithGroups({})
      : undefined
  );

  const isLoading =
    (groupId !== undefined && groupResult.type === 'unknown') ||
    (groupId !== undefined && membershipsResult.type === 'unknown') ||
    (groupId !== undefined && rolesResult.type === 'unknown') ||
    (groupId !== undefined && scopedRolesResult.type === 'unknown') ||
    (groupId !== undefined && relationshipsResult.type === 'unknown') ||
    (groupId !== undefined && relationshipsAsTargetResult.type === 'unknown') ||
    (userId !== undefined && userMembershipsResult.type === 'unknown') ||
    (includeSearch === true && searchResult.type === 'unknown') ||
    (includeAllRelationships === true && allRelationshipsResult.type === 'unknown') ||
    (includeByUser === true && userGroupMembershipsResult.type === 'unknown') ||
    (includeMembershipsWithUsers === true &&
      groupId !== undefined &&
      membershipsWithUsersResult.type === 'unknown') ||
    (includeCurrentUserMembershipsWithGroups === true &&
      currentUserMembershipsWithGroupsResult.type === 'unknown') ||
    (includeAllRelationshipsWithGroups === true &&
      allRelationshipsWithGroupsResult.type === 'unknown');

  return {
    group,
    memberships: normalizeMemberships(memberships),
    roles,
    scopedRoles,
    relationships,
    relationshipsAsTarget,
    userMemberships: normalizeMemberships(userMemberships),
    searchResults: searchResults ?? [],
    allRelationships: allRelationships ?? [],
    allRelationshipsWithGroups: allRelationshipsWithGroups ?? [],
    userGroupMemberships: normalizeMemberships(userGroupMemberships),
    membershipsWithUsers: normalizeMemberships(membershipsWithUsers),
    currentUserMembershipsWithGroups: normalizeMemberships(currentUserMembershipsWithGroups),
    isLoading,
  };
}

// ── Focused Query Hooks ─────────────────────────────────────────────
// (Migrated from hooks.ts — each wraps a single formal query)

// ── Group Wiki Data (deep relations for GroupWiki) ──────────────────

export function useGroupWikiData(groupId: string) {
  const [groupsData, groupsResult] = useQuery(queries.groups.wikiData({ id: groupId }));

  const group = useMemo(() => {
    const currentGroup = groupsData?.[0];
    if (!currentGroup) return null;

    return {
      ...currentGroup,
      memberships: normalizeMemberships(currentGroup.memberships),
      roles: (currentGroup.roles || []).map(mapRoleForDisplay),
    };
  }, [groupsData]);

  return {
    group,
    isLoading: groupsResult.type === 'unknown',
  };
}

// ── User Membership in a specific Group ─────────────────────────────

export function useUserMembershipInGroup(userId: string | undefined, groupId?: string) {
  const [membershipsData, membershipsResult] = useQuery(
    userId && groupId ? queries.groups.userMembershipInGroup({ userId, groupId }) : undefined
  );

  const [allMembershipsData, allMembershipsResult] = useQuery(
    groupId ? queries.groups.allMembershipsInGroupWithRole({ groupId }) : undefined
  );

  return {
    memberships: normalizeMemberships(membershipsData),
    allMemberships: normalizeMemberships(allMembershipsData),
    isLoading:
      Boolean(groupId) &&
      ((userId !== undefined && membershipsResult.type === 'unknown') ||
        allMembershipsResult.type === 'unknown'),
  };
}

// ── Group Subscribers ───────────────────────────────────────────────

export function useGroupSubscribers(groupId: string | undefined) {
  const [groupsData, groupsResult] = useQuery(
    groupId ? queries.groups.byIdBasic({ id: groupId }) : undefined
  );

  const [subscribersData, subscribersResult] = useQuery(
    groupId ? queries.groups.subscribersByGroup({ groupId }) : undefined
  );

  const subscriberCount = subscribersData?.length ?? groupsData?.[0]?.subscriber_count ?? 0;

  return {
    groupName: groupsData?.[0]?.name || 'Group',
    subscriberCount,
    subscribers: subscribersData || [],
    isLoading: groupsResult.type === 'unknown' || subscribersResult.type === 'unknown',
  };
}

// ── All Groups ──────────────────────────────────────────────────────

export function useAllGroups() {
  const [groupsData, groupsResult] = useQuery(queries.groups.all({}));

  return {
    groups: groupsData || [],
    isLoading: groupsResult.type === 'unknown',
  };
}

// ── All Documents (with collaborators) ──────────────────────────────

export function useAllDocuments() {
  const [documentsData, documentsResult] = useQuery(queries.groups.allDocuments({}));

  return {
    documents: documentsData || [],
    isLoading: documentsResult.type === 'unknown',
  };
}

// ── Group by ID (full) ──────────────────────────────────────────────

export function useGroupById(groupId?: string) {
  const [groupsData, groupsResult] = useQuery(
    groupId ? queries.groups.byIdFull({ id: groupId }) : undefined
  );

  const isLoading = groupsResult.type === 'unknown';
  const group = useMemo(() => {
    const currentGroup = groupsData?.[0];
    if (!currentGroup) return null;

    return {
      ...currentGroup,
      memberships: normalizeMemberships(currentGroup.memberships),
      guest_accesses: normalizeGuestAccesses(currentGroup.guest_accesses),
    };
  }, [groupsData]);
  const memberships = useMemo(() => group?.memberships || [], [group]);
  const roles = useMemo(() => group?.roles || [], [group]);
  const events = useMemo(() => group?.events || [], [group]);
  const amendments = useMemo(() => group?.amendments || [], [group]);
  const conversation = useMemo(() => group?.conversations, [group]);

  const memberStats = useMemo(() => {
    const stats = { total: memberships.length, members: 0, admins: 0, invited: 0, requested: 0 };
    memberships.forEach(membership => {
      if (membership.status === 'active') stats.members++;
      if (membership.status === 'admin' || membership.role?.name === 'Board Member') stats.admins++;
      if (membership.status === 'invited') stats.invited++;
      if (membership.status === 'requested') stats.requested++;
    });
    return stats;
  }, [memberships]);

  return { group, memberships, roles, events, amendments, conversation, memberStats, isLoading };
}

// ── Group Memberships ───────────────────────────────────────────────

export function useGroupMemberships(groupId?: string) {
  const [membershipsData, membershipsResult] = useQuery(
    groupId ? queries.groups.membershipsWithRolesAndRights({ groupId }) : undefined
  );

  const isLoading = membershipsResult.type === 'unknown';
  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const { activeMemberships, invitedMemberships, requestedMemberships, pendingMemberships } =
    useMemo(() => {
      const active: (typeof memberships)[number][] = [];
      const invited: (typeof memberships)[number][] = [];
      const requested: (typeof memberships)[number][] = [];
      const pending: (typeof memberships)[number][] = [];
      memberships.forEach(m => {
        if (m.status === 'active' || m.status === 'admin' || m.role?.name === 'Board Member') {
          active.push(m);
        } else if (m.status === 'invited') {
          invited.push(m);
          pending.push(m);
        } else if (m.status === 'requested') {
          requested.push(m);
          pending.push(m);
        }
      });
      return {
        activeMemberships: active,
        invitedMemberships: invited,
        requestedMemberships: requested,
        pendingMemberships: pending,
      };
    }, [memberships]);

  return {
    memberships,
    activeMemberships,
    invitedMemberships,
    requestedMemberships,
    pendingMemberships,
    isLoading,
  };
}

export function useGroupGuestAccesses(groupId?: string) {
  const [guestAccessesData, guestAccessesResult] = useQuery(
    groupId ? queries.groups.guestAccessesWithRolesAndRights({ groupId }) : undefined
  );

  const isLoading = guestAccessesResult.type === 'unknown';
  const guestAccesses = useMemo(
    () => normalizeGuestAccesses(guestAccessesData),
    [guestAccessesData]
  );

  const { activeGuestAccesses, invitedGuestAccesses, revokedGuestAccesses } = useMemo(() => {
    const active: (typeof guestAccesses)[number][] = [];
    const invited: (typeof guestAccesses)[number][] = [];
    const revoked: (typeof guestAccesses)[number][] = [];

    guestAccesses.forEach(guestAccess => {
      if (guestAccess.status === 'active') {
        active.push(guestAccess);
      } else if (guestAccess.status === 'invited') {
        invited.push(guestAccess);
      } else if (guestAccess.status === 'revoked') {
        revoked.push(guestAccess);
      }
    });

    return {
      activeGuestAccesses: active,
      invitedGuestAccesses: invited,
      revokedGuestAccesses: revoked,
    };
  }, [guestAccesses]);

  return {
    guestAccesses,
    activeGuestAccesses,
    invitedGuestAccesses,
    revokedGuestAccesses,
    isLoading,
  };
}

// ── Group Roles ─────────────────────────────────────────────────────

export function useGroupAccessRoles(groupId?: string) {
  const [rolesData, rolesResult] = useQuery(
    groupId ? queries.groups.accessRolesWithRights({ groupId }) : undefined
  );

  return {
    roles: useMemo(() => rolesData || [], [rolesData]),
    isLoading: rolesResult.type === 'unknown',
  };
}

// ── Group Network / Relationships ───────────────────────────────────

export function useGroupNetwork(groupId: string) {
  const [groupData, groupResult] = useQuery(queries.groups.byIdForNetwork({ id: groupId }));

  const [relationshipsData, relationshipsResult] = useQuery(
    queries.groups.networkRelationships({})
  );

  return {
    group: groupData?.[0] || null,
    relationships: relationshipsData || [],
    isLoading: groupResult.type === 'unknown' || relationshipsResult.type === 'unknown',
  };
}

// ── Group Amendments ────────────────────────────────────────────────

export function useGroupAmendments(groupId: string) {
  const [amendments, amendmentsResult] = useQuery(queries.groups.amendmentsByGroup({ groupId }));

  return {
    amendments: amendments || [],
    isLoading: amendmentsResult.type === 'unknown',
  };
}

// ── Group Documents ─────────────────────────────────────────────────

export function useGroupDocuments(groupId: string) {
  const [amendmentsData, documentsResult] = useQuery(
    queries.groups.amendmentsWithDocuments({ groupId })
  );

  const documents = useMemo(
    () =>
      (amendmentsData || []).flatMap(a =>
        (a.documents || []).map(doc => ({ ...doc, title: a.title }))
      ),
    [amendmentsData]
  );

  return { documents, isLoading: documentsResult.type === 'unknown' };
}

// ── Group Roles ─────────────────────────────────────────────────────

export function useGroupRoles(groupId: string) {
  const [rolesData, rolesResult] = useQuery(queries.groups.rolesFull({ groupId }));

  const roles = useMemo(
    () =>
      (rolesData || []).map(role => {
        const currentHistoryEntry = role.holder_history?.find(history => !history.end_date);
        const currentMembershipEntry = role.group_membership_roles?.find(
          membershipRole => membershipRole.group_membership?.user?.id
        )?.group_membership;
        const currentAssignee = currentHistoryEntry?.user ?? currentMembershipEntry?.user ?? null;
        return {
          ...role,
          title: role.name,
          term:
            role.is_recurring && role.recurrence_pattern === 'yearly'
              ? String(role.recurrence_interval ?? 1)
              : null,
          first_term_start: role.term_start_date ?? null,
          currentHolder: currentAssignee?.id
            ? {
                id: currentAssignee.id,
                fullName:
                  [currentAssignee.first_name, currentAssignee.last_name]
                    .filter(Boolean)
                    .join(' ') || null,
                handle: currentAssignee.handle ?? null,
                imageURL: currentAssignee.avatar ?? null,
                source: currentHistoryEntry?.user?.id ? 'incumbent' : 'membership',
              }
            : null,
        };
      }),
    [rolesData]
  );

  return {
    roles,
    isLoading: rolesResult.type === 'unknown',
  };
}

// ── Group Todos ─────────────────────────────────────────────────────

export function useGroupTodos(groupId: string) {
  const [todosData, todosResult] = useQuery(queries.groups.todosByGroup({ groupId }));

  return {
    todos: todosData || [],
    isLoading: todosResult.type === 'unknown',
  };
}

// ── Group Links ─────────────────────────────────────────────────────

export function useGroupLinks(groupId: string) {
  const [linksData, linksResult] = useQuery(queries.groups.linksByGroup({ groupId }));

  return {
    links: linksData || [],
    isLoading: linksResult.type === 'unknown',
  };
}

// ── Group Payments ──────────────────────────────────────────────────

export function useGroupPaymentsData(groupId: string) {
  const [paymentsData, paymentsResult] = useQuery(
    queries.groups.paymentsReceivedByGroup({ groupId })
  );
  const [payerPaymentsData, payerPaymentsResult] = useQuery(
    queries.groups.paymentsPaidByGroup({ groupId })
  );

  const payments = useMemo(() => {
    return [...(paymentsData || []), ...(payerPaymentsData || [])].filter(
      (p, i, arr) => arr.findIndex(x => x.id === p.id) === i
    );
  }, [paymentsData, payerPaymentsData]);

  return {
    payments,
    isLoading: paymentsResult.type === 'unknown' || payerPaymentsResult.type === 'unknown',
  };
}

// ── Group Active Members (for dialogs) ──────────────────────────────

export function useGroupActiveMembers(groupId: string) {
  const [membershipsData, membershipsResult] = useQuery(
    queries.groups.activeMembersByGroup({ groupId })
  );

  return {
    members: membershipsData || [],
    isLoading: membershipsResult.type === 'unknown',
  };
}

// ── User Search ─────────────────────────────────────────────────────

export function useUserSearch(searchQuery: string, existingMemberIds: string[] = []) {
  const trimmedQuery = searchQuery.trim();

  const [usersData, usersResult] = useQuery(queries.groups.allUsersLimited({}));

  const users = useMemo(() => {
    const allUsers = usersData || [];
    const filtered = trimmedQuery
      ? allUsers.filter(
          user =>
            `${user.first_name || ''} ${user.last_name || ''}`
              .toLowerCase()
              .includes(trimmedQuery.toLowerCase()) ||
            user.handle?.toLowerCase().includes(trimmedQuery.toLowerCase())
        )
      : allUsers;
    return filtered.filter(user => !existingMemberIds.includes(user.id));
  }, [usersData, existingMemberIds, trimmedQuery]);

  return { users, isLoading: usersResult.type === 'unknown' };
}

// ── Public Groups ───────────────────────────────────────────────────

export function usePublicGroups() {
  const [groups, result] = useQuery(queries.groups.publicGroups({}));

  return {
    groups: groups ?? [],
    isLoading: result.type === 'unknown',
  };
}

// ── User Group Subscriptions (for timeline) ─────────────────────────

export function useUserGroupSubscriptions(userId?: string) {
  const [memberships, result] = useQuery(
    userId ? queries.groups.userMembershipsWithGroupRelations({ userId }) : undefined
  );

  return {
    memberships: memberships ?? [],
    isLoading: result.type === 'unknown',
  };
}

// ── Groups where current user has active membership ────────────────

export function useCurrentUserActiveGroupIds() {
  const [membershipsData, result] = useQuery(queries.groups.currentUserMembershipsWithGroups({}));

  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const activeGroupIds = useMemo(() => {
    if (memberships.length === 0) return new Set<string>();

    const ids = new Set<string>();
    for (const membership of memberships) {
      const status = membership.status;
      if (status !== 'active' && status !== 'admin' && status !== 'member') {
        continue;
      }

      if (membership.group_id) {
        ids.add(membership.group_id);
      }
    }

    return ids;
  }, [memberships]);

  return {
    activeGroupIds,
    isLoading: result.type === 'unknown',
  };
}

// ── Groups where current user can manage events ─────────────────────

export function useUserGroupsWithManageEvents() {
  const [membershipsData, result] = useQuery(queries.groups.currentUserMembershipsWithRights({}));

  const memberships = useMemo(() => normalizeMemberships(membershipsData), [membershipsData]);

  const manageEventGroupIds = useMemo(() => {
    if (memberships.length === 0) return new Set<string>();
    const ids = new Set<string>();
    for (const m of memberships) {
      // Only consider active memberships (member/admin)
      const status = m.status;
      if (status !== 'active' && status !== 'admin') continue;

      const role = m.role;
      if (!role?.action_rights) continue;
      const canManage = role.action_rights.some(
        ar => ar.resource === 'events' && (ar.action === 'manage' || ar.action === 'create')
      );
      if (canManage && m.group_id) {
        ids.add(m.group_id);
      }
    }
    return ids;
  }, [memberships]);

  return {
    manageEventGroupIds,
    isLoading: result.type === 'unknown',
  };
}
