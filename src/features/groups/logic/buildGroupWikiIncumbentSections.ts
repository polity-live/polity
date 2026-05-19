import {
  buildWikiIncumbentCarouselSections,
  type WikiIncumbentRoleCards,
} from '@/features/shared/logic/wikiIncumbentSections';

export function buildGroupWikiIncumbentSections(
  roles: readonly GroupRoleLike[],
  memberships: readonly GroupMembershipRoleLike[]
) {
  const normalizedRoles: WikiIncumbentRoleCards[] = roles
    .filter(role => role.visibility === 'public')
    .map(role => {
      const assignees = new Map<string, VisibleAssignee>();

      memberships.forEach(membership => {
        const membershipRoleIds = membership.roles?.length
          ? membership.roles.map(assignedRole => assignedRole.id).filter(Boolean)
          : membership.role?.id
            ? [membership.role.id]
            : [];

        if (
          membership.status !== 'active' ||
          !membershipRoleIds.includes(role.id) ||
          !membership.user?.id
        ) {
          return;
        }

        assignees.set(membership.user.id, {
          id: membership.user.id,
          name:
            [membership.user.first_name, membership.user.last_name].filter(Boolean).join(' ') ||
            membership.user.handle ||
            'Unknown',
          handle: membership.user.handle ?? null,
          avatar: membership.user.avatar ?? null,
        });
      });

      role.holder_history?.forEach(entry => {
        if (entry.end_date || !entry.user?.id) {
          return;
        }

        assignees.set(entry.user.id, {
          id: entry.user.id,
          name:
            [entry.user.first_name, entry.user.last_name].filter(Boolean).join(' ') ||
            entry.user.handle ||
            'Unknown',
          handle: entry.user.handle ?? null,
          avatar: entry.user.avatar ?? null,
        });
      });

      const title = role.title?.trim() || 'Untitled role';
      const description = role.description?.trim() || null;
      const cards = Array.from(assignees.values()).map(assignee => ({
        kind: 'person' as const,
        id: `${role.id}:${assignee.id}`,
        userId: assignee.id,
        name: assignee.name,
        handle: assignee.handle,
        avatar: assignee.avatar,
        roleId: role.id,
        roleTitle: title,
        roleDescription: description,
      }));

      return {
        id: role.id,
        title,
        description,
        assigneeCount: cards.length,
        cards:
          cards.length > 0
            ? cards
            : [
                {
                  kind: 'vacancy' as const,
                  id: `${role.id}:vacancy`,
                  roleId: role.id,
                  roleTitle: title,
                  roleDescription: description,
                },
              ],
      };
    });

  return buildWikiIncumbentCarouselSections(normalizedRoles);
}

interface VisibleAssignee {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
}

interface GroupWikiUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
}

interface GroupWikiHistoryLike {
  end_date?: number | null;
  user?: GroupWikiUserLike | null;
}

interface GroupRoleLike {
  id: string;
  title?: string | null;
  description?: string | null;
  visibility?: string | null;
  holder_history?: readonly GroupWikiHistoryLike[] | null;
}

interface GroupMembershipRoleLike {
  status?: string | null;
  role?: { id?: string | null } | null;
  roles?: readonly { id?: string | null }[] | null;
  user?: GroupWikiUserLike | null;
}
