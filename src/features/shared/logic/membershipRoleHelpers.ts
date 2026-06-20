interface MembershipRoleLike {
  id?: string | null;
  name?: string | null;
  sort_order?: number | null;
}

interface MembershipRoleLinkLike<TRole extends MembershipRoleLike = MembershipRoleLike> {
  role?: TRole | null;
}

export interface MembershipWithRoleLinks<TRole extends MembershipRoleLike = MembershipRoleLike> {
  membership_roles?: readonly MembershipRoleLinkLike<TRole>[] | null;
  participant_roles?: readonly MembershipRoleLinkLike<TRole>[] | null;
  roles?: readonly TRole[] | null;
  role?: TRole | null;
}

function sortMembershipRoles<TRole extends MembershipRoleLike>(roles: readonly TRole[]) {
  return [...roles].sort((left, right) => (right.sort_order ?? -1) - (left.sort_order ?? -1));
}

export function getMembershipRoles<TRole extends MembershipRoleLike>(
  membership: MembershipWithRoleLinks<TRole> | null | undefined
): TRole[] {
  if (!membership) {
    return [];
  }

  if (membership.roles?.length) {
    return sortMembershipRoles(membership.roles);
  }

  const roles: TRole[] = [];
  for (const link of [
    ...(membership.membership_roles ?? []),
    ...(membership.participant_roles ?? []),
  ]) {
    if (link.role) {
      roles.push(link.role);
    }
  }

  if (roles.length > 0) {
    return sortMembershipRoles(roles);
  }

  const fallbackRole = membership.role;
  return fallbackRole ? [fallbackRole] : [];
}

export function getPrimaryMembershipRole<TRole extends MembershipRoleLike>(
  membership: MembershipWithRoleLinks<TRole> | null | undefined
): TRole | null {
  return getMembershipRoles(membership)[0] ?? null;
}

export function getMembershipRoleNames<TRole extends MembershipRoleLike>(
  membership: MembershipWithRoleLinks<TRole> | null | undefined
): string[] {
  return getMembershipRoles(membership)
    .map(role => role.name?.trim() || '')
    .filter(Boolean);
}
