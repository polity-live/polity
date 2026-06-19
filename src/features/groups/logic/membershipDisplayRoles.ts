import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';

interface RoleHolderHistoryLike {
  user_id?: string | null;
  end_date?: number | null;
}

type RoleWithHolderHistory<TRole extends ParticipationRoleLike> = TRole & {
  scope?: string | null;
  holder_history?: readonly RoleHolderHistoryLike[] | null;
  holders?: readonly RoleHolderHistoryLike[] | null;
};

export function sortGroupRoles<TRole extends ParticipationRoleLike>(roles: readonly TRole[]) {
  return [...roles].sort(
    (left, right) =>
      (right.sort_order ?? -1) - (left.sort_order ?? -1) ||
      (left.name ?? '').localeCompare(right.name ?? '', undefined, { sensitivity: 'base' })
  );
}

function dedupeRolesById<TRole extends ParticipationRoleLike>(roles: readonly TRole[]) {
  const roleById = new Map<string, TRole>();

  for (const role of roles) {
    if (!roleById.has(role.id)) {
      roleById.set(role.id, role);
    }
  }

  return [...roleById.values()];
}

export function getMembershipAssignedRoles<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>
): TRole[] {
  const roles = membership.roles?.length
    ? membership.roles
    : membership.role
      ? [membership.role]
      : [];

  return sortGroupRoles(dedupeRolesById(roles));
}

export function getMembershipDisplayRoles<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>
): TRole[] {
  return sortGroupRoles(
    dedupeRolesById([
      ...getMembershipAssignedRoles(membership),
      ...(membership.elected_roles ?? []),
    ])
  );
}

export function hasElectedDisplayRole<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>,
  roleId: string
) {
  return Boolean(membership.elected_roles?.some(role => role.id === roleId));
}

export function augmentMembershipsWithCurrentRoleHolders<
  TMembership extends ParticipationLike<TRole>,
  TRole extends ParticipationRoleLike,
>(
  memberships: readonly TMembership[],
  roles: readonly RoleWithHolderHistory<TRole>[]
): TMembership[] {
  const electedRolesByUserId = new Map<string, TRole[]>();

  for (const role of roles) {
    if (role.assignment_mode !== 'elected' || role.scope !== 'group') {
      continue;
    }

    const holderHistory = role.holder_history ?? role.holders ?? [];
    for (const holder of holderHistory) {
      if (!holder.user_id || holder.end_date != null) {
        continue;
      }

      const userRoles = electedRolesByUserId.get(holder.user_id) ?? [];
      userRoles.push(role);
      electedRolesByUserId.set(holder.user_id, userRoles);
    }
  }

  if (electedRolesByUserId.size === 0) {
    return [...memberships];
  }

  return memberships.map(membership => {
    const userId = membership.user?.id ?? membership.user_id;
    const electedRoles = userId ? electedRolesByUserId.get(userId) : undefined;

    if (!electedRoles?.length) {
      return membership;
    }

    return {
      ...membership,
      elected_roles: sortGroupRoles(
        dedupeRolesById([...(membership.elected_roles ?? []), ...electedRoles])
      ),
    };
  });
}

export function getMembershipRoleSummary<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>
) {
  const roleNames = getMembershipDisplayRoles(membership)
    .map(role => role.name || 'Role')
    .filter(Boolean);

  return roleNames.length > 0 ? roleNames.join(', ') : 'Member';
}
