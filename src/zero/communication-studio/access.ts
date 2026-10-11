import { whereAnyOf } from '../shared/query-conditions';
import {
  applyEventStudioManagerQueryAccess,
  applyEventQueryAccess,
  isAuthenticatedUserId,
} from '../rbac/query-access';

const activeMemberships = ['active', 'member', 'admin'];

export function groupProjectsAccess<T>(group: T, actor: string, edit = false): T {
  return (group as any).where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', actor),
      exists(
        'memberships',
        (membership: any) =>
          (
            whereAnyOf(membership.where('user_id', actor), 'status', activeMemberships) as any
          ).whereExists(
            'membership_roles',
            (assignment: any) =>
              assignment.whereExists(
                'studio_project_rights',
                (right: any) =>
                  whereAnyOf(
                    right.where('resource', 'projects'),
                    'action',
                    edit ? ['manage'] : ['view', 'manage']
                  ),
                { flip: false }
              ),
            { flip: false }
          ),
        { flip: false }
      )
    )
  ) as T;
}

function nonEventCollaborativePredicate(actor: string, { or, and, cmp, exists }: any) {
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

function collaborativePredicate(actor: string, helpers: any) {
  return helpers.or(
    helpers.exists('event', (event: any) => applyEventStudioManagerQueryAccess(event, actor), {
      flip: false,
    }),
    helpers.and(helpers.cmp('event_id', 'IS', null), nonEventCollaborativePredicate(actor, helpers))
  );
}

/** Internal workspaces, export jobs and AI conversations are never public. */
export function studioProjectCollaborativeAccess<T>(project: T, actor: string): T {
  return (project as any).where((helpers: any) => collaborativePredicate(actor, helpers)) as T;
}

export function studioProjectReadAccess<T>(project: T, actor: string | null): T {
  const viewer = isAuthenticatedUserId(actor) ? actor : null;
  return (project as any).where((helpers: any) =>
    helpers.or(
      helpers.exists('event', (event: any) => applyEventQueryAccess(event, viewer), {
        flip: false,
      }),
      helpers.and(
        helpers.cmp('event_id', 'IS', null),
        helpers.or(
          helpers.cmp('visibility', 'public'),
          ...(viewer
            ? [
                helpers.cmp('visibility', 'authenticated'),
                nonEventCollaborativePredicate(viewer, helpers),
              ]
            : [])
        )
      )
    )
  ) as T;
}
