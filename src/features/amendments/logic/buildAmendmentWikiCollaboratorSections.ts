import {
  buildWikiIncumbentCarouselSections,
  type WikiIncumbentRoleCards,
} from '@/features/shared/logic/wikiIncumbentSections';

export function buildAmendmentWikiCollaboratorSections(
  roles: readonly AmendmentRoleLike[],
  collaborators: readonly AmendmentCollaboratorLike[]
) {
  const visibleRoles = roles.filter(role => role.visibility !== 'private');
  const roleLookup = new Map(visibleRoles.map(role => [role.id, role]));
  const activeCollaborators = collaborators.filter(
    collaborator =>
      ['active', 'member', 'admin'].includes(collaborator.status ?? '') && collaborator.user?.id
  );

  const normalizedRoles: WikiIncumbentRoleCards[] = visibleRoles.map(role => {
    const title = role.name?.trim() || 'Untitled role';
    const description = role.description?.trim() || null;
    const assignees = activeCollaborators
      .filter(collaborator => collaborator.role_id === role.id)
      .map(collaborator => {
        const user = collaborator.user;
        if (!user?.id) {
          return null;
        }

        return {
          kind: 'person' as const,
          id: `${role.id}:${user.id}`,
          userId: user.id,
          name:
            `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.handle || 'Unknown',
          handle: user.handle ?? null,
          avatar: user.avatar ?? null,
          roleId: role.id,
          roleTitle: title,
          roleDescription: description,
        };
      })
      .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee));

    return {
      id: role.id,
      title,
      description,
      assigneeCount: assignees.length,
      cards:
        assignees.length > 0
          ? assignees
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

  const unassignedCollaborators = activeCollaborators
    .filter(collaborator => !collaborator.role_id || !roleLookup.has(collaborator.role_id))
    .map(collaborator => {
      const user = collaborator.user;
      if (!user?.id) {
        return null;
      }

      return {
        kind: 'person' as const,
        id: `unassigned:${user.id}`,
        userId: user.id,
        name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.handle || 'Unknown',
        handle: user.handle ?? null,
        avatar: user.avatar ?? null,
        roleId: 'unassigned-collaborators',
        roleTitle: 'Collaborators',
        roleDescription: null,
      };
    })
    .filter((collaborator): collaborator is NonNullable<typeof collaborator> =>
      Boolean(collaborator)
    );

  if (unassignedCollaborators.length > 0 || normalizedRoles.length === 0) {
    normalizedRoles.unshift({
      id: 'unassigned-collaborators',
      title: 'Collaborators',
      description: null,
      assigneeCount: unassignedCollaborators.length,
      cards:
        unassignedCollaborators.length > 0
          ? unassignedCollaborators
          : [
              {
                kind: 'vacancy' as const,
                id: 'unassigned-collaborators:vacancy',
                roleId: 'unassigned-collaborators',
                roleTitle: 'Collaborators',
                roleDescription: null,
              },
            ],
    });
  }

  return buildWikiIncumbentCarouselSections(normalizedRoles, {
    lowCountTitle: 'More roles & collaborators',
    lowCountDescription: 'Roles with fewer than 3 active collaborators, including vacant seats.',
  });
}

interface AmendmentRoleLike {
  id: string;
  name?: string | null;
  description?: string | null;
  visibility?: string | null;
}

interface AmendmentCollaboratorLike {
  status?: string | null;
  role_id?: string | null;
  user?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    avatar?: string | null;
  } | null;
}
