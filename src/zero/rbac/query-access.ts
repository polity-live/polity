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

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];
const ACTIVE_GROUP_GUEST_ACCESS_STATUSES = ['active'];
const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];

export function applyUserQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp }: any) =>
    or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
  ) as T;
}

export function applyGroupQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('owner_id', userID),
      exists('memberships', (membership: any) => membership.where('user_id', userID)),
      exists('guest_accesses', (guestAccess: any) => guestAccess.where('user_id', userID))
    )
  ) as T;
}

function applyGroupRoleRightAccess<T>(
  q: T,
  userID: string | undefined | null,
  actions: readonly string[],
  resources: readonly string[] = ['groups']
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists('memberships', (membership: any) =>
        membership
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
          .whereExists('membership_roles', (membershipRole: any) =>
            membershipRole.whereExists('role', (role: any) =>
              role.whereExists('action_rights', (right: any) =>
                right.where('resource', 'IN', resources).where('action', 'IN', actions)
              )
            )
          )
      ),
      exists('guest_accesses', (guestAccess: any) =>
        guestAccess
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
          .whereExists('guest_roles', (guestRole: any) =>
            guestRole.whereExists('role', (role: any) =>
              role.whereExists('action_rights', (right: any) =>
                right.where('resource', 'IN', resources).where('action', 'IN', actions)
              )
            )
          )
      )
    )
  ) as T;
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
      exists('group', (group: any) =>
        applyGroupManagerQueryAccess(group, userID, 'manage_members', [
          'groups',
          'groupMemberships',
        ])
      )
    )
  ) as T;
}

export function applyEventQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('creator_id', userID),
      exists('participants', (participant: any) => participant.where('user_id', userID)),
      exists('group', (group: any) =>
        group.where(({ or, cmp, exists }: any) =>
          or(
            cmp('visibility', 'IN', ['public', 'authenticated']),
            cmp('owner_id', userID),
            exists('memberships', (membership: any) => membership.where('user_id', userID)),
            exists('guest_accesses', (guestAccess: any) => guestAccess.where('user_id', userID))
          )
        )
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
      exists('participants', (participant: any) =>
        participant
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
          .whereExists('participant_roles', (participantRole: any) =>
            participantRole.whereExists('role', (role: any) =>
              role.whereExists('action_rights', (right: any) =>
                right.where('resource', 'IN', resources).where('action', 'IN', actions)
              )
            )
          )
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
      exists('event', (event: any) =>
        applyEventManagerQueryAccess(event, userID, 'manage_participants')
      )
    )
  ) as T;
}

export function applyAmendmentQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('created_by_id', userID),
      exists('collaborators', (collaborator: any) => collaborator.where('user_id', userID)),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      ),
      exists('event', (event: any) =>
        event.whereExists('participants', (participant: any) =>
          participant.where('user_id', userID)
        )
      )
    )
  ) as T;
}

export function applyChangeRequestVisibilityAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility_scope', 'IS', null),
      cmp('visibility_scope', 'public'),
      isAuthenticatedUserId(userID)
        ? exists('amendment', (amendment: any) =>
            amendment.whereExists('collaborators', (collaborator: any) =>
              collaborator
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
            )
          )
        : cmp('visibility_scope', '__public_only__')
    )
  ) as T;
}

export function applyBlogQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('bloggers', (blogger: any) => blogger.where('user_id', userID)),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      )
    )
  ) as T;
}

export function applyStatementQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;
  const now = Date.now();
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
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('user_id', userID),
      exists('group', (group: any) => applyGroupQueryAccess(group, userID))
    )
  ) as T;
}

export function applyTodoQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('creator_id', userID),
      exists('assignments', (assignment: any) => assignment.where('user_id', userID)),
      exists('group', (group: any) =>
        group.whereExists('memberships', (membership: any) => membership.where('user_id', userID))
      ),
      exists('event', (event: any) =>
        event.whereExists('participants', (participant: any) =>
          participant.where('user_id', userID)
        )
      ),
      exists('amendment', (amendment: any) =>
        amendment.where(({ or, cmp, exists }: any) =>
          or(
            cmp('created_by_id', userID),
            exists('collaborators', (collaborator: any) => collaborator.where('user_id', userID))
          )
        )
      )
    )
  ) as T;
}

export function applyAgendaItemQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.whereExists('event', (event: any) => event.where('visibility', 'public')) as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists('event', (event: any) => applyEventQueryAccess(event, userID)),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID))
    )
  ) as T;
}

export function applyElectionQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query
      .where('visibility', 'public')
      .whereExists('agenda_item', (agendaItem: any) =>
        applyAgendaItemQueryAccess(agendaItem, userID)
      ) as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('agenda_item', (agendaItem: any) => applyAgendaItemQueryAccess(agendaItem, userID)),
      exists('electors', (elector: any) => elector.where('user_id', userID))
    )
  ) as T;
}

export function applyElectionManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.whereExists('agenda_item', (agendaItem: any) =>
    agendaItem.whereExists('event', (event: any) =>
      applyEventRoleRightAccess(event, userID, ['manage', 'manage_votes'], ['events', 'elections'])
    )
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
      exists('election', (election: any) => applyElectionManagerQueryAccess(election, userID))
    )
  ) as T;
}

export function applyVoteQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('agenda_item', (agendaItem: any) => applyAgendaItemQueryAccess(agendaItem, userID)),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID)),
      exists('voters', (voter: any) => voter.where('user_id', userID))
    )
  ) as T;
}

export function applyVoteManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, exists }: any) =>
    or(
      exists('agenda_item', (agendaItem: any) =>
        agendaItem.whereExists('event', (event: any) =>
          applyEventManagerQueryAccess(event, userID, 'manage_votes')
        )
      ),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID))
    )
  ) as T;
}

export function applyVoteVoterOrManagerQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('vote', (vote: any) => applyVoteManagerQueryAccess(vote, userID))
    )
  ) as T;
}

export function applyAccreditationQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('event', (event: any) => applyEventManagerQueryAccess(event, userID, 'manage_votes'))
    )
  ) as T;
}

export function applyDocumentQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, exists }: any) =>
    or(
      exists('collaborators', (collaborator: any) => collaborator.where('user_id', userID)),
      exists('amendment', (amendment: any) => applyAmendmentQueryAccess(amendment, userID))
    )
  ) as T;
}
