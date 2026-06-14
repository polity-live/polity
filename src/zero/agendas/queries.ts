import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyAgendaItemQueryAccess,
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';

export const agendaQueries = {
  // All agenda items for an event
  byEvent: defineQuery(
    z.object({ event_id: z.string() }),
    ({ args: { event_id }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('event_id', event_id)
        .orderBy('order_index', 'asc')
        .related('event')
        .related('creator')
        .related('election', q => q.related('role', pq => pq.related('group')))
        .related('amendment')
        .related('votes', q => applyVoteQueryAccess(q, userID))
  ),

  // Agenda items by multiple event IDs with relations
  byEventIds: defineQuery(
    z.object({ event_ids: z.array(z.string()) }),
    ({ args: { event_ids }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('event_id', 'IN', event_ids)
        .related('event')
        .related('election')
        .related('amendment')
        .related('votes', q => applyVoteQueryAccess(q, userID))
  ),

  // Single agenda item by ID
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyAgendaItemQueryAccess(zql.agenda_item.where('id', id), userID).one()
  ),

  // Agenda items for a specific amendment (to find the agenda item for CR voting timeline)
  byAmendmentId: defineQuery(
    z.object({ amendment_id: z.string() }),
    ({ args: { amendment_id }, ctx: { userID } }) =>
      applyAgendaItemQueryAccess(zql.agenda_item, userID)
        .where('amendment_id', amendment_id)
        .related('event')
  ),

  // Speaker list for an agenda item
  speakerList: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      zql.speaker_list
        .where('agenda_item_id', agenda_item_id)
        .whereExists('agenda_item', agendaItem => applyAgendaItemQueryAccess(agendaItem, userID))
        .orderBy('order_index', 'asc')
  ),

  // Change request timeline for an agenda item (CR voting during events)
  changeRequestTimeline: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      zql.agenda_item_change_request
        .where('agenda_item_id', agenda_item_id)
        .whereExists('agenda_item', agendaItem => applyAgendaItemQueryAccess(agendaItem, userID))
        .orderBy('order_index', 'asc')
        .related('change_request', q => q.related('user'))
        .related('vote', q =>
          applyVoteQueryAccess(q, userID)
            .related('choices', cq => cq.orderBy('order_index', 'asc'))
            .related('voters', vq => applyVoteVoterOrManagerQueryAccess(vq, userID).related('user'))
            .related('indicative_participations', ip =>
              ip
                .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                .related('decisions', dq => dq.related('choice'))
            )
            .related('indicative_decisions', dq =>
              dq
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
            .related('offline_tallies', oq =>
              oq
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
            .related('final_participations', fp =>
              fp
                .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
                .related('decisions', dq => dq.related('choice'))
            )
            .related('final_decisions', dq =>
              dq
                .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
                .related('choice')
            )
        )
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type AgendaItemByEventRow = QueryRowType<typeof agendaQueries.byEvent>;
export type AgendaItemByEventIdsRow = QueryRowType<typeof agendaQueries.byEventIds>;
export type AgendaItemByIdRow = QueryRowType<typeof agendaQueries.byId>;
export type AgendaItemByAmendmentRow = QueryRowType<typeof agendaQueries.byAmendmentId>;
export type SpeakerListRow = QueryRowType<typeof agendaQueries.speakerList>;
export type ChangeRequestTimelineRow = QueryRowType<typeof agendaQueries.changeRequestTimeline>;
