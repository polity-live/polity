/**
 * Hook for searching and filtering memberships
 */

import { useMemo } from 'react';
import {
  getMembershipDisplayRoles,
  getMembershipRoleSummary,
} from '../logic/buildMembershipRightsSummary';
import type { ParticipationLike } from '@/features/shared/types/participation';
import type { MembershipSort } from '../types/group.types';

interface UseMembershipSearchOptions {
  activeStatuses?: string[];
  activeRoleNames?: string[];
}

export function useMembershipSearch<TMembership extends ParticipationLike>(
  memberships: TMembership[],
  searchQuery: string,
  sort: MembershipSort,
  options: UseMembershipSearchOptions = {}
) {
  const activeStatuses = useMemo(
    () =>
      new Set((options.activeStatuses || ['active', 'member']).map(status => status.toLowerCase())),
    [options.activeStatuses]
  );
  const activeRoleNames = useMemo(
    () =>
      new Set(
        (options.activeRoleNames || ['Board Member']).map(roleName => roleName.toLowerCase())
      ),
    [options.activeRoleNames]
  );

  const filteredMemberships = useMemo(() => {
    if (!searchQuery.trim()) return memberships;

    const query = searchQuery.toLowerCase();
    return memberships.filter(membership => {
      const userName = [membership.user?.first_name, membership.user?.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const userHandle = membership.user?.handle?.toLowerCase() || '';
      const role = getMembershipRoleSummary(membership).toLowerCase();
      const status = membership.status?.toLowerCase() || '';
      return (
        userName.includes(query) ||
        userHandle.includes(query) ||
        role.includes(query) ||
        status.includes(query)
      );
    });
  }, [memberships, searchQuery]);

  const sortMemberships = useMemo(() => {
    return (items: TMembership[]) =>
      [...items].sort((left, right) => compareMemberships(left, right, sort));
  }, [sort]);

  const pendingRequests = useMemo(
    () =>
      sortMemberships(
        filteredMemberships.filter(m => m.status === 'pending' || m.status === 'requested')
      ),
    [filteredMemberships, sortMemberships]
  );

  const activeMembers = useMemo(
    () =>
      sortMemberships(
        filteredMemberships.filter(m => {
          const status = m.status?.toLowerCase() || '';
          if (activeStatuses.has(status)) {
            return true;
          }

          return getMembershipDisplayRoles(m).some(role =>
            activeRoleNames.has((role.name || '').toLowerCase())
          );
        })
      ),
    [activeRoleNames, activeStatuses, filteredMemberships, sortMemberships]
  );

  const pendingInvitations = useMemo(
    () => sortMemberships(filteredMemberships.filter(m => m.status === 'invited')),
    [filteredMemberships, sortMemberships]
  );

  return {
    filteredMemberships,
    pendingRequests,
    activeMembers,
    pendingInvitations,
  };
}

function compareMemberships(
  left: ParticipationLike,
  right: ParticipationLike,
  sort: MembershipSort
) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  const leftUserName = getMembershipUserName(left);
  const rightUserName = getMembershipUserName(right);

  if (sort.field === 'role') {
    const roleComparison = getMembershipRoleSummary(left).localeCompare(
      getMembershipRoleSummary(right),
      undefined,
      { sensitivity: 'base' }
    );

    if (roleComparison !== 0) {
      return roleComparison * direction;
    }
  }

  return leftUserName.localeCompare(rightUserName, undefined, { sensitivity: 'base' }) * direction;
}

function getMembershipUserName(membership: ParticipationLike) {
  const fullName = [membership.user?.first_name, membership.user?.last_name]
    .filter(Boolean)
    .join(' ');
  return fullName || membership.user?.handle || 'Unknown User';
}
