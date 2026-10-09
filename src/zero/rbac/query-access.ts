import { whereAnyOf } from '../shared/query-conditions';
import { VIEW_IMPLYING_ACTIONS } from './constants';

export function isAuthenticatedUserId(userID: string | undefined | null): userID is string {
  return Boolean(userID && userID !== 'anon');
}

export function denyAllRows<T>(q: T): T {
  return (q as any).where('id', '__unauthorized__') as T;
}

export function requireQueryUser<T>(q: T, userID: string | undefined | null, field = 'user_id'): T {
  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);
  return (q as any).where(field, userID) as T;
}

export function requireRequestedViewer<T>(
  q: T,
  requestedUserID: string,
  userID: string | undefined | null,
  field = 'user_id'
): T {
  if (!isAuthenticatedUserId(userID) || requestedUserID !== userID) return denyAllRows(q);
  return (q as any).where(field, userID) as T;
}

/**
 * Tutorial roots look like normal public/authenticated data to the rest of the
 * product, but may only be replicated to the owner of their still-open run.
 */
export function applyTutorialRunOwnerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;
  if (!isAuthenticatedUserId(userID)) {
    return query.where('tutorial_run_id', 'IS', null) as T;
  }
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('tutorial_run_id', 'IS', null),
      exists(
        'tutorial_run',
        (run: any) => whereAnyOf(run.where('user_id', userID), 'status', ['active', 'paused']),
        { flip: false }
      )
    )
  ) as T;
}

export function applySearchDocumentQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      exists('acl', (acl: any) => acl.where('user_id', userID))
    )
  ) as T;
}

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];
const ACTIVE_GROUP_GUEST_ACCESS_STATUSES = ['active'];
const GROUP_DISCOVERY_MEMBERSHIP_STATUSES = ['invited', ...ACTIVE_GROUP_MEMBERSHIP_STATUSES];
const GROUP_DISCOVERY_GUEST_ACCESS_STATUSES = ['invited', ...ACTIVE_GROUP_GUEST_ACCESS_STATUSES];
const GROUP_VIEW_ACTIONS = ['view', 'manage'];
const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];
const EVENT_DISCOVERY_PARTICIPANT_STATUSES = ['invited', ...ACTIVE_EVENT_PARTICIPANT_STATUSES];
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];
const AMENDMENT_DISCOVERY_COLLABORATOR_STATUSES = [
  'invited',
  ...ACTIVE_AMENDMENT_COLLABORATOR_STATUSES,
];
const ACTIVE_BLOGGER_STATUSES = ['owner', 'admin', 'member', 'writer'];
const BLOG_DISCOVERY_BLOGGER_STATUSES = ['invited', 'admin', 'member', 'writer'];
const ENTITY_VIEW_ACTIONS = [...VIEW_IMPLYING_ACTIONS];

function applyGroupPrivateRelationshipQueryAccess<T>(q: T, userID: string): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          whereAnyOf(
            membership.where('user_id', userID),
            'status',
            ACTIVE_GROUP_MEMBERSHIP_STATUSES
          ),
        { flip: false }
      ),
      exists(
        'guest_accesses',
        (guestAccess: any) =>
          whereAnyOf(
            guestAccess.where('user_id', userID),
            'status',
            ACTIVE_GROUP_GUEST_ACCESS_STATUSES
          ),
        { flip: false }
      )
    )
  ) as T;
}

function applyEventPrivateRelationshipQueryAccess<T>(
  q: T,
  userID: string,
  planPerEntity = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerEntity ? { flip: false } : undefined;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists(
        'participants',
        (participant: any) =>
          whereAnyOf(
            participant.where('user_id', userID),
            'status',
            ACTIVE_EVENT_PARTICIPANT_STATUSES
          ),
        plan
      ),
      exists('group', (group: any) => applyGroupPrivateRelationshipQueryAccess(group, userID), plan)
    )
  ) as T;
}

function applyAmendmentPrivateRelationshipQueryAccess<T>(
  q: T,
  userID: string,
  planPerEntity = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerEntity ? { flip: false } : undefined;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists(
        'collaborators',
        (collaborator: any) =>
          whereAnyOf(
            collaborator.where('user_id', userID),
            'status',
            ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
          ),
        plan
      ),
      exists(
        'group',
        (group: any) => applyGroupPrivateRelationshipQueryAccess(group, userID),
        plan
      ),
      exists(
        'event',
        (event: any) =>
          event.whereExists(
            'participants',
            (participant: any) =>
              whereAnyOf(
                participant.where('user_id', userID),
                'status',
                ACTIVE_EVENT_PARTICIPANT_STATUSES
              ),
            plan
          ),
        plan
      )
    )
  ) as T;
}

export function applyUserQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('id', userID)
    )
  ) as T;
}

export function applyGroupQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planPerGroup = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerGroup ? { flip: false } : undefined;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          whereAnyOf(
            membership.where('user_id', userID),
            'status',
            ACTIVE_GROUP_MEMBERSHIP_STATUSES
          ),
        plan
      ),
      exists(
        'guest_accesses',
        (guestAccess: any) =>
          whereAnyOf(
            guestAccess.where('user_id', userID),
            'status',
            ACTIVE_GROUP_GUEST_ACCESS_STATUSES
          ),
        plan
      )
    )
  ) as T;
}

function applyGroupRoleRightAccess<T>(
  q: T,
  userID: string | undefined | null,
  actions: readonly string[],
  resources: readonly string[],
  membershipStatuses: readonly string[] = ACTIVE_GROUP_MEMBERSHIP_STATUSES,
  guestAccessStatuses: readonly string[] = ACTIVE_GROUP_GUEST_ACCESS_STATUSES,
  includeStandardVisibility = false
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      ...(includeStandardVisibility
        ? [or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated'))]
        : []),
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          whereAnyOf(membership.where('user_id', userID), 'status', membershipStatuses).whereExists(
            'membership_roles',
            (membershipRole: any) =>
              membershipRole.whereExists(
                'role',
                (role: any) =>
                  role
                    .where('scope', 'group')
                    .whereExists(
                      'action_rights',
                      (right: any) =>
                        whereAnyOf(whereAnyOf(right, 'resource', resources), 'action', actions),
                      { flip: false }
                    ),
                { flip: false }
              ),
            { flip: false }
          ),
        { flip: false }
      ),
      exists(
        'guest_accesses',
        (guestAccess: any) =>
          whereAnyOf(
            guestAccess.where('user_id', userID),
            'status',
            guestAccessStatuses
          ).whereExists(
            'guest_roles',
            (guestRole: any) =>
              guestRole.whereExists(
                'role',
                (role: any) =>
                  role
                    .where('scope', 'group')
                    .whereExists(
                      'action_rights',
                      (right: any) =>
                        whereAnyOf(whereAnyOf(right, 'resource', resources), 'action', actions),
                      { flip: false }
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

/**
 * Visibility for a private group is deliberately narrower than access to its
 * private child content. A viewer needs a valid relationship and the group's
 * own view right; an invitation alone never exposes private child entities.
 */
export function applyGroupDiscoveryQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as T;

  if (!isAuthenticatedUserId(userID)) {
    return (query as any).where('visibility', 'public') as T;
  }

  return applyGroupRoleRightAccess(
    query,
    userID,
    GROUP_VIEW_ACTIONS,
    ['groups'],
    GROUP_DISCOVERY_MEMBERSHIP_STATUSES,
    GROUP_DISCOVERY_GUEST_ACCESS_STATUSES,
    true
  );
}

export function applyGroupManagerQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  action:
    | 'manage'
    | 'manage_members'
    | 'manage_relationships'
    | 'manage_roles'
    | 'viewNotifications' = 'manage',
  resources: readonly string[] = ['groups']
): T {
  const actions = action === 'manage' ? ['manage'] : ['manage', action];
  return applyGroupRoleRightAccess(q, userID, actions, resources);
}

export function applyGroupMembershipSelfOrManagerQueryAccess<T>(
  q: T,
  userID: string | undefined | null
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists(
        'group',
        (group: any) =>
          applyGroupManagerQueryAccess(group, userID, 'manage_members', [
            'groups',
            'groupMemberships',
          ]),
        { flip: false }
      )
    )
  ) as T;
}

export function applyEventQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('creator_id', userID),
      exists(
        'roles',
        (role: any) =>
          role
            .where('scope', 'event')
            .whereExists(
              'event_participant_roles',
              (participantRole: any) =>
                participantRole.whereExists(
                  'event_participant',
                  (participant: any) =>
                    whereAnyOf(
                      participant.where('user_id', userID),
                      'status',
                      EVENT_DISCOVERY_PARTICIPANT_STATUSES
                    ),
                  { flip: false }
                ),
              { flip: false }
            )
            .whereExists(
              'event_action_rights',
              (right: any) =>
                whereAnyOf(right.where('resource', 'events'), 'action', ENTITY_VIEW_ACTIONS),
              { flip: false }
            ),
        { flip: false }
      ),
      exists(
        'group',
        (group: any) =>
          group.where(({ or, cmp, exists }: any) =>
            or(
              cmp('owner_id', userID),
              exists(
                'memberships',
                (membership: any) =>
                  whereAnyOf(
                    membership.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                  ),
                { flip: false }
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  whereAnyOf(
                    guestAccess.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                  ),
                { flip: false }
              )
            )
          ),
        { flip: false }
      )
    )
  ) as T;
}

function applyEventRoleRightAccess<T>(
  q: T,
  userID: string | undefined | null,
  actions: readonly string[],
  resources: readonly string[] = ['events']
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists(
        'roles',
        (role: any) =>
          role
            .where('scope', 'event')
            .whereExists(
              'event_participant_roles',
              (participantRole: any) =>
                participantRole.whereExists(
                  'event_participant',
                  (participant: any) =>
                    whereAnyOf(
                      participant.where('user_id', userID),
                      'status',
                      ACTIVE_EVENT_PARTICIPANT_STATUSES
                    ),
                  { flip: false }
                ),
              { flip: false }
            )
            .whereExists(
              'event_action_rights',
              (right: any) =>
                whereAnyOf(whereAnyOf(right, 'resource', resources), 'action', actions),
              { flip: false }
            ),
        { flip: false }
      )
    )
  ) as T;
}

export function applyEventManagerQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  action: 'manage' | 'manage_participants' | 'manage_speakers' | 'manage_votes' = 'manage'
): T {
  const actions = action === 'manage' ? ['manage'] : ['manage', action];
  return applyEventRoleRightAccess(q, userID, actions);
}

export function applyEventParticipantOrManagerQueryAccess<T>(
  q: T,
  userID: string | undefined | null
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists(
        'event',
        (event: any) => applyEventManagerQueryAccess(event, userID, 'manage_participants'),
        { flip: false }
      )
    )
  ) as T;
}

export function applyAmendmentQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('created_by_id', userID),
      exists(
        'roles',
        (role: any) =>
          role
            .where('scope', 'amendment')
            .whereExists(
              'amendment_collaborators',
              (collaborator: any) =>
                whereAnyOf(
                  collaborator.where('user_id', userID),
                  'status',
                  AMENDMENT_DISCOVERY_COLLABORATOR_STATUSES
                ),
              { flip: false }
            )
            .whereExists(
              'amendment_action_rights',
              (right: any) =>
                whereAnyOf(right.where('resource', 'amendments'), 'action', ENTITY_VIEW_ACTIONS),
              { flip: false }
            ),
        { flip: false }
      ),
      exists(
        'group',
        (group: any) =>
          group.where(({ or, cmp, exists }: any) =>
            or(
              cmp('owner_id', userID),
              exists(
                'memberships',
                (membership: any) =>
                  whereAnyOf(
                    membership.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                  ),
                { flip: false }
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  whereAnyOf(
                    guestAccess.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                  ),
                { flip: false }
              )
            )
          ),
        { flip: false }
      ),
      exists(
        'event',
        (event: any) =>
          event.whereExists(
            'participants',
            (participant: any) =>
              whereAnyOf(
                participant.where('user_id', userID),
                'status',
                ACTIVE_EVENT_PARTICIPANT_STATUSES
              ),
            { flip: false }
          ),
        { flip: false }
      )
    )
  ) as T;
}

export function applyChangeRequestVisibilityAccess<T>(
  q: T,
  userID: string | undefined | null,
  planPerRequest = false
): T {
  const query = q as any;
  const plan = planPerRequest ? { flip: false } : undefined;

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility_scope', 'IS', null),
      cmp('visibility_scope', 'public'),
      isAuthenticatedUserId(userID)
        ? exists(
            'amendment',
            (amendment: any) =>
              amendment.whereExists(
                'collaborators',
                (collaborator: any) =>
                  whereAnyOf(
                    collaborator.where('user_id', userID),
                    'status',
                    ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
                  ),
                plan
              ),
            plan
          )
        : cmp('visibility_scope', '__public_only__')
    )
  ) as T;
}

export function applyBlogQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planPerBlog = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerBlog ? { flip: false } : undefined;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      exists(
        'bloggers',
        (blogger: any) => blogger.where('user_id', userID).where('status', 'owner'),
        plan
      ),
      exists(
        'roles',
        (role: any) =>
          role
            .where('scope', 'blog')
            .whereExists(
              'bloggers',
              (blogger: any) =>
                whereAnyOf(
                  blogger.where('user_id', userID),
                  'status',
                  BLOG_DISCOVERY_BLOGGER_STATUSES
                ),
              plan
            )
            .whereExists(
              'blog_action_rights',
              (right: any) =>
                whereAnyOf(right.where('resource', 'blogs'), 'action', ENTITY_VIEW_ACTIONS),
              plan
            ),
        plan
      ),
      exists(
        'group',
        (group: any) =>
          group.where(({ or, cmp, exists }: any) =>
            or(
              cmp('owner_id', userID),
              exists(
                'memberships',
                (membership: any) =>
                  whereAnyOf(
                    membership.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                  ),
                plan
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  whereAnyOf(
                    guestAccess.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                  ),
                plan
              )
            )
          ),
        plan
      )
    )
  ) as T;
}

export function applyBlogManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;
  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, exists }: any) =>
    or(
      exists('bloggers', (blogger: any) =>
        whereAnyOf(blogger.where('user_id', userID), 'status', ['owner', 'admin'])
      ),
      exists('roles', (role: any) =>
        role
          .where('scope', 'blog')
          .whereExists('bloggers', (blogger: any) =>
            whereAnyOf(blogger.where('user_id', userID), 'status', ACTIVE_BLOGGER_STATUSES)
          )
          .whereExists('blog_action_rights', (right: any) =>
            whereAnyOf(right, 'resource', ['blogs', 'blogBloggers']).where('action', 'manage')
          )
      )
    )
  ) as T;
}

export function applyStatementQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  now: number,
  planPerEntity = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerEntity ? { flip: false } : undefined;
  const activeQuery = isAuthenticatedUserId(userID)
    ? query.where(({ or, cmp }: any) =>
        or(cmp('expires_at', 'IS', null), cmp('expires_at', '>', now), cmp('user_id', userID))
      )
    : query.where(({ or, cmp }: any) =>
        or(cmp('expires_at', 'IS', null), cmp('expires_at', '>', now))
      );

  if (!isAuthenticatedUserId(userID)) {
    return activeQuery.where('visibility', 'public') as T;
  }

  return activeQuery.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('user_id', userID),
      exists(
        'group',
        (group: any) =>
          group.where(({ or, cmp, exists }: any) =>
            or(
              cmp('owner_id', userID),
              exists(
                'memberships',
                (membership: any) =>
                  whereAnyOf(
                    membership.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                  ),
                plan
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  whereAnyOf(
                    guestAccess.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                  ),
                plan
              )
            )
          ),
        plan
      )
    )
  ) as T;
}

export function applyTodoQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planPerEntity = false
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  const plan = planPerEntity ? { flip: false } : undefined;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('creator_id', userID),
      exists('assignments', (assignment: any) => assignment.where('user_id', userID), plan),
      exists(
        'group',
        (group: any) =>
          group.where(({ or, cmp, exists }: any) =>
            or(
              cmp('owner_id', userID),
              exists(
                'memberships',
                (membership: any) =>
                  whereAnyOf(
                    membership.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                  ),
                plan
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  whereAnyOf(
                    guestAccess.where('user_id', userID),
                    'status',
                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                  ),
                plan
              )
            )
          ),
        plan
      ),
      exists(
        'event',
        (event: any) => applyEventPrivateRelationshipQueryAccess(event, userID, planPerEntity),
        plan
      ),
      exists(
        'amendment',
        (amendment: any) =>
          applyAmendmentPrivateRelationshipQueryAccess(amendment, userID, planPerEntity),
        plan
      )
    )
  ) as T;
}

export function applyAgendaItemQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.whereExists('event', (event: any) => event.where('visibility', 'public'), {
      flip: false,
    }) as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists('event', (event: any) => applyEventQueryAccess(event, userID), { flip: false }),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID), {
        flip: false,
      })
    )
  ) as T;
}

export function applyElectionQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planAutomatically = false
): T {
  const query = q as any;
  const scopedQuery = query.where(({ or, exists }: any) =>
    or(
      exists('agenda_item', (agendaItem: any) => applyAgendaItemQueryAccess(agendaItem, userID), {
        flip: planAutomatically ? undefined : false,
      }),
      exists(
        'role',
        (role: any) =>
          role.where(({ or: roleOr, exists: roleExists }: any) =>
            roleOr(
              roleExists(
                'group',
                (group: any) => applyGroupQueryAccess(group, userID, !planAutomatically),
                { flip: planAutomatically ? undefined : false }
              ),
              roleExists('event', (event: any) => applyEventQueryAccess(event, userID), {
                flip: planAutomatically ? undefined : false,
              }),
              roleExists(
                'amendment',
                (amendment: any) => applyAmendmentQueryAccess(amendment, userID),
                { flip: planAutomatically ? undefined : false }
              ),
              // A correlated election must keep its nested blog access joins
              // correlated too; otherwise that branch still expands 128 plans.
              roleExists(
                'blog',
                (blog: any) => applyBlogQueryAccess(blog, userID, !planAutomatically),
                {
                  flip: planAutomatically ? undefined : false,
                }
              )
            )
          ),
        { flip: planAutomatically ? undefined : false }
      )
    )
  );

  return applyElectionVisibilityQueryAccess(scopedQuery, userID, planAutomatically);
}

/**
 * Only for an election projected through an agenda_item whose own
 * applyAgendaItemQueryAccess predicate has already been enforced. The
 * relationship guarantees election.agenda_item_id = agenda_item.id, so the
 * agenda branch of the election's scope predicate is already satisfied.
 * Its independent visibility/elector/private-access rules remain mandatory.
 */
export function applyElectionQueryAccessFromAuthorizedAgendaItem<T>(
  q: T,
  userID: string | undefined | null
): T {
  return applyElectionVisibilityQueryAccess(q, userID);
}

function applyElectionVisibilityQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planAutomatically = false
): T {
  const scopedQuery = q as any;
  if (!isAuthenticatedUserId(userID)) {
    return scopedQuery.where('visibility', 'public') as T;
  }

  return scopedQuery.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      exists('electors', (elector: any) => elector.where('user_id', userID), {
        flip: planAutomatically ? undefined : false,
      }),
      exists(
        'agenda_item',
        (agendaItem: any) =>
          agendaItem.where(({ or: itemOr, exists: itemExists }: any) =>
            itemOr(
              itemExists(
                'event',
                (event: any) =>
                  event.where(({ or: eventOr, cmp: eventCmp, exists: eventExists }: any) =>
                    eventOr(
                      eventCmp('creator_id', userID),
                      eventExists(
                        'participants',
                        (participant: any) =>
                          whereAnyOf(
                            participant.where('user_id', userID),
                            'status',
                            ACTIVE_EVENT_PARTICIPANT_STATUSES
                          ),
                        { flip: planAutomatically ? undefined : false }
                      ),
                      eventExists(
                        'group',
                        (group: any) =>
                          group.where(({ or: groupOr, cmp: groupCmp, exists: groupExists }: any) =>
                            groupOr(
                              groupCmp('owner_id', userID),
                              groupExists(
                                'memberships',
                                (membership: any) =>
                                  whereAnyOf(
                                    membership.where('user_id', userID),
                                    'status',
                                    ACTIVE_GROUP_MEMBERSHIP_STATUSES
                                  ),
                                { flip: planAutomatically ? undefined : false }
                              ),
                              groupExists(
                                'guest_accesses',
                                (guestAccess: any) =>
                                  whereAnyOf(
                                    guestAccess.where('user_id', userID),
                                    'status',
                                    ACTIVE_GROUP_GUEST_ACCESS_STATUSES
                                  ),
                                { flip: planAutomatically ? undefined : false }
                              )
                            )
                          ),
                        { flip: planAutomatically ? undefined : false }
                      )
                    )
                  ),
                { flip: planAutomatically ? undefined : false }
              ),
              itemExists(
                'amendment',
                (amendment: any) =>
                  amendment.where(
                    ({ or: amendmentOr, cmp: amendmentCmp, exists: amendmentExists }: any) =>
                      amendmentOr(
                        amendmentCmp('created_by_id', userID),
                        amendmentExists(
                          'collaborators',
                          (collaborator: any) =>
                            whereAnyOf(
                              collaborator.where('user_id', userID),
                              'status',
                              ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
                            ),
                          { flip: planAutomatically ? undefined : false }
                        )
                      )
                  ),
                { flip: planAutomatically ? undefined : false }
              )
            )
          ),
        { flip: planAutomatically ? undefined : false }
      )
    )
  ) as T;
}

export function applyDatasetQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      cmp('owner_user_id', userID),
      exists('group', (group: any) =>
        group.where(({ or: groupOr, cmp: groupCmp, exists: groupExists }: any) =>
          groupOr(
            groupCmp('owner_id', userID),
            groupExists('memberships', (membership: any) =>
              whereAnyOf(
                membership.where('user_id', userID),
                'status',
                ACTIVE_GROUP_MEMBERSHIP_STATUSES
              )
            ),
            groupExists('guest_accesses', (guestAccess: any) =>
              whereAnyOf(
                guestAccess.where('user_id', userID),
                'status',
                ACTIVE_GROUP_GUEST_ACCESS_STATUSES
              )
            )
          )
        )
      )
    )
  ) as T;
}

export function applyElectionManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.whereExists(
    'agenda_item',
    (agendaItem: any) =>
      agendaItem.whereExists(
        'event',
        (event: any) =>
          applyEventRoleRightAccess(
            event,
            userID,
            ['manage', 'manage_votes'],
            ['events', 'elections']
          ),
        { flip: false }
      ),
    { flip: false }
  ) as T;
}

export function applyElectionElectorOrManagerQueryAccess<T>(
  q: T,
  userID: string | undefined | null
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('election', (election: any) => applyElectionManagerQueryAccess(election, userID), {
        flip: false,
      })
    )
  ) as T;
}

export function applyVoteQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;
  const scopedQuery = query.where(({ or, exists }: any) =>
    or(
      exists('agenda_item', (agendaItem: any) => applyAgendaItemQueryAccess(agendaItem, userID), {
        flip: false,
      }),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID), {
        flip: false,
      })
    )
  );

  return applyVoteVisibilityQueryAccess(scopedQuery, userID);
}

/** The enclosing, filtered agenda item already proves the vote's parent scope. */
export function applyVoteQueryAccessFromAuthorizedAgendaItem<T>(
  q: T,
  userID: string | undefined | null
): T {
  return applyVoteVisibilityQueryAccess(q, userID);
}

function applyVoteVisibilityQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const scopedQuery = q as any;
  if (!isAuthenticatedUserId(userID)) {
    return scopedQuery.where('visibility', 'public') as T;
  }

  return scopedQuery.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      exists('voters', (voter: any) => voter.where('user_id', userID), { flip: false }),
      exists(
        'agenda_item',
        (agendaItem: any) =>
          agendaItem.whereExists(
            'event',
            (event: any) =>
              event.where(({ or: eventOr, cmp: eventCmp, exists: eventExists }: any) =>
                eventOr(
                  eventCmp('creator_id', userID),
                  eventExists(
                    'participants',
                    (participant: any) =>
                      whereAnyOf(
                        participant.where('user_id', userID),
                        'status',
                        ACTIVE_EVENT_PARTICIPANT_STATUSES
                      ),
                    { flip: false }
                  )
                )
              ),
            { flip: false }
          ),
        { flip: false }
      ),
      exists(
        'amendment',
        (amendment: any) =>
          amendment.where(({ or: amendmentOr, cmp: amendmentCmp, exists: amendmentExists }: any) =>
            amendmentOr(
              amendmentCmp('created_by_id', userID),
              amendmentExists(
                'collaborators',
                (collaborator: any) =>
                  whereAnyOf(
                    collaborator.where('user_id', userID),
                    'status',
                    ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
                  ),
                { flip: false }
              )
            )
          ),
        { flip: false }
      )
    )
  ) as T;
}

export function applyRoleQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  planPerRole = false
): T {
  const query = q as any;
  const plan = planPerRole ? { flip: false } : undefined;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      or(cmp('visibility', '=', 'public'), cmp('visibility', '=', 'authenticated')),
      exists(
        'holders',
        (holder: any) => holder.where('user_id', userID).where('end_date', 'IS', null),
        plan
      ),
      exists(
        'group_membership_roles',
        (link: any) =>
          link.whereExists(
            'group_membership',
            (membership: any) =>
              whereAnyOf(
                membership.where('user_id', userID),
                'status',
                ACTIVE_GROUP_MEMBERSHIP_STATUSES
              ),
            plan
          ),
        plan
      ),
      exists(
        'group_guest_roles',
        (link: any) =>
          link.whereExists(
            'group_guest_access',
            (guestAccess: any) =>
              whereAnyOf(
                guestAccess.where('user_id', userID),
                'status',
                ACTIVE_GROUP_GUEST_ACCESS_STATUSES
              ),
            plan
          ),
        plan
      ),
      exists(
        'event_participant_roles',
        (link: any) =>
          link.whereExists(
            'event_participant',
            (participant: any) =>
              whereAnyOf(
                participant.where('user_id', userID),
                'status',
                ACTIVE_EVENT_PARTICIPANT_STATUSES
              ),
            plan
          ),
        plan
      )
    )
  ) as T;
}

export function applyVoteManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, exists }: any) =>
    or(
      exists(
        'agenda_item',
        (agendaItem: any) =>
          agendaItem.whereExists(
            'event',
            (event: any) => applyEventManagerQueryAccess(event, userID, 'manage_votes'),
            { flip: false }
          ),
        { flip: false }
      ),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID), {
        flip: false,
      })
    )
  ) as T;
}

export function applyVoteVoterOrManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('vote', (vote: any) => applyVoteManagerQueryAccess(vote, userID), {
        flip: false,
      })
    )
  ) as T;
}

export function applyAccreditationQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('event', (event: any) =>
        applyEventManagerQueryAccess(event, userID, 'manage_participants')
      )
    )
  ) as T;
}

export interface DocumentQueryAccessProfile {
  collaboratorFlip?: boolean;
  amendmentFlip?: boolean;
}

function flipOption(flip: boolean | undefined) {
  return flip === undefined ? undefined : { flip };
}

export function applyDocumentQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  profile: DocumentQueryAccessProfile = {}
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.whereExists(
      'amendment',
      (amendment: any) => applyAmendmentQueryAccess(amendment, userID),
      flipOption(profile.amendmentFlip)
    ) as T;
  }

  // A direct collaborator link must not bypass a retired or another user's
  // tutorial sandbox, even though its decision history is retained.
  const scoped = query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('amendment_id', 'IS', null),
      exists(
        'amendment',
        (amendment: any) => applyTutorialRunOwnerQueryAccess(amendment, userID),
        flipOption(profile.amendmentFlip)
      )
    )
  );
  return scoped.where(({ or, exists }: any) =>
    or(
      exists(
        'collaborators',
        (collaborator: any) => collaborator.where('user_id', userID),
        flipOption(profile.collaboratorFlip)
      ),
      exists(
        'amendment',
        (amendment: any) => applyAmendmentQueryAccess(amendment, userID),
        flipOption(profile.amendmentFlip)
      )
    )
  ) as T;
}
