import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyVoteManagerQueryAccess,
  applyVoteQueryAccess,
  applyVoteVoterOrManagerQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';
import { virtualPageLimitSchema } from '../virtualization';

export const voteQueries = {
  decisionPage: defineQuery(
    z.object({
      status: z.string().optional(),
      statuses: z.array(z.string()).default([]),
      groupIds: z.array(z.string()).default([]),
      query: z.string().default(''),
      limit: virtualPageLimitSchema,
      start: z.object({ id: z.string(), created_at: z.number() }).nullable().default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { status, statuses, groupIds, query, limit, start, dir }, ctx: { userID } }) => {
      let q: any = applyVoteQueryAccess(zql.vote, userID);
      if (status) q = q.where('status', status);
      if ((statuses?.length ?? 0) > 0) q = q.where('status', 'IN', statuses);
      if ((groupIds?.length ?? 0) > 0) {
        q = q.whereExists('agenda_item', (item: any) =>
          item.whereExists('event', (event: any) => event.where('group_id', 'IN', groupIds))
        );
      }
      if (query.trim()) q = q.where('title', 'ILIKE', `%${query.trim()}%`);
      const direction = dir === 'backward' ? 'asc' : 'desc';
      q = q.orderBy('created_at', direction).orderBy('id', direction);
      if (start) q = q.start(start, { inclusive: false });
      return q
        .related('agenda_item', (item: any) =>
          item.related('event', (event: any) =>
            event.related('participants', (participant: any) =>
              participant.where('user_id', userID ?? '__anon__').related('participant_roles')
            )
          )
        )
        .related('amendment')
        .related('choices', (choice: any) => choice.orderBy('order_index', 'asc'))
        .related('offline_tallies', (tally: any) =>
          tally
            .whereExists('vote', (vote: any) => applyVoteManagerQueryAccess(vote, userID))
            .related('choice')
        )
        .related('voters', (voter: any) => applyVoteVoterOrManagerQueryAccess(voter, userID))
        .related('indicative_decisions', (decision: any) =>
          decision
            .whereExists('vote', (vote: any) => applyVoteManagerQueryAccess(vote, userID))
            .related('choice')
        )
        .related('final_decisions', (decision: any) =>
          decision
            .whereExists('vote', (vote: any) => applyVoteManagerQueryAccess(vote, userID))
            .related('choice')
        )
        .limit(limit);
    }
  ),
  // Votes with full details (for decision terminal/listing)
  votesWithDetails: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyVoteQueryAccess(zql.vote, userID)
      .related('agenda_item', q =>
        q.related('event', eventQuery =>
          eventQuery.related('participants', participantQuery =>
            participantQuery.where('user_id', userID ?? '__anon__').related('participant_roles')
          )
        )
      )
      .related('amendment')
      .related('choices', q => q.orderBy('order_index', 'asc'))
      .related('offline_tallies', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
      .related('voters', q => applyVoteVoterOrManagerQueryAccess(q, userID))
      .related('indicative_decisions', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
      .related('final_decisions', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
  ),

  // Votes for multiple agenda items with full details
  byAgendaItems: defineQuery(
    z.object({ agenda_item_ids: z.array(z.string()) }),
    ({ args: { agenda_item_ids }, ctx: { userID } }) =>
      applyVoteQueryAccess(zql.vote, userID)
        .where('agenda_item_id', 'IN', agenda_item_ids)
        .related('amendment')
        .related('choices', q => q.orderBy('order_index', 'asc'))
        .related('offline_tallies', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
        .related('voters', q => applyVoteVoterOrManagerQueryAccess(q, userID).related('user'))
        .related('indicative_participations', q =>
          q
            .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
            .related('voter')
            .related('decisions', q2 => q2.related('choice'))
        )
        .related('indicative_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
        .related('final_participations', q =>
          q
            .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
            .related('voter')
            .related('decisions', q2 => q2.related('choice'))
        )
        .related('final_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
  ),

  // Vote by agenda item with full details
  byAgendaItem: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      applyVoteQueryAccess(zql.vote, userID)
        .where('agenda_item_id', agenda_item_id)
        .related('amendment')
        .related('choices', q => q.orderBy('order_index', 'asc'))
        .related('offline_tallies', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
        .related('voters', q => applyVoteVoterOrManagerQueryAccess(q, userID).related('user'))
        .related('indicative_participations', q =>
          q
            .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
            .related('voter')
            .related('decisions', q2 => q2.related('choice'))
        )
        .related('indicative_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
        .related('final_participations', q =>
          q
            .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
            .related('voter')
            .related('decisions', q2 => q2.related('choice'))
        )
        .related('final_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
        )
  ),

  // Single vote by ID with full details
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyVoteQueryAccess(zql.vote, userID)
      .where('id', id)
      .related('agenda_item')
      .related('amendment')
      .related('choices', q => q.orderBy('order_index', 'asc'))
      .related('offline_tallies', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
      .related('voters', q => applyVoteVoterOrManagerQueryAccess(q, userID).related('user'))
      .related('indicative_participations', q =>
        q
          .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
          .related('voter')
          .related('decisions', q2 => q2.related('choice'))
      )
      .related('indicative_decisions', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
      .related('final_participations', q =>
        q
          .whereExists('voter', voter => applyVoteVoterOrManagerQueryAccess(voter, userID))
          .related('voter')
          .related('decisions', q2 => q2.related('choice'))
      )
      .related('final_decisions', q =>
        q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID)).related('choice')
      )
      .one()
  ),

  // Choices for a vote
  choicesByVote: defineQuery(
    z.object({ vote_id: z.string() }),
    ({ args: { vote_id }, ctx: { userID } }) =>
      zql.vote_choice
        .where('vote_id', vote_id)
        .whereExists('vote', vote => applyVoteQueryAccess(vote, userID))
        .orderBy('order_index', 'asc')
        .related('indicative_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
        )
        .related('final_decisions', q =>
          q.whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
        )
  ),

  // Indicative results — decisions grouped by choice
  indicativeResults: defineQuery(
    z.object({ vote_id: z.string() }),
    ({ args: { vote_id }, ctx: { userID } }) =>
      zql.indicative_choice_decision
        .where('vote_id', vote_id)
        .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
        .related('choice')
        .related('participation')
  ),

  // Final results — decisions grouped by choice
  finalResults: defineQuery(
    z.object({ vote_id: z.string() }),
    ({ args: { vote_id }, ctx: { userID } }) =>
      zql.final_choice_decision
        .where('vote_id', vote_id)
        .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
        .related('choice')
        .related('participation')
  ),

  // Check if user has participated in indicative phase
  userIndicativeParticipation: defineQuery(
    z.object({ vote_id: z.string(), voter_id: z.string() }),
    ({ args: { vote_id }, ctx: { userID } }) =>
      zql.indicative_voter_participation
        .where('vote_id', vote_id)
        .where('user_id', userID ?? '__anon__')
        .whereExists('vote', vote => applyVoteQueryAccess(vote, userID))
        .related('decisions', q => q.related('choice'))
        .one()
  ),

  // Check if user has participated in final phase
  userFinalParticipation: defineQuery(
    z.object({ vote_id: z.string(), voter_id: z.string() }),
    ({ args: { vote_id, voter_id }, ctx: { userID } }) =>
      zql.final_voter_participation
        .where('vote_id', vote_id)
        .where('voter_id', voter_id)
        .whereExists('voter', voter => voter.where('user_id', userID))
        .whereExists('vote', vote => applyVoteQueryAccess(vote, userID))
        .related('decisions', q => q.related('choice'))
        .one()
  ),

  // User's voter record for a vote
  userVoter: defineQuery(
    z.object({ vote_id: z.string(), user_id: z.string() }),
    ({ args: { vote_id, user_id }, ctx: { userID } }) =>
      zql.voter
        .where('vote_id', vote_id)
        .where('user_id', user_id)
        .where('user_id', userID)
        .whereExists('vote', vote => applyVoteQueryAccess(vote, userID))
        .one()
  ),

  offlineTalliesByVote: defineQuery(
    z.object({ vote_id: z.string() }),
    ({ args: { vote_id }, ctx: { userID } }) =>
      zql.vote_offline_tally
        .where('vote_id', vote_id)
        .whereExists('vote', vote => applyVoteManagerQueryAccess(vote, userID))
        .related('choice')
        .related('updated_by')
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type VoteWithDetailsRow = QueryRowType<typeof voteQueries.votesWithDetails>;
export type VotesByAgendaItemsRow = QueryRowType<typeof voteQueries.byAgendaItems>;
export type VoteByAgendaItemRow = QueryRowType<typeof voteQueries.byAgendaItem>;
export type VoteByIdRow = QueryRowType<typeof voteQueries.byId>;
export type ChoicesByVoteRow = QueryRowType<typeof voteQueries.choicesByVote>;
export type IndicativeDecisionResultRow = QueryRowType<typeof voteQueries.indicativeResults>;
export type FinalDecisionResultRow = QueryRowType<typeof voteQueries.finalResults>;
export type UserIndicativeVoterParticipationRow = QueryRowType<
  typeof voteQueries.userIndicativeParticipation
>;
export type UserFinalVoterParticipationRow = QueryRowType<
  typeof voteQueries.userFinalParticipation
>;
export type UserVoterRow = QueryRowType<typeof voteQueries.userVoter>;
export type VoteOfflineTallyRow = QueryRowType<typeof voteQueries.offlineTalliesByVote>;
