import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';

export function sortGroupRoles<TRole extends ParticipationRoleLike>(roles: readonly TRole[]) {
  return [...roles].sort(
    (left, right) =>
      (right.sort_order ?? -1) - (left.sort_order ?? -1) ||
      (left.name ?? '').localeCompare(right.name ?? '', undefined, { sensitivity: 'base' })
  );
}

export function getMembershipDisplayRoles<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>
): TRole[] {
  const roles = membership.roles?.length
    ? membership.roles
    : membership.role
      ? [membership.role]
      : [];

  return sortGroupRoles(roles);
}

export function getMembershipRoleSummary<TRole extends ParticipationRoleLike>(
  membership: ParticipationLike<TRole>
) {
  const roleNames = getMembershipDisplayRoles(membership)
    .map(role => role.name || 'Role')
    .filter(Boolean);

  return roleNames.length > 0 ? roleNames.join(', ') : 'Member';
}
