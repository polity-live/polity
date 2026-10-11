import { applyTutorialRunOwnerQueryAccess } from '../rbac/query-access';
import { studioProjectCollaborativeAccess } from '../communication-studio/access';
import { whereAnyOf } from '../shared/query-conditions';

// The same relationship predicate protects replication and server commands.
// Public entity visibility and former conversation participation grant no access.
export function projectGroupAccess(q: any, userID: string, planPerGroup = false): any {
  return applyTutorialRunOwnerQueryAccess(q, userID).where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists(
        'memberships',
        (m: any) => whereAnyOf(m.where('user_id', userID), 'status', ['active', 'member', 'admin']),
        { flip: planPerGroup ? false : undefined }
      )
    )
  );
}
export function studioChatAccess(q: any, userID: string): any {
  return studioProjectCollaborativeAccess(q, userID);
}
export function amendmentChatAccess(q: any, userID: string, planPerAmendment = false): any {
  return (applyTutorialRunOwnerQueryAccess(q, userID) as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists(
        'collaborators',
        (c: any) =>
          whereAnyOf(c.where('user_id', userID), 'status', [
            'active',
            'collaborator',
            'member',
            'admin',
          ]),
        { flip: planPerAmendment ? false : undefined }
      ),
      exists('group', (g: any) => projectGroupAccess(g, userID, planPerAmendment), {
        flip: planPerAmendment ? false : undefined,
      }),
      exists(
        'document',
        (d: any) =>
          d.whereExists(
            'collaborators',
            (c: any) =>
              whereAnyOf(c.where('user_id', userID), 'status', [
                'active',
                'collaborator',
                'member',
                'admin',
              ]),
            { flip: planPerAmendment ? false : undefined }
          ),
        { flip: planPerAmendment ? false : undefined }
      )
    )
  );
}
export function projectConversationAccess<T>(
  target: T,
  userID: string,
  planPerConversation = false
): T {
  const q = target as any;
  const plan = planPerConversation ? { flip: false } : undefined;
  if (!userID || userID === 'anon') return q.where('id', '__unauthorized__');
  return q.where('type', 'project_ai').where(({ or, exists }: any) =>
    or(
      exists('studio_project', (p: any) => studioChatAccess(p, userID), plan),
      exists('amendment', (a: any) => amendmentChatAccess(a, userID, planPerConversation), plan)
    )
  );
}
