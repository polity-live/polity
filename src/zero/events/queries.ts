import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyAmendmentQueryAccess,
  applyChangeRequestVisibilityAccess,
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
  applyEventQueryAccess,
  applyEventManagerQueryAccess,
  applyEventParticipantOrManagerQueryAccess,
  applyGroupQueryAccess,
  applyGroupMembershipSelfOrManagerQueryAccess,
  applyRoleQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

const eventCreatedCursorSchema = z
  .object({ id: z.string(), created_at: z.number() })
  .nullable()
  .default(null);
const eventDateCursorSchema = z
  .object({ id: z.string(), start_date: z.number().optional() })
  .nullable()
  .default(null);
const eventPageDirectionSchema = z.enum(['forward', 'backward']).default('forward');

function applyEventCursor<T>(q: T, field: 'created_at' | 'start_date', start: any, dir: string): T {
  let query: any = q;
  const direction = dir === 'backward' ? 'asc' : 'desc';
  query = query.orderBy(field, direction).orderBy('id', direction);
  return (start ? query.start(start, { inclusive: false }) : query) as T;
}

const WIKI_ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];

function applyEventAccess<T>(q: T, userID: string | undefined): T {
  return applyEventQueryAccess(q, userID);
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

  participantPage: defineQuery(
    z.object({
      eventId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      roleId: z.string().optional(),
      roleIds: z.array(z.string()).default([]),
      query: z.string().default(''),
      order: z.enum(['ascending', 'descending']).default('ascending'),
      limit: virtualPageLimitSchema,
      start: eventCreatedCursorSchema,
      dir: eventPageDirectionSchema,
    }),
    ({
      args: { eventId, status, statuses, roleId, roleIds, query, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyEventParticipantOrManagerQueryAccess(zql.event_participant, userID)
        .where('event_id', eventId)
        .whereExists('event', event => applyEventAccess(event, userID));
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      if (roleId)
        q = q.whereExists('participant_roles', (role: any) => role.where('role_id', roleId));
      if ((roleIds?.length ?? 0) > 0)
        q = q.whereExists('participant_roles', (role: any) => role.where('role_id', 'IN', roleIds));
      const term = query.trim();
      if (term) {
        q = q.whereExists('user', (user: any) =>
          user.where(({ or, cmp }: any) =>
            or(
              cmp('first_name', 'ILIKE', `%${term}%`),
              cmp('last_name', 'ILIKE', `%${term}%`),
              cmp('handle', 'ILIKE', `%${term}%`)
            )
          )
        );
      }
      return applyEventCursor(q, 'created_at', start, dir)
        .related('user')
        .related('participant_roles', (role: any) => role.related('role'))
        .limit(limit);
    }
  ),

  participantById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventParticipantOrManagerQueryAccess(zql.event_participant, userID)
      .where('id', id)
      .related('user')
      .related('participant_roles', q => q.related('role'))
      .one()
  ),

  participantPageByUser: defineQuery(
    z.object({
      userId: z.string(),
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: eventCreatedCursorSchema,
      dir: eventPageDirectionSchema,
    }),
    ({ args: { userId, status, statuses, query, limit, start, dir }, ctx: { userID } }) => {
      let q = zql.event_participant.where('user_id', userId).where('user_id', userID);
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      const term = query.trim();
      if (term)
        q = q.whereExists('event', (event: any) => event.where('title', 'ILIKE', `%${term}%`));
      return applyEventCursor(q, 'created_at', start, dir)
        .related('event', event =>
          event
            .related('creator')
            .related('group')
            .related('event_hashtags', link => link.related('hashtag'))
            .related('participants')
            .related('agenda_items', item => item.related('election').related('amendment'))
        )
        .related('participant_roles', role => role.related('role'))
        .limit(limit);
    }
  ),

  calendarPage: defineQuery(
    z.object({
      groupId: z.string().optional(),
      creatorId: z.string().optional(),
      from: z.number().nullable().default(null),
      to: z.number().nullable().default(null),
      query: z.string().default(''),
      order: z.enum(['ascending', 'descending']).default('ascending'),
      limit: virtualPageLimitSchema,
      start: eventDateCursorSchema,
      dir: eventPageDirectionSchema,
    }),
    ({
      args: { groupId, creatorId, from, to, query, order, limit, start, dir },
      ctx: { userID },
    }) => {
      let q: any = applyEventAccess(zql.event, userID);
      if (groupId) q = q.where('group_id', groupId);
      if (creatorId) q = q.where('creator_id', creatorId);
      if (from != null)
        q = q.where(({ or, cmp }: any) =>
          or(cmp('start_date', '>=', from), cmp('is_recurring', true))
        );
      if (to != null) q = q.where('start_date', '<=', to);
      const term = query.trim();
      if (term) q = q.where('title', 'ILIKE', `%${term}%`);
      const cursorDirection =
        order === 'ascending' ? (dir === 'forward' ? 'backward' : 'forward') : dir;
      return applyEventCursor(q, 'start_date', start, cursorDirection)
        .related('creator')
        .related('group')
        .related('participants', (participant: any) =>
          applyEventParticipantOrManagerQueryAccess(participant, userID).related('user')
        )
        .related('exceptions')
        .related('event_hashtags', (hashtag: any) => hashtag.related('hashtag'))
        .limit(limit);
    }
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

  currentUserActiveParticipationsWithEvents: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.event_participant
      .where('user_id', userID)
      .where('status', 'IN', WIKI_ACTIVE_EVENT_PARTICIPANT_STATUSES)
      .whereExists('event', event => applyEventAccess(event, userID))
      .related('event', q =>
        q
          .related('creator')
          .related('group')
          .related('event_hashtags', hq => hq.related('hashtag'))
      )
      .related('participant_roles', q => q.related('role'))
  ),

  // ── New queries (extracted from hooks.ts) ─────────────────────────

  /** Deep event by ID with creator, group→memberships→user, participants→user+role→action_rights, delegates→user, agenda_items→election, roles */
  byIdFull: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyEventAccess(zql.event.where('id', id), userID)
      .related('creator')
      .related('group', groupQuery =>
        groupQuery.related('memberships', membershipQuery =>
          applyGroupMembershipSelfOrManagerQueryAccess(membershipQuery, userID)
            .related('user')
            .related('source_group')
            .related('part_group')
            .related('base_group')
            .related('origins', originQuery =>
              originQuery.related('source_group').related('part_group').related('base_group')
            )
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
      .related('assembly_scopes', scopeQuery =>
        scopeQuery.related('host_group').related('source_group').related('required_role')
      )
      .related('delegate_election_assignments', assignmentQuery =>
        assignmentQuery.related('source_group').related('allocation').related('linked_event')
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
              .related('voters', voter =>
                applyVoteVoterOrManagerQueryAccess(voter, userID).related('user')
              )
              .related('final_participations', participation =>
                participation
                  .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                  .related('voter')
                  .related('decisions', decision => decision.related('choice'))
              )
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
              .related('role')
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
          applyGroupMembershipSelfOrManagerQueryAccess(q, userID)
            .related('user')
            .related('part_group')
            .related('base_group')
            .related('origins', oq =>
              oq.related('source_group').related('part_group').related('base_group')
            )
        )
      )
      .related('assembly_scopes', scopeQuery =>
        scopeQuery.related('host_group').related('source_group').related('required_role')
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
        .related('election', q => q.related('candidates').related('role'))
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
        .related('amendment', q =>
          q
            .related('change_requests', changeRequest =>
              applyChangeRequestVisibilityAccess(changeRequest, userID)
            )
            .related('group')
            .related('document')
            .related('current_process_run', rq =>
              rq.related('branches', bq =>
                bq
                  .related('document')
                  .related('document_version')
                  .related('change_requests', changeRequest =>
                    applyChangeRequestVisibilityAccess(changeRequest, userID)
                  )
                  .orderBy('created_at', 'asc')
              )
            )
        )
        .related('change_request_timeline')
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
          .related('role')
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
      .related('amendment', q =>
        q
          .related('change_requests', changeRequest =>
            applyChangeRequestVisibilityAccess(changeRequest, userID)
          )
          .related('group')
          .related('document')
          .related('current_process_run', rq =>
            rq.related('branches', bq =>
              bq
                .related('document')
                .related('document_version')
                .related('change_requests', changeRequest =>
                  applyChangeRequestVisibilityAccess(changeRequest, userID)
                )
                .related('step_runs', sq =>
                  sq
                    .related('source_group')
                    .related('target_group')
                    .related('workflow_step')
                    .related('event')
                    .related('agenda_item')
                    .orderBy('order_index', 'asc')
                )
                .orderBy('created_at', 'asc')
            )
          )
      )
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
      .related('delegate_allocations', q =>
        q.related('group').related('delegate_election_assignments')
      )
      .related('assembly_scopes', q =>
        q.related('host_group').related('source_group').related('required_role')
      )
      .related('delegate_election_assignments', q =>
        q.related('source_group').related('allocation').related('linked_event')
      )
  ),

  /** Delegate assembly composition data with planned, scheduled, and elected seats. */
  delegateAssemblyComposition: defineQuery(
    z.object({ id: z.string() }),
    ({ args: { id }, ctx: { userID } }) =>
      applyEventManagerQueryAccess(zql.event.where('id', id), userID, 'manage_participants')
        .related('group')
        .related('delegates', q =>
          applyEventDelegateSelfOrParticipantAccess(q, userID).related('group')
        )
        .related('assembly_scopes', q =>
          q.related('host_group').related('source_group').related('required_role')
        )
        .related('delegate_election_assignments', q =>
          q.related('source_group').related('allocation').related('linked_event')
        )
        .related('delegate_allocations', allocationQuery =>
          allocationQuery.related('group', groupQuery =>
            groupQuery.related('roles', roleQuery =>
              roleQuery
                .where('scope', 'group')
                .where('assignment_mode', 'elected')
                .related('elections', electionQuery =>
                  applyElectionQueryAccess(electionQuery, userID).related(
                    'agenda_item',
                    agendaItemQuery => agendaItemQuery.related('event')
                  )
                )
            )
          )
        )
  ),

  assemblyScopesByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.event_assembly_scope
        .where('event_id', eventId)
        .where('status', 'active')
        .whereExists('event', event => applyEventAccess(event, userID))
        .related('event')
        .related('host_group')
        .related('source_group')
        .related('required_role')
        .orderBy('created_at', 'asc')
  ),

  delegateElectionAssignmentsByEvent: defineQuery(
    z.object({ eventId: z.string() }),
    ({ args: { eventId }, ctx: { userID } }) =>
      zql.delegate_election_assignment
        .where('target_event_id', eventId)
        .whereExists('target_event', event =>
          applyEventManagerQueryAccess(event, userID, 'manage_participants')
        )
        .related('target_event')
        .related('source_group')
        .related('allocation')
        .related('linked_event')
        .orderBy('created_at', 'asc')
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
            .related('assembly_scopes', sq =>
              sq.related('host_group').related('source_group').related('required_role')
            )
            .related('delegate_election_assignments', aq =>
              aq.related('source_group').related('allocation').related('linked_event')
            )
        )
        .related('group')
        .related('delegate_election_assignments')
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
            exists('child_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('from_group', (group: any) => applyGroupQueryAccess(group, userID)),
            exists('to_group', (group: any) => applyGroupQueryAccess(group, userID))
          )
        )
        .related('group_a')
        .related('group_b')
        .related('parent_group')
        .related('child_group')
        .related('from_group')
        .related('to_group')
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
          or(
            cmp('group_a_id', '=', groupId),
            cmp('group_b_id', '=', groupId),
            cmp('from_group_id', '=', groupId),
            cmp('to_group_id', '=', groupId)
          )
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
        q
          .where('status', 'IN', WIKI_ACTIVE_EVENT_PARTICIPANT_STATUSES)
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
        .related('amendment', q =>
          applyAmendmentQueryAccess(q, userID).related('change_requests', changeRequests =>
            applyChangeRequestVisibilityAccess(changeRequests, userID)
          )
        )
        .related('change_request_timeline')
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
    applyRoleQueryAccess(zql.role, userID)
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
        .related('participant_roles', q => q.related('role'))
  ),

  /** Active participants for events where the current user participates or is creator. */
  participantsByParticipatedEventIds: defineQuery(
    z.object({ eventIds: z.array(z.string()) }),
    ({ args: { eventIds }, ctx: { userID } }) =>
      zql.event_participant
        .where('event_id', 'IN', eventIds)
        .where('status', 'IN', ['active', 'admin', 'member', 'confirmed'])
        .whereExists('event', event => applyEventParticipantEventAccess(event, userID))
        .related('user')
        .related('participant_roles', roleLinkQuery =>
          roleLinkQuery.related('role', roleQuery => roleQuery.related('action_rights'))
        )
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
export type EventDelegateAssemblyCompositionRow = QueryRowType<
  typeof eventQueries.delegateAssemblyComposition
>;
export type EventAssemblyScopeRow = QueryRowType<typeof eventQueries.assemblyScopesByEvent>;
export type DelegateElectionAssignmentRow = QueryRowType<
  typeof eventQueries.delegateElectionAssignmentsByEvent
>;
export type EventParticipantsByUserRow = QueryRowType<typeof eventQueries.participantsByUser>;
export type EventParticipantPageByUserRow = QueryRowType<typeof eventQueries.participantPageByUser>;
export type EventParticipantByParticipatedEventIdsRow = QueryRowType<
  typeof eventQueries.participantsByParticipatedEventIds
>;
