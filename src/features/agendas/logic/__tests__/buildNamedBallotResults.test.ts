import { describe, expect, it } from 'vitest';
import {
  buildNamedElectionResultsModel,
  buildNamedVoteResultsModel,
  resolveResultsPhase,
} from '../buildNamedBallotResults';

describe('buildNamedBallotResults', () => {
  it('resolves explicit final and unknown result phases', () => {
    expect(resolveResultsPhase('final')).toEqual({ phase: 'final', isClosed: false });
    expect(resolveResultsPhase('unknown')).toEqual({ phase: 'final', isClosed: false });
  });
  it('uses indicative participations and sorts eligible voters alphabetically', () => {
    const model = buildNamedVoteResultsModel({
      vote: {
        status: 'indicative',
        choices: [
          { id: 'yes', label: 'Yes', order_index: 0 },
          { id: 'no', label: 'No', order_index: 1 },
        ],
        voters: [
          { id: 'voter-1', user_id: 'user-1' },
          { id: 'voter-2', user_id: 'user-2' },
        ],
        indicative_participations: [
          {
            voter_id: 'voter-2',
            decisions: [{ choice_id: 'yes' }],
          },
        ],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Bob', last_name: 'Baker' },
        },
        {
          id: 'participant-2',
          user_id: 'user-2',
          user: { id: 'user-2', first_name: 'Alice', last_name: 'Able' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });

    expect(model.phase).toBe('indicative');
    expect(model.groups[0]?.rows.map(row => row.displayName)).toEqual(['Alice Able', 'Bob Baker']);
    expect(model.groups[0]?.rows[0]).toMatchObject({
      selections: ['Yes'],
      status: 'recorded',
      isStruckThrough: false,
    });
    expect(model.groups[0]?.rows[1]).toMatchObject({
      status: 'pending',
      isStruckThrough: false,
    });
  });

  it('marks non-participants with strike-through only after closure', () => {
    const model = buildNamedVoteResultsModel({
      vote: {
        status: 'closed',
        choices: [{ id: 'yes', label: 'Yes', order_index: 0 }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        final_participations: [],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Chris', last_name: 'Clark' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });

    expect(model.phase).toBe('final');
    expect(model.isClosed).toBe(true);
    expect(model.groups[0]?.rows[0]).toMatchObject({
      status: 'not_participated',
      isStruckThrough: true,
      selections: [],
    });
  });

  it('keeps election list selections in ballot order', () => {
    const model = buildNamedElectionResultsModel({
      election: {
        status: 'final',
        candidates: [
          {
            id: 'candidate-b',
            order_index: 1,
            user: { id: 'candidate-b', first_name: 'Bravo', last_name: 'Candidate' },
          },
          {
            id: 'candidate-a',
            order_index: 0,
            user: { id: 'candidate-a', first_name: 'Alpha', last_name: 'Candidate' },
          },
        ],
        electors: [{ id: 'elector-1', user_id: 'user-1' }],
        final_participations: [
          {
            elector_id: 'elector-1',
            selections: [{ candidate_id: 'candidate-b' }, { candidate_id: 'candidate-a' }],
          },
        ],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Dana', last_name: 'Delegate' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });

    expect(model.groups[0]?.rows[0]?.selections).toEqual(['Alpha Candidate', 'Bravo Candidate']);
  });

  it('adds total option summaries for ungrouped election results', () => {
    const model = buildNamedElectionResultsModel({
      election: {
        status: 'final',
        candidates: [
          {
            id: 'candidate-a',
            order_index: 0,
            user: { id: 'candidate-a', first_name: 'Alex', last_name: 'Candidate' },
          },
        ],
        electors: [{ id: 'elector-1', user_id: 'user-1' }],
        final_participations: [
          {
            elector_id: 'elector-1',
            selections: [{ candidate_id: 'candidate-a' }],
          },
        ],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Dana', last_name: 'Delegate' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });

    expect(model.totalOptionSummaries).toEqual([
      {
        id: 'candidate-a',
        label: 'Alex Candidate',
        namedCount: 1,
        offlineCount: 0,
        totalCount: 1,
      },
    ]);
  });

  it('counts final offline election tallies in total option summaries', () => {
    const model = buildNamedElectionResultsModel({
      election: {
        status: 'final',
        candidates: [
          {
            id: 'candidate-a',
            order_index: 0,
            user: { id: 'candidate-a', first_name: 'Alpha', last_name: 'Candidate' },
          },
          {
            id: 'candidate-b',
            order_index: 1,
            user: { id: 'candidate-b', first_name: 'Bravo', last_name: 'Candidate' },
          },
        ],
        electors: [{ id: 'elector-1', user_id: 'user-1' }],
        final_participations: [
          {
            elector_id: 'elector-1',
            selections: [{ candidate_id: 'candidate-a' }],
          },
        ],
        offline_tallies: [
          { candidate_id: 'candidate-a', phase: 'final', count: 2 },
          { candidate_id: 'candidate-b', phase: 'final', count: 1 },
          { candidate_id: 'candidate-b', phase: 'indicative', count: 5 },
        ],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Dana', last_name: 'Delegate' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });

    expect(model.totalOptionSummaries).toEqual([
      {
        id: 'candidate-a',
        label: 'Alpha Candidate',
        namedCount: 1,
        offlineCount: 2,
        totalCount: 3,
      },
      {
        id: 'candidate-b',
        label: 'Bravo Candidate',
        namedCount: 0,
        offlineCount: 1,
        totalCount: 1,
      },
    ]);
  });

  it('groups named results by source group and aggregates counts per option', () => {
    const model = buildNamedVoteResultsModel({
      vote: {
        status: 'final',
        choices: [
          { id: 'yes', label: 'Yes', order_index: 0 },
          { id: 'no', label: 'No', order_index: 1 },
        ],
        voters: [
          { id: 'voter-1', user_id: 'user-1' },
          { id: 'voter-2', user_id: 'user-2' },
          { id: 'voter-3', user_id: 'user-3' },
        ],
        final_participations: [
          { voter_id: 'voter-1', decisions: [{ choice_id: 'yes' }] },
          { voter_id: 'voter-2', decisions: [{ choice_id: 'yes' }] },
          { voter_id: 'voter-3', decisions: [{ choice_id: 'no' }] },
        ],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Alice', last_name: 'Able' },
          source_group: { id: 'group-a', name: 'Alpha' },
        },
        {
          id: 'participant-2',
          user_id: 'user-2',
          user: { id: 'user-2', first_name: 'Bea', last_name: 'Baker' },
          source_group: { id: 'group-a', name: 'Alpha' },
        },
        {
          id: 'participant-3',
          user_id: 'user-3',
          user: { id: 'user-3', first_name: 'Carl', last_name: 'Clark' },
          source_group: { id: 'group-b', name: 'Beta' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: true,
    });

    expect(model.groups.map(group => group.label)).toEqual(['Alpha', 'Beta']);
    expect(model.groups[0]).toMatchObject({
      eligibleCount: 2,
      recordedCount: 2,
    });
    expect(model.groups[0]?.optionSummaries).toEqual([{ id: 'yes', label: 'Yes', count: 2 }]);
    expect(model.groups[1]?.optionSummaries).toEqual([{ id: 'no', label: 'No', count: 1 }]);
  });

  it('keeps grouped election summaries named while total summaries include offline tallies', () => {
    const model = buildNamedElectionResultsModel({
      election: {
        status: 'closed',
        candidates: [
          {
            id: 'candidate-a',
            order_index: 0,
            user: { id: 'candidate-a', first_name: 'Alpha', last_name: 'Candidate' },
          },
          {
            id: 'candidate-b',
            order_index: 1,
            user: { id: 'candidate-b', first_name: 'Bravo', last_name: 'Candidate' },
          },
        ],
        electors: [
          { id: 'elector-1', user_id: 'user-1' },
          { id: 'elector-2', user_id: 'user-2' },
        ],
        final_participations: [
          { elector_id: 'elector-1', selections: [{ candidate_id: 'candidate-a' }] },
          { elector_id: 'elector-2', selections: [{ candidate_id: 'candidate-b' }] },
        ],
        offline_tallies: [{ candidate_id: 'candidate-a', phase: 'final', count: 3 }],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Alice', last_name: 'Able' },
          source_group: { id: 'group-a', name: 'Alpha' },
        },
        {
          id: 'participant-2',
          user_id: 'user-2',
          user: { id: 'user-2', first_name: 'Bea', last_name: 'Baker' },
          source_group: { id: 'group-b', name: 'Beta' },
        },
      ],
      confirmedOfflineParticipants: [
        {
          id: 'offline-1',
          first_name: 'Otto',
          last_name: 'Offline',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
          group_offline_member: {
            group: { id: 'group-a', name: 'Alpha' },
          },
        },
      ],
      groupedBySourceGroup: true,
    });

    expect(model.groups[0]?.optionSummaries).toEqual([
      { id: 'candidate-a', label: 'Alpha Candidate', count: 1 },
    ]);
    expect(model.groups[1]?.optionSummaries).toEqual([
      { id: 'candidate-b', label: 'Bravo Candidate', count: 1 },
    ]);
    expect(model.totalOptionSummaries).toEqual([
      {
        id: 'candidate-a',
        label: 'Alpha Candidate',
        namedCount: 1,
        offlineCount: 3,
        totalCount: 4,
      },
      {
        id: 'candidate-b',
        label: 'Bravo Candidate',
        namedCount: 1,
        offlineCount: 0,
        totalCount: 1,
      },
    ]);
    expect(model.totalOfflineAggregatedCount).toBe(1);
  });

  it('marks confirmed offline participants without adding them to named aggregates', () => {
    const model = buildNamedVoteResultsModel({
      vote: {
        status: 'closed',
        choices: [{ id: 'yes', label: 'Yes', order_index: 0 }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        final_participations: [{ voter_id: 'voter-1', decisions: [{ choice_id: 'yes' }] }],
      },
      eligibleParticipants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          user: { id: 'user-1', first_name: 'Eva', last_name: 'Example' },
          source_group: { id: 'group-a', name: 'Alpha' },
        },
      ],
      confirmedOfflineParticipants: [
        {
          id: 'offline-1',
          first_name: 'Otto',
          last_name: 'Offline',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
          group_offline_member: {
            group: { id: 'group-a', name: 'Alpha' },
          },
        },
      ],
      groupedBySourceGroup: true,
    });

    expect(model.totalEligibleCount).toBe(1);
    expect(model.totalRecordedCount).toBe(1);
    expect(model.totalOfflineAggregatedCount).toBe(1);
    expect(model.groups[0]?.offlineAggregatedCount).toBe(1);
    expect(model.groups[0]?.rows[1]).toMatchObject({
      displayName: 'Otto Offline',
      status: 'offline_aggregated',
      selections: [],
    });
  });

  it('handles sparse final votes, unnamed and unknown groups, and invalid offline options', () => {
    const model = buildNamedVoteResultsModel({
      vote: {
        status: 'final',
        choices: undefined,
        voters: [{ id: 'voter-null', user_id: null }],
        final_participations: [
          { user_id: 'user-known', voter_id: null, decisions: [{ choice_id: null }] },
          { user_id: null, voter: { user_id: null }, voter_id: null, decisions: [] },
        ],
        offline_tallies: [{ phase: 'final', choice_id: null, count: 2 }],
      },
      eligibleParticipants: [
        { id: 'unknown', user_id: 'user-unknown' },
        {
          id: 'known',
          user_id: 'user-known',
          source_group: { id: 'group-1', name: '' },
        },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: true,
    });

    expect(model.phase).toBe('final');
    expect(model.groups.map(group => group.key)).toEqual(['group:group-1', 'group:unknown']);
    expect(model.groups[0].label).toBeTruthy();

    const reversed = buildNamedVoteResultsModel({
      vote: { status: 'final', choices: [], final_participations: undefined },
      eligibleParticipants: [
        { id: 'known', user_id: 'user-known', source_group: { id: 'group-1', name: 'Known' } },
        { id: 'unknown', user_id: 'user-unknown' },
      ],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: true,
    });
    expect(reversed.groups.at(-1)?.key).toBe('group:unknown');
  });

  it('handles sparse indicative elections and direct-user participations', () => {
    const empty = buildNamedElectionResultsModel({
      election: {
        status: 'indicative',
        candidates: undefined,
        electors: [{ id: 'elector-null', user_id: null }],
        indicative_participations: undefined,
      },
      eligibleParticipants: [],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });
    expect(empty.phase).toBe('indicative');
    expect(empty.groups).toEqual([]);

    const direct = buildNamedElectionResultsModel({
      election: {
        status: 'indicative',
        candidates: [{ id: 'candidate-1', name: 'Candidate', order_index: null }],
        indicative_participations: [
          { user_id: 'user-1', elector_id: null, selections: [{ candidate_id: 'candidate-1' }] },
          { user_id: null, elector: { user_id: null }, elector_id: null, selections: [] },
        ],
      },
      eligibleParticipants: [{ id: 'participant-1', user_id: 'user-1' }],
      confirmedOfflineParticipants: [],
      groupedBySourceGroup: false,
    });
    expect(direct.totalRecordedCount).toBe(1);

    expect(
      buildNamedElectionResultsModel({
        election: { status: 'final', candidates: [], final_participations: undefined },
        eligibleParticipants: [],
        confirmedOfflineParticipants: [],
        groupedBySourceGroup: false,
      }).phase
    ).toBe('final');
  });
});
