import { applyTutorialRunOwnerQueryAccess } from '../rbac/query-access';

// The same relationship predicate protects replication and server commands.
// Public entity visibility and former conversation participation grant no access.
export function projectGroupAccess(q: any, userID: string): any {
  return applyTutorialRunOwnerQueryAccess(q, userID).where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists('memberships', (m: any) =>
        m.where('user_id', userID).where('status', 'IN', ['active', 'member', 'admin'])
      )
    )
  );
}
export function studioChatAccess(q: any, userID: string): any {
  return q.where(({ or, and, cmp, exists }: any) =>
    or(
      and(
        cmp('group_id', 'IS', null),
        or(
          cmp('owner_id', userID),
          and(
            cmp('kind', '!=', 'whiteboard'),
            exists('collaborators', (c: any) =>
              c.where('user_id', userID).where('status', 'active')
            )
          )
        )
      ),
      exists('group', (g: any) => projectGroupAccess(g, userID))
    )
  );
}
export function amendmentChatAccess(q: any, userID: string): any {
  return (applyTutorialRunOwnerQueryAccess(q, userID) as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists('collaborators', (c: any) =>
        c
          .where('user_id', userID)
          .where('status', 'IN', ['active', 'collaborator', 'member', 'admin'])
      ),
      exists('group', (g: any) => projectGroupAccess(g, userID)),
      exists('document', (d: any) =>
        d.whereExists('collaborators', (c: any) =>
          c
            .where('user_id', userID)
            .where('status', 'IN', ['active', 'collaborator', 'member', 'admin'])
        )
      )
    )
  );
}
export function projectConversationAccess<T>(target: T, userID: string): T {
  const q = target as any;
  if (!userID || userID === 'anon') return q.where('id', '__unauthorized__');
  return q.where('type', 'project_ai').where(({ or, exists }: any) =>
    or(
      exists('studio_project', (p: any) => studioChatAccess(p, userID)),
      exists('amendment', (a: any) => amendmentChatAccess(a, userID))
    )
  );
}
