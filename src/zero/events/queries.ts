import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';

function applyEventAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
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

function applyEventParticipantEventAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('creator_id', userID),
      exists('participants', (participant: any) => participant.where('user_id', userID))
    )
  ) as T;
}

function applyEventDelegateSelfOrParticipantAccess<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('user_id', userID),
      exists('event', (event: any) => applyEventParticipantEventAccess(event, userID))
    )
  ) as T;
}

export const eventQueries = {
  // ── Existing queries ──────────────────────────────────────────────

  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID).one()
  ),

  byGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyEventAccess(zql.event.where('group_id', groupId), userID).orderBy('start_date', 'desc')
  ),

  upcoming: defineQuery(
    z.object({ groupId: z.string().optional() }),
    ({ args: { groupId }, ctx: { userID } }) => {
      let q = applyEventAccess(zql.event.where('status', '!=', 'cancelled'), userID).orderBy(
        'start_date',
        'asc'
      );
      if (groupId) {
        q = q.where('group_id', groupId);
      }
      return q;
    }
  ),

  participants: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyEventParticipantOrManagerQueryAccess(zql.event_participant, userID)
        .where('event_id', eventId)
        .whereExists('event', event => applyEventAccess(event, userID))
        .related('participant_roles', q => q.related('role'))
        .orderBy('created_at', 'asc')
  ),

  offlineParticipants: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.event_offline_participant
        .where('event_id', eventId)
        .whereExists('event', event =>
          applyEventManagerQueryAccess(event, userID, 'manage_participants')
        )
        .related('event')
        .related('group_offline_member', q => q.related('group').related('connected_user'))
        .related('connected_user')
        .orderBy('created_at', 'asc')
  ),

  /** Event agenda items by event (replaces old event_voting_session query) */
  agenda: defineQuery(z.object({ eventId: z.string() }), ({ args: { eventId }, ctx: { userID } }) =>
    applyAgendaItemQueryAccess(zql.agenda_item, userID)
      .where('event_id', eventId)
      .orderBy('order_index', 'asc')
  ),

  /** Votes by agenda item */
  voting: defineQuery(
    z.object({ agendaItemId: z.string() }),
    ({ args: { agendaItemId }, ctx: { userID } }) =>
      applyVoteQueryAccess(zql.vote, userID)
        .where('agenda_item_id', agendaItemId)
        .related('choices')
  ),

  delegates: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyEventDelegateSelfOrParticipantAccess(zql.event_delegate, userID)
        .where('event_id', eventId)
        .whereExists('event', event => applyEventAccess(event, userID))
        .orderBy('created_at', 'asc')
  ),

  roles: defineQuery(z.object({ eventId: z.string() }), ({ args: { eventId }, ctx: { userID } }) =>
    zql.role
      .where('event_id', eventId)
      .whereExists('event', event =>
        applyEventManagerQueryAccess(event, userID, 'manage_participants')
      )
      .where('scope', 'event')
      .orderBy('sort_order', 'asc')
  ),

  participantsByUser: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.event_participant
        .where('user_id', user_id)
        .where('user_id', userID)
        .related('event', q => q.related('creator'))
        .related('participant_roles', q => q.related('role'))
  ),

  // ── New queries (extracted from hooks.ts) ─────────────────────────

  /** Deep event by ID with creator, group→memberships→user, participants→user+role→action_rights, delegates→user, agenda_items→election, roles */
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('creator')
      .related('group', groupQuery =>
        groupQuery.related('memberships', membershipQuery =>
          applyGroupMembershipSelfOrManagerQueryAccess(membershipQuery, userID).related('user')
        )
      )
      .related('participants', participantQuery =>
        applyEventParticipantOrManagerQueryAccess(participantQuery, userID)
          .related('user')
          .related('participant_roles', roleLinkQuery =>
            roleLinkQuery.related('role', roleQuery => roleQuery.related('action_rights'))
          )
      )
      .related('offline_participants', offlineParticipantQuery =>
        offlineParticipantQuery
          .whereExists('event', event =>
            applyEventManagerQueryAccess(event, userID, 'manage_participants')
          )
          .related('connected_user')
          .related('group_offline_member', q => q.related('group').related('connected_user'))
      )
      .related('delegates', delegateQuery =>
        applyEventDelegateSelfOrParticipantAccess(delegateQuery, userID)
          .related('user')
          .related('group')
      )
      .related('agenda_items', agendaItemQuery => agendaItemQuery.related('election'))
      .related('roles', roleQuery =>
        roleQuery.whereExists('event', event =>
          applyEventManagerQueryAccess(event, userID, 'manage_participants')
        )
      )
  ),

  /** Event with cancellation-related data (agenda_items→amendment+election→role, participants→user) */
  forCancel: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('agenda_items', q =>
        q.related('amendment').related('election', q => q.related('role'))
      )
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
      )
  ),

  /** Event with voting data (participants→user+role→action_rights, agenda_items→votes→choices+decisions) */
  withVoting: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID)
          .related('user')
          .related('participant_roles', pq => pq.related('role', rq => rq.related('action_rights')))
      )
      .related('offline_participants', q =>
        q
          .whereExists('event', event =>
            applyEventManagerQueryAccess(event, userID, 'manage_participants')
          )
          .related('connected_user')
          .related('group_offline_member', gq => gq.related('group'))
      )
      .related('agenda_items', q =>
        q
          .related('votes', vq =>
            vq
              .related('choices')
              .related('indicative_decisions', d =>
                d
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('final_decisions', d =>
                d
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('offline_tallies', oq =>
                oq
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('voters', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
          )
          .related('amendment', aq => aq.related('group').related('event'))
      )
  ),

  /** Event stream data: event with creator, agenda_items with deep relations */
  streamEvent: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('creator')
      .related('offline_participants', q =>
        q
          .whereExists('event', event =>
            applyEventManagerQueryAccess(event, userID, 'manage_participants')
          )
          .related('connected_user')
          .related('group_offline_member', gq => gq.related('group'))
      )
      .related('agenda_items', q =>
        q
          .related('creator')
          .related('speaker_list', q => q.related('user'))
          .related('election', q =>
            q
              .related('candidates', c => c.related('user'))
              .related('indicative_selections', s =>
                s
                  .whereExists('election', election =>
                    applyElectionManagerQueryAccess(election, userID)
                  )
                  .related('candidate')
              )
              .related('final_selections', s =>
                s
                  .whereExists('election', election =>
                    applyElectionManagerQueryAccess(election, userID)
                  )
                  .related('candidate')
              )
              .related('offline_tallies', oq =>
                oq
                  .whereExists('election', election =>
                    applyElectionManagerQueryAccess(election, userID)
                  )
                  .related('candidate')
              )
              .related('electors', elector =>
                applyElectionElectorOrManagerQueryAccess(elector, userID)
              )
          )
          .related('votes', q =>
            q
              .related('choices')
              .related('indicative_decisions', d =>
                d
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('final_decisions', d =>
                d
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('offline_tallies', oq =>
                oq
                  .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                  .related('choice')
              )
              .related('voters', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
          )
          .related('amendment', q =>
            q.related('change_requests', changeRequest =>
              changeRequest.where('user_id', userID ?? '__anon__')
            )
          )
      )
  ),

  /** Event participants with user and role (for participant list) */
  participantsWithUserAndRole: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.event_participant
        .where('event_id', eventId)
        .whereExists('event', event => applyEventAccess(event, userID))
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('user_id', userID),
            exists('event', (event: any) =>
              applyEventManagerQueryAccess(event, userID, 'manage_participants')
            )
          )
        )
        .related('user')
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** Event with group→memberships→user and delegates→user (for participation) */
  forParticipation: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('group', q =>
        q.related('memberships', q =>
          applyGroupMembershipSelfOrManagerQueryAccess(q, userID).related('user')
        )
      )
      .related('delegates', q =>
        applyEventDelegateSelfOrParticipantAccess(q, userID).related('user')
      )
  ),

  /** User's participation in a specific event */
  userParticipation: defineQuery(
    z.object({ userId: z.string(), eventId: z.string() }),
    ({ args: { userId, eventId }, ctx: { userID } }) =>
      zql.event_participant
        .where('user_id', userId)
        .where('user_id', userID)
        .where('event_id', eventId)
        .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
  ),

  /** All participants for an event (no relations) */
  allParticipantsByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyEventParticipantOrManagerQueryAccess(zql.event_participant, userID)
        .where('event_id', eventId)
        .whereExists('event', event => applyEventAccess(event, userID))
        .related('participant_roles', q => q.related('role'))
  ),

  /** Event with creator and group (for roles page) */
  forRoles: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID).related('creator').related('group')
  ),

  /** Event roles with holder→user relations */
  rolesWithHolders: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.role
        .where('event_id', eventId)
        .whereExists('event', event =>
          applyEventManagerQueryAccess(event, userID, 'manage_participants')
        )
        .where('scope', 'event')
        .related('holders', q => q.related('user'))
        .related('action_rights')
        .related('elections')
  ),

  /** Agenda items for an event with election→candidates and amendment */
  agendaWithElections: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('event_id', eventId)
        .related('election', q => q.related('candidates'))
        .related('amendment')
  ),

  /** Full agenda items with all nested relations (for agenda view) */
  agendaItemsFull: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('event_id', eventId)
        .related('creator')
        .related('event')
        .related('election', q =>
          q
            .related('candidates', c => c.related('user'))
            .related('indicative_selections', s =>
              s
                .whereExists('election', election =>
                  applyElectionManagerQueryAccess(election, userID)
                )
                .related('candidate')
            )
            .related('final_selections', s =>
              s
                .whereExists('election', election =>
                  applyElectionManagerQueryAccess(election, userID)
                )
                .related('candidate')
            )
            .related('offline_tallies', oq =>
              oq
                .whereExists('election', election =>
                  applyElectionManagerQueryAccess(election, userID)
                )
                .related('candidate')
            )
            .related('electors', e =>
              applyElectionElectorOrManagerQueryAccess(e, userID).related('user')
            )
            .related('indicative_participations', p =>
              p
                .whereExists('elector', elector =>
                  applyElectionElectorOrManagerQueryAccess(elector, userID)
                )
                .related('elector')
                .related('selections', s => s.related('candidate'))
            )
            .related('final_participations', p =>
              p
                .whereExists('elector', elector =>
                  applyElectionElectorOrManagerQueryAccess(elector, userID)
                )
                .related('elector')
                .related('selections', s => s.related('candidate'))
            )
            .related('role', q => q.related('group'))
        )
        .related('votes', q =>
          q
            .related('choices')
            .related('indicative_decisions', d =>
              d
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
            .related('final_decisions', d =>
              d
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
            .related('offline_tallies', oq =>
              oq
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
            .related('voters', v => applyVoteVoterOrManagerQueryAccess(v, userID).related('user'))
            .related('indicative_participations', p =>
              p
                .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                .related('voter')
                .related('decisions', d => d.related('choice'))
            )
            .related('final_participations', p =>
              p
                .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                .related('voter')
                .related('decisions', d => d.related('choice'))
            )
        )
        .related('amendment', q => q.related('change_requests').related('group'))
        .related('speaker_list', q => q.related('user'))
  ),

  /** Single agenda item detail with all nested relations */
  agendaItemDetail: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAgendaItemQueryAccess(zql.agenda_item, userID)
      .where('id', id)
      .related('creator')
      .related('event', q => q.related('creator'))
      .related('election', q =>
        q
          .related('candidates', c => c.related('user'))
          .related('indicative_selections', s =>
            s
              .whereExists('election', election =>
                applyElectionManagerQueryAccess(election, userID)
              )
              .related('candidate')
          )
          .related('final_selections', s =>
            s
              .whereExists('election', election =>
                applyElectionManagerQueryAccess(election, userID)
              )
              .related('candidate')
          )
          .related('offline_tallies', oq =>
            oq
              .whereExists('election', election =>
                applyElectionManagerQueryAccess(election, userID)
              )
              .related('candidate')
          )
          .related('electors', e =>
            applyElectionElectorOrManagerQueryAccess(e, userID).related('user')
          )
      )
      .related('votes', q =>
        q
          .related('choices')
          .related('indicative_decisions', d =>
            d
              .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
              .related('choice')
          )
          .related('final_decisions', d =>
            d
              .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
              .related('choice')
          )
          .related('offline_tallies', oq =>
            oq
              .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
              .related('choice')
          )
          .related('voters', v => applyVoteVoterOrManagerQueryAccess(v, userID).related('user'))
      )
      .related('amendment', q => q.related('change_requests').related('group').related('document'))
      .related('speaker_list', q => q.related('user'))
  ),

  /** Event with delegates→user and delegate_allocations */
  delegatesFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventParticipantEventAccess(zql.event, userID)
      .where('id', id)
      .related('group')
      .related('delegates', q =>
        applyEventDelegateSelfOrParticipantAccess(q, userID).related('user').related('group')
      )
      .related('delegate_allocations', q => q.related('group'))
  ),

  /** Delegate allocations assigned to one source group across target events. */
  delegateAllocationsBySourceGroup: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      zql.group_delegate_allocation
        .where('group_id', groupId)
        .whereExists('group', group => applyGroupQueryAccess(group, userID))
        .related('event', q =>
          q
            .related('group')
            .related('delegates', dq =>
              applyEventDelegateSelfOrParticipantAccess(dq, userID).related('user').related('group')
            )
        )
        .related('group')
  ),

  /** Explicit group connections by optional endpoint group. */
  groupRelationships: defineQuery(
    z.object({ groupId: z.string().optional() }),
    ({ args: { groupId }, ctx: { userID } }) => {
      let q = zql.group_connection
        .where(({ or, exists }: any) =>
          or(
            exists('group_a', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('group_b', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('parent_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('child_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('created_by')
        .related('grants', grantQuery =>
          grantQuery
            .related('holder_group')
            .related('scope_group')
            .related('initiator_group')
            .orderBy('right_key', 'asc')
        )
        .related('membership_rule', membershipRuleQuery =>
          membershipRuleQuery
            .related('member_source_group')
            .related('member_target_group')
            .related('required_source_role')
            .related('origins', originQuery => originQuery.related('eligible_origin_group'))
        )
        .orderBy('updated_at', 'desc');
      if (groupId) {
        q = q.where(({ cmp, or }) =>
          or(cmp('group_a_id', '=', groupId), cmp('group_b_id', '=', groupId))
        ) as typeof q;
      }
      return q;
    }
  ),

  /** Subscribers for an event with subscriber_user and event */
  subscribersByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.subscriber
        .where('event_id', eventId)
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('subscriber_id', userID ?? '__anon__'),
            exists('event', (event: any) =>
              applyEventManagerQueryAccess(event, userID, 'manage_participants')
            )
          )
        )
        .whereExists('event', event => applyEventAccess(event, userID))
        .related('subscriber_user')
        .related('event')
  ),

  /** Event wiki data with creator, group, hashtags, roles→holders→user, participants→user */
  wikiData: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event, userID)
      .where('id', id)
      .related('creator')
      .related('group')
      .related('event_hashtags', q => q.related('hashtag'))
      .related('roles', q =>
        q
          .whereExists('event', event =>
            applyEventManagerQueryAccess(event, userID, 'manage_participants')
          )
          .related('holders', q => q.related('user'))
      )
      .related('delegates', q =>
        applyEventDelegateSelfOrParticipantAccess(q, userID).related('user').related('group')
      )
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID)
          .related('user')
          .related('participant_roles', pq => pq.related('role'))
      )
      .related('offline_participants', q =>
        q
          .whereExists('event', event =>
            applyEventManagerQueryAccess(event, userID, 'manage_participants')
          )
          .related('connected_user')
          .related('group_offline_member', gq => gq.related('group'))
      )
  ),

  /** Agenda items for wiki with event, election→candidates→user+role */
  wikiAgendaItems: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('event_id', eventId)
        .related('event')
        .related('election', q => q.related('candidates', q => q.related('user')).related('role'))
  ),

  /** Event access roles scoped to event with action_rights */
  accessRolesByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.role
        .where('event_id', eventId)
        .whereExists('event', event =>
          applyEventManagerQueryAccess(event, userID, 'manage_participants')
        )
        .where('scope', 'event')
        .related('action_rights')
  ),

  /** Events by group, non-cancelled (for selectors) */
  byGroupActive: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyEventAccess(zql.event, userID)
        .where('group_id', groupId)
        .where('status', '!=', 'cancelled')
  ),

  /** All events (no filter) */
  all: defineQuery(z.object({}), ({ ctx: { userID } }) => applyEventAccess(zql.event, userID)),

  /** All amendments (no filter) */
  allAmendments: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyAmendmentQueryAccess(zql.amendment, userID)
  ),

  /** All roles with group relation */
  rolesWithGroups: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.role
      .where('scope', 'group')
      .where('assignment_mode', 'elected')
      .whereExists('group', group => applyGroupQueryAccess(group, userID))
      .related('group', group => applyGroupQueryAccess(group, userID))
  ),

  /** User event participations with event→group */
  userParticipationsWithEvent: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.event_participant
        .where('user_id', userId)
        .where('user_id', userID)
        .related('event', q => q.related('group'))
  ),

  /** Event with group relation (simple) */
  withGroup: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event, userID).where('id', id).related('group')
  ),

  /** Election by ID with full relations (role→group, candidates→user, indicative/final selections) */
  electionWithVotes: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyElectionQueryAccess(zql.election, userID)
        .where('id', id)
        .related('role', q => q.related('group'))
        .related('candidates', q => q.related('user'))
        .related('electors', q => applyElectionElectorOrManagerQueryAccess(q, userID))
        .related('indicative_selections', q =>
          q
            .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
            .related('candidate')
        )
        .related('final_selections', q =>
          q
            .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
            .related('candidate')
        )
  ),

  /** Change requests by amendment with user */
  changeRequestsByAmendment: defineQuery(
    z.object({ amendmentId: z.string() }),
    ({ args: { amendmentId }, ctx: { userID } }) =>
      zql.change_request
        .where('amendment_id', amendmentId)
        .whereExists('amendment', amendment => applyAmendmentQueryAccess(amendment, userID))
        .related('user')
  ),

  /** All events with creator, group, participants→user (for calendar) */
  forCalendar: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyEventAccess(zql.event, userID)
      .related('creator')
      .related('group')
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
      )
  ),

  /** Event with agenda_items and participants→user (for agenda+participant views) */
  withAgendaAndParticipants: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyEventAccess(zql.event, userID)
        .where('id', id)
        .related('agenda_items')
        .related('participants', q =>
          applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
        )
        .related('offline_participants', q =>
          q
            .whereExists('event', event =>
              applyEventManagerQueryAccess(event, userID, 'manage_participants')
            )
            .related('connected_user')
            .related('group_offline_member', gq => gq.related('group'))
        )
  ),

  /** User event subscriptions (participations with deep event relations for timeline) */
  userSubscriptions: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      zql.event_participant
        .where('user_id', userId)
        .where('user_id', userID)
        .related('event', q =>
          q
            .related('event_hashtags', q => q.related('hashtag'))
            .related('participants', q => applyEventParticipantOrManagerQueryAccess(q, userID))
            .related('roles', q =>
              q.whereExists('event', event =>
                applyEventManagerQueryAccess(event, userID, 'manage_participants')
              )
            )
            .related('agenda_items', q => q.related('election').related('amendment'))
        )
  ),

  // ── Event exception queries ───────────────────────────────────────

  /** Exceptions for a recurring event */
  exceptionsByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.event_exception
        .where('parent_event_id', eventId)
        .whereExists('parent_event', event => applyEventAccess(event, userID))
        .orderBy('original_date', 'asc')
  ),

  /** All events with creator, group, participants→user, exceptions, hashtags (for calendar with recurrence) */
  forCalendarWithExceptions: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyEventAccess(zql.event, userID)
      .related('creator')
      .related('group')
      .related('participants', q =>
        applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
      )
      .related('exceptions')
      .related('event_hashtags', q => q.related('hashtag'))
  ),

  /** Group events with creator, participants→user, exceptions, hashtags (for group calendar view) */
  byGroupForCalendar: defineQuery(
    z.object({ groupId: z.string() }),
    ({ args: { groupId }, ctx: { userID } }) =>
      applyEventAccess(zql.event, userID)
        .where('group_id', groupId)
        .related('creator')
        .related('group')
        .related('participants', q =>
          applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
        )
        .related('exceptions')
        .related('event_hashtags', q => q.related('hashtag'))
  ),

  /** Events created by a user with participants→user, exceptions, hashtags (for meet page) */
  byCreator: defineQuery(
    z.object({ userId: z.string() }),
    ({ args: { userId }, ctx: { userID } }) =>
      applyEventAccess(zql.event, userID)
        .where('creator_id', userId)
        .related('creator')
        .related('group')
        .related('participants', q =>
          applyEventParticipantOrManagerQueryAccess(q, userID).related('user')
        )
        .related('exceptions')
        .related('event_hashtags', q => q.related('hashtag'))
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type EventByIdFullRow = QueryRowType<typeof eventQueries.byIdFull>;
export type EventWithVotingRow = QueryRowType<typeof eventQueries.withVoting>;
export type EventStreamRow = QueryRowType<typeof eventQueries.streamEvent>;
export type EventWikiRow = QueryRowType<typeof eventQueries.wikiData>;
export type EventForCalendarRow = QueryRowType<typeof eventQueries.forCalendarWithExceptions>;
export type EventByCreatorRow = QueryRowType<typeof eventQueries.byCreator>;
export type EventSubscriptionRow = QueryRowType<typeof eventQueries.userSubscriptions>;
export type EventParticipantWithUserRow = QueryRowType<
  typeof eventQueries.participantsWithUserAndRole
>;
export type EventOfflineParticipantRow = QueryRowType<typeof eventQueries.offlineParticipants>;
export type EventAgendaItemFullRow = QueryRowType<typeof eventQueries.agendaItemsFull>;
export type EventAgendaItemDetailRow = QueryRowType<typeof eventQueries.agendaItemDetail>;
export type EventWikiAgendaRow = QueryRowType<typeof eventQueries.wikiAgendaItems>;
export type EventRoleWithHoldersRow = QueryRowType<typeof eventQueries.rolesWithHolders>;
export type EventElectionWithVotesRow = QueryRowType<typeof eventQueries.electionWithVotes>;
export type EventDelegatesFullRow = QueryRowType<typeof eventQueries.delegatesFull>;
export type EventParticipantsByUserRow = QueryRowType<typeof eventQueries.participantsByUser>;
