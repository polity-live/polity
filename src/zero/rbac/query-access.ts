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
      exists('tutorial_run', (run: any) =>
        run.where('user_id', userID).where('status', 'IN', ['active', 'paused'])
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
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('acl', (acl: any) => acl.where('user_id', userID))
    )
  ) as T;
}

const ACTIVE_GROUP_MEMBERSHIP_STATUSES = ['active', 'member', 'admin'];
const ACTIVE_GROUP_GUEST_ACCESS_STATUSES = ['active'];
const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];
const ACTIVE_BLOGGER_STATUSES = ['owner', 'admin', 'member', 'writer'];

function applyGroupPrivateRelationshipQueryAccess<T>(q: T, userID: string): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          membership
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES),
        { flip: false }
      ),
      exists(
        'guest_accesses',
        (guestAccess: any) =>
          guestAccess
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES),
        { flip: false }
      )
    )
  ) as T;
}

function applyEventPrivateRelationshipQueryAccess<T>(q: T, userID: string): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists('participants', (participant: any) =>
        participant
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
      ),
      exists('group', (group: any) => applyGroupPrivateRelationshipQueryAccess(group, userID))
    )
  ) as T;
}

function applyAmendmentPrivateRelationshipQueryAccess<T>(q: T, userID: string): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('created_by_id', userID),
      exists('collaborators', (collaborator: any) =>
        collaborator
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES)
      ),
      exists('group', (group: any) => applyGroupPrivateRelationshipQueryAccess(group, userID)),
      exists('event', (event: any) =>
        event.whereExists('participants', (participant: any) =>
          participant
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
        )
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
    or(cmp('visibility', 'IN', ['public', 'authenticated']), cmp('id', userID))
  ) as T;
}

export function applyGroupQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('owner_id', userID),
      exists('memberships', (membership: any) =>
        membership.where('user_id', userID).where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
      ),
      exists('guest_accesses', (guestAccess: any) =>
        guestAccess
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
      )
    )
  ) as T;
}

function applyGroupRoleRightAccess<T>(
  q: T,
  userID: string | undefined | null,
  actions: readonly string[],
  resources: readonly string[]
): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) return denyAllRows(q);

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('owner_id', userID),
      exists(
        'memberships',
        (membership: any) =>
          membership
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
            .whereExists(
              'membership_roles',
              (membershipRole: any) =>
                membershipRole.whereExists(
                  'role',
                  (role: any) =>
                    role.whereExists(
                      'action_rights',
                      (right: any) =>
                        right.where('resource', 'IN', resources).where('action', 'IN', actions),
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
          guestAccess
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
            .whereExists(
              'guest_roles',
              (guestRole: any) =>
                guestRole.whereExists(
                  'role',
                  (role: any) =>
                    role.whereExists(
                      'action_rights',
                      (right: any) =>
                        right.where('resource', 'IN', resources).where('action', 'IN', actions),
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
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('creator_id', userID),
      exists(
        'participants',
        (participant: any) =>
          participant
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES),
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
                  membership
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES),
                { flip: false }
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  guestAccess
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES),
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
        'participants',
        (participant: any) =>
          participant
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
            .whereExists(
              'participant_roles',
              (participantRole: any) =>
                participantRole.whereExists(
                  'role',
                  (role: any) =>
                    role.whereExists(
                      'action_rights',
                      (right: any) =>
                        right.where('resource', 'IN', resources).where('action', 'IN', actions),
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
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('created_by_id', userID),
      exists(
        'collaborators',
        (collaborator: any) =>
          collaborator
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES),
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
                  membership
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES),
                { flip: false }
              ),
              exists(
                'guest_accesses',
                (guestAccess: any) =>
                  guestAccess
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES),
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
              participant
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES),
            { flip: false }
          ),
        { flip: false }
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
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('bloggers', (blogger: any) =>
        blogger.where('user_id', userID).where('status', 'IN', ACTIVE_BLOGGER_STATUSES)
      ),
      exists('group', (group: any) =>
        group.where(({ or, cmp, exists }: any) =>
          or(
            cmp('owner_id', userID),
            exists('memberships', (membership: any) =>
              membership
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
            ),
            exists('guest_accesses', (guestAccess: any) =>
              guestAccess
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
            )
          )
        )
      )
    )
  ) as T;
}

export function applyStatementQueryAccess<T>(
  q: T,
  userID: string | undefined | null,
  now: number
): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;
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
      exists('group', (group: any) =>
        group.where(({ or, cmp, exists }: any) =>
          or(
            cmp('owner_id', userID),
            exists('memberships', (membership: any) =>
              membership
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
            ),
            exists('guest_accesses', (guestAccess: any) =>
              guestAccess
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
            )
          )
        )
      )
    )
  ) as T;
}

export function applyTodoQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = applyTutorialRunOwnerQueryAccess(q, userID) as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('creator_id', userID),
      exists('assignments', (assignment: any) => assignment.where('user_id', userID)),
      exists('group', (group: any) =>
        group.where(({ or, cmp, exists }: any) =>
          or(
            cmp('owner_id', userID),
            exists('memberships', (membership: any) =>
              membership
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
            ),
            exists('guest_accesses', (guestAccess: any) =>
              guestAccess
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
            )
          )
        )
      ),
      exists('event', (event: any) => applyEventPrivateRelationshipQueryAccess(event, userID)),
      exists('amendment', (amendment: any) =>
        applyAmendmentPrivateRelationshipQueryAccess(amendment, userID)
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
  const scopedQuery = query.where(({ or, exists }: any) =>
    or(
      exists('agenda_item', (agendaItem: any) => applyAgendaItemQueryAccess(agendaItem, userID), {
        flip: false,
      }),
      exists(
        'role',
        (role: any) =>
          role.where(({ or: roleOr, exists: roleExists }: any) =>
            roleOr(
              roleExists('group', (group: any) => applyGroupQueryAccess(group, userID), {
                flip: false,
              }),
              roleExists('event', (event: any) => applyEventQueryAccess(event, userID), {
                flip: false,
              }),
              roleExists(
                'amendment',
                (amendment: any) => applyAmendmentQueryAccess(amendment, userID),
                { flip: false }
              ),
              roleExists('blog', (blog: any) => applyBlogQueryAccess(blog, userID), { flip: false })
            )
          ),
        { flip: false }
      )
    )
  );

  if (!isAuthenticatedUserId(userID)) {
    return scopedQuery.where('visibility', 'public') as T;
  }

  return scopedQuery.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('electors', (elector: any) => elector.where('user_id', userID), {
        flip: false,
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
                          participant
                            .where('user_id', userID)
                            .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES),
                        { flip: false }
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
                                  membership
                                    .where('user_id', userID)
                                    .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES),
                                { flip: false }
                              ),
                              groupExists(
                                'guest_accesses',
                                (guestAccess: any) =>
                                  guestAccess
                                    .where('user_id', userID)
                                    .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES),
                                { flip: false }
                              )
                            )
                          ),
                        { flip: false }
                      )
                    )
                  ),
                { flip: false }
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
                            collaborator
                              .where('user_id', userID)
                              .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES),
                          { flip: false }
                        )
                      )
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

export function applyDatasetQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      cmp('owner_user_id', userID),
      exists('group', (group: any) =>
        group.where(({ or: groupOr, cmp: groupCmp, exists: groupExists }: any) =>
          groupOr(
            groupCmp('owner_id', userID),
            groupExists('memberships', (membership: any) =>
              membership
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
            ),
            groupExists('guest_accesses', (guestAccess: any) =>
              guestAccess
                .where('user_id', userID)
                .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
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

  if (!isAuthenticatedUserId(userID)) {
    return scopedQuery.where('visibility', 'public') as T;
  }

  return scopedQuery.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
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
                      participant
                        .where('user_id', userID)
                        .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES),
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
                  collaborator
                    .where('user_id', userID)
                    .where('status', 'IN', ACTIVE_AMENDMENT_COLLABORATOR_STATUSES),
                { flip: false }
              )
            )
          ),
        { flip: false }
      )
    )
  ) as T;
}

export function applyRoleQueryAccess<T>(q: T, userID: string | undefined | null): T {
  const query = q as any;

  if (!isAuthenticatedUserId(userID)) {
    return query.where('visibility', 'public') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('visibility', 'IN', ['public', 'authenticated']),
      exists('holders', (holder: any) =>
        holder.where('user_id', userID).where('end_date', 'IS', null)
      ),
      exists('group_membership_roles', (link: any) =>
        link.whereExists('group_membership', (membership: any) =>
          membership
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_MEMBERSHIP_STATUSES)
        )
      ),
      exists('group_guest_roles', (link: any) =>
        link.whereExists('group_guest_access', (guestAccess: any) =>
          guestAccess
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_GROUP_GUEST_ACCESS_STATUSES)
        )
      ),
      exists('event_participant_roles', (link: any) =>
        link.whereExists('event_participant', (participant: any) =>
          participant
            .where('user_id', userID)
            .where('status', 'IN', ACTIVE_EVENT_PARTICIPANT_STATUSES)
        )
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

  return query.where(({ or, exists }: any) =>
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
