export function getGroupDatasetRights(
  group: Record<string, any> | null | undefined,
  userId?: string
) {
  if (!group || !userId) return { canViewDatasets: false, canManageDatasets: false };
  if (group.owner_id === userId) return { canViewDatasets: true, canManageDatasets: true };
  const activeMembershipStatuses = new Set(['active', 'member', 'admin']);
  const memberships = Array.isArray(group.memberships)
    ? group.memberships.filter(
        (membership: Record<string, any>) =>
          (membership.user_id === userId || membership.user?.id === userId) &&
          activeMembershipStatuses.has(membership.status)
      )
    : [];
  const guestAccesses = Array.isArray(group.guest_accesses)
    ? group.guest_accesses.filter(
        (access: Record<string, any>) =>
          (access.user_id === userId || access.user?.id === userId) && access.status === 'active'
      )
    : [];
  const roleLinks = [
    ...memberships.flatMap((membership: Record<string, any>) => membership.membership_roles ?? []),
    ...guestAccesses.flatMap((access: Record<string, any>) => access.guest_roles ?? []),
  ];
  const rights = roleLinks.flatMap((link: Record<string, any>) => link.role?.action_rights ?? []);
  const canManageDatasets = rights.some(
    (right: Record<string, any>) => right.resource === 'groupDatasets' && right.action === 'manage'
  );
  const canViewDatasets =
    memberships.length > 0 ||
    canManageDatasets ||
    rights.some(
      (right: Record<string, any>) => right.resource === 'groupDatasets' && right.action === 'view'
    );
  return { canViewDatasets, canManageDatasets };
}
