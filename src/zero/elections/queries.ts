import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import {
  applyElectionElectorOrManagerQueryAccess,
  applyElectionManagerQueryAccess,
  applyElectionQueryAccess,
} from '../rbac/query-access';
import { zql } from '../schema';

export const electionQueries = {
  // Election by agenda item with full details
  byAgendaItem: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      applyElectionQueryAccess(zql.election, userID)
        .where('agenda_item_id', agenda_item_id)
        .related('role', q => q.related('group'))
        .related('candidates', q => q.orderBy('order_index', 'asc').related('user'))
        .related('offline_tallies', q =>
          q
            .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
            .related('candidate')
            .related('updated_by')
        )
        .related('electors', q =>
          applyElectionElectorOrManagerQueryAccess(q, userID).related('user')
        )
        .related('indicative_participations', q =>
          q
            .whereExists('elector', elector =>
              applyElectionElectorOrManagerQueryAccess(elector, userID)
            )
            .related('elector')
            .related('selections', q2 => q2.related('candidate'))
        )
        .related('indicative_selections', q =>
          q
            .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
            .related('candidate')
        )
        .related('final_participations', q =>
          q
            .whereExists('elector', elector =>
              applyElectionElectorOrManagerQueryAccess(elector, userID)
            )
            .related('elector')
            .related('selections', q2 => q2.related('candidate'))
        )
        .related('final_selections', q =>
          q
            .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
            .related('candidate')
        )
  ),

  // Single election by ID with full details
  byId: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    applyElectionQueryAccess(zql.election, userID)
      .where('id', id)
      .related('agenda_item')
      .related('role', q => q.related('group'))
      .related('candidates', q => q.orderBy('order_index', 'asc').related('user'))
      .related('offline_tallies', q =>
        q
          .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
          .related('candidate')
          .related('updated_by')
      )
      .related('electors', q => applyElectionElectorOrManagerQueryAccess(q, userID).related('user'))
      .related('indicative_participations', q =>
        q
          .whereExists('elector', elector =>
            applyElectionElectorOrManagerQueryAccess(elector, userID)
          )
          .related('elector')
          .related('selections', q2 => q2.related('candidate'))
      )
      .related('indicative_selections', q =>
        q
          .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
          .related('candidate')
      )
      .related('final_participations', q =>
        q
          .whereExists('elector', elector =>
            applyElectionElectorOrManagerQueryAccess(elector, userID)
          )
          .related('elector')
          .related('selections', q2 => q2.related('candidate'))
      )
      .related('final_selections', q =>
        q
          .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
          .related('candidate')
      )
      .one()
  ),

  // Candidates for an election
  candidatesByElection: defineQuery(
    z.object({ election_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.election_candidate
        .where('election_id', election_id)
        .whereExists('election', election => applyElectionQueryAccess(election, userID))
        .orderBy('order_index', 'asc')
        .related('user')
        .related('indicative_selections', q =>
          q.whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
        )
        .related('final_selections', q =>
          q.whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
        )
  ),

  // Electors for an election
  electorsByElection: defineQuery(
    z.object({ election_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.elector
        .where('election_id', election_id)
        .whereExists('election', election => applyElectionQueryAccess(election, userID))
        .where(({ or, cmp, exists }: any) =>
          or(
            cmp('user_id', userID),
            exists('election', (election: any) => applyElectionManagerQueryAccess(election, userID))
          )
        )
        .related('user')
  ),

  // Indicative results — selections grouped by candidate
  indicativeResults: defineQuery(
    z.object({ election_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.indicative_candidate_selection
        .where('election_id', election_id)
        .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
        .related('candidate')
        .related('participation')
  ),

  // Final results — selections grouped by candidate
  finalResults: defineQuery(
    z.object({ election_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.final_candidate_selection
        .where('election_id', election_id)
        .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
        .related('candidate')
        .related('participation')
  ),

  // Check if user has participated in indicative phase
  userIndicativeParticipation: defineQuery(
    z.object({ election_id: z.string(), elector_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.indicative_elector_participation
        .where('election_id', election_id)
        .where('user_id', userID ?? '__anon__')
        .whereExists('election', election => applyElectionQueryAccess(election, userID))
        .related('selections', q => q.related('candidate'))
        .one()
  ),

  // Check if user has participated in final phase
  userFinalParticipation: defineQuery(
    z.object({ election_id: z.string(), elector_id: z.string() }),
    ({ args: { election_id, elector_id }, ctx: { userID } }) =>
      zql.final_elector_participation
        .where('election_id', election_id)
        .where('elector_id', elector_id)
        .whereExists('elector', elector => elector.where('user_id', userID))
        .whereExists('election', election => applyElectionQueryAccess(election, userID))
        .related('selections', q => q.related('candidate'))
        .one()
  ),

  // Elections with full details (for decision terminal/listing)
  electionsWithDetails: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyElectionQueryAccess(zql.election, userID)
      .related('candidates', q => q.related('user'))
      .related('agenda_item', q =>
        q.related('event', eventQuery =>
          eventQuery.related('participants', participantQuery =>
            participantQuery.where('user_id', userID ?? '__anon__').related('participant_roles')
          )
        )
      )
      .related('role')
      .related('offline_tallies', q =>
        q
          .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
          .related('candidate')
      )
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

  // Elections for search (role+group, candidates, agenda_item+event)
  electionsForSearch: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyElectionQueryAccess(zql.election, userID)
      .related('role', q => q.related('group'))
      .related('candidates')
      .related('agenda_item', q => q.related('event'))
  ),

  // Pending elections
  pendingElections: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    applyElectionQueryAccess(zql.election, userID)
      .where('status', 'pending')
      .related('role', q => q.related('group'))
  ),

  // User's elector record for an election
  userElector: defineQuery(
    z.object({ election_id: z.string(), user_id: z.string() }),
    ({ args: { election_id, user_id }, ctx: { userID } }) =>
      zql.elector
        .where('election_id', election_id)
        .where('user_id', user_id)
        .where('user_id', userID)
        .whereExists('election', election => applyElectionQueryAccess(election, userID))
        .one()
  ),

  offlineTalliesByElection: defineQuery(
    z.object({ election_id: z.string() }),
    ({ args: { election_id }, ctx: { userID } }) =>
      zql.election_offline_tally
        .where('election_id', election_id)
        .whereExists('election', election => applyElectionManagerQueryAccess(election, userID))
        .related('candidate')
        .related('updated_by')
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type ElectionByAgendaItemRow = QueryRowType<typeof electionQueries.byAgendaItem>;
export type ElectionByIdRow = QueryRowType<typeof electionQueries.byId>;
export type CandidatesByElectionRow = QueryRowType<typeof electionQueries.candidatesByElection>;
export type ElectorsByElectionRow = QueryRowType<typeof electionQueries.electorsByElection>;
export type IndicativeResultRow = QueryRowType<typeof electionQueries.indicativeResults>;
export type FinalResultRow = QueryRowType<typeof electionQueries.finalResults>;
export type UserIndicativeParticipationRow = QueryRowType<
  typeof electionQueries.userIndicativeParticipation
>;
export type UserFinalParticipationRow = QueryRowType<typeof electionQueries.userFinalParticipation>;
export type ElectionWithDetailsRow = QueryRowType<typeof electionQueries.electionsWithDetails>;
export type ElectionForSearchRow = QueryRowType<typeof electionQueries.electionsForSearch>;
export type UserElectorRow = QueryRowType<typeof electionQueries.userElector>;
export type ElectionOfflineTallyRow = QueryRowType<typeof electionQueries.offlineTalliesByElection>;
