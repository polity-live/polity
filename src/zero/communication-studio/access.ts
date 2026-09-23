const activeMemberships = ['active', 'member', 'admin'];

export function groupProjectsAccess<T>(group: T, actor: string, edit = false): T {
  return (group as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', actor),
      exists('memberships', (membership: any) =>
        membership
          .where('user_id', actor)
          .where('status', 'IN', activeMemberships)
          .whereExists('membership_roles', (assignment: any) =>
            assignment.whereExists('role', (role: any) =>
              role.whereExists('group_action_rights', (right: any) =>
                right
                  .where('resource', 'projects')
                  .where('action', 'IN', edit ? ['manage'] : ['view', 'manage'])
              )
            )
          )
      )
    )
  ) as T;
}

export function studioProjectReadAccess<T>(project: T, actor: string): T {
  return (project as any).where(({ or, and, cmp, exists }: any) =>
    or(
      and(
        cmp('group_id', 'IS', null),
        or(
          cmp('owner_id', actor),
          exists('collaborators', (collaborator: any) =>
            collaborator.where('user_id', actor).where('status', 'active')
          )
        )
      ),
      and(
        cmp('group_id', 'IS NOT', null),
        or(
          cmp('owner_id', actor),
          exists('group', (group: any) => groupProjectsAccess(group, actor))
        )
      )
    )
  ) as T;
}
