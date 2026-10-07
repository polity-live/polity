const activeMemberships = ['active', 'member', 'admin'];

export function groupProjectsAccess<T>(group: T, actor: string, edit = false): T {
  return (group as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', actor),
      exists(
        'memberships',
        (membership: any) =>
          membership
            .where('user_id', actor)
            .where('status', 'IN', activeMemberships)
            .whereExists(
              'membership_roles',
              (assignment: any) =>
                assignment.whereExists(
                  'studio_project_rights',
                  (right: any) =>
                    right
                      .where('resource', 'projects')
                      .where('action', 'IN', edit ? ['manage'] : ['view', 'manage']),
                  { flip: false }
                ),
              { flip: false }
            ),
        { flip: false }
      )
    )
  ) as T;
}

function collaborativePredicate(actor: string, { or, and, cmp, exists }: any) {
  return or(
    and(
      cmp('group_id', 'IS', null),
      or(
        cmp('owner_id', actor),
        exists(
          'collaborators',
          (collaborator: any) => collaborator.where('user_id', actor).where('status', 'active'),
          { flip: false }
        )
      )
    ),
    and(
      cmp('group_id', 'IS NOT', null),
      or(
        cmp('owner_id', actor),
        exists('group', (group: any) => groupProjectsAccess(group, actor), { flip: false })
      )
    )
  );
}

/** Internal workspaces, export jobs and AI conversations are never public. */
export function studioProjectCollaborativeAccess<T>(project: T, actor: string): T {
  return (project as any).where((helpers: any) => collaborativePredicate(actor, helpers)) as T;
}

export function studioProjectReadAccess<T>(project: T, actor: string | null): T {
  return (project as any).where((helpers: any) =>
    helpers.or(
      helpers.cmp('visibility', 'public'),
      ...(actor
        ? [helpers.cmp('visibility', 'authenticated'), collaborativePredicate(actor, helpers)]
        : [])
    )
  ) as T;
}
