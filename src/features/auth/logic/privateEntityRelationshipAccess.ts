type RelationshipStatus = string | null | undefined;

const ACTIVE_GROUP_MEMBER_STATUSES = new Set(['active', 'member', 'admin']);
const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set(['active', 'confirmed', 'member', 'admin']);
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = new Set(['collaborator', 'member', 'admin']);
const ACTIVE_BLOG_BLOGGER_STATUSES = new Set(['owner', 'admin', 'member']);

function hasActiveRelationship(
  statuses: readonly RelationshipStatus[],
  activeStatuses: ReadonlySet<string>
): boolean {
  return statuses.some(status => status != null && activeStatuses.has(status));
}

export function hasPrivateGroupRouteAccess(
  ownerId: string | null | undefined,
  userId: string | null | undefined,
  membershipStatuses: readonly RelationshipStatus[]
): boolean {
  if (!userId) {
    return false;
  }

  return (
    ownerId === userId || hasActiveRelationship(membershipStatuses, ACTIVE_GROUP_MEMBER_STATUSES)
  );
}

export function hasPrivateAmendmentRouteAccess(
  createdById: string | null | undefined,
  userId: string | null | undefined,
  collaboratorStatuses: readonly RelationshipStatus[]
): boolean {
  if (!userId) {
    return false;
  }

  return (
    createdById === userId ||
    hasActiveRelationship(collaboratorStatuses, ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
  );
}

export function hasPrivateEventRouteAccess(
  creatorId: string | null | undefined,
  userId: string | null | undefined,
  participantStatuses: readonly RelationshipStatus[]
): boolean {
  if (!userId) {
    return false;
  }

  return (
    creatorId === userId ||
    hasActiveRelationship(participantStatuses, ACTIVE_EVENT_PARTICIPANT_STATUSES)
  );
}

export function hasPrivateBlogRouteAccess(
  userId: string | null | undefined,
  bloggerStatuses: readonly RelationshipStatus[]
): boolean {
  if (!userId) {
    return false;
  }

  return hasActiveRelationship(bloggerStatuses, ACTIVE_BLOG_BLOGGER_STATUSES);
}
