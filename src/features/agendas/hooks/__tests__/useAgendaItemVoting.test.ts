import { describe, expect, it } from 'vitest';
import {
  calculateElectionStats,
  calculateVoteStats,
  getVotingPhase,
  useAgendaItemVoting,
} from '../useAgendaItemVoting';

describe('useAgendaItemVoting offline tally aggregation', () => {
  it('normalizes every supported status and unknown values', () => {
    expect(getVotingPhase()).toBe('unknown');
    expect(getVotingPhase(null)).toBe('unknown');
    expect(getVotingPhase('indicative')).toBe('indicative');
    expect(getVotingPhase('final')).toBe('final');
    expect(getVotingPhase('closed')).toBe('closed');
    expect(getVotingPhase('runoff_required')).toBe('closed');
    expect(getVotingPhase('no_winner')).toBe('closed');
    expect(getVotingPhase('legacy')).toBe('unknown');
    expect(useAgendaItemVoting()).toEqual({
      getVotingPhase,
      calculateElectionStats,
      calculateVoteStats,
    });
  });

  it('returns empty statistics when there are no candidates or choices', () => {
    expect(calculateElectionStats([], [], [])).toEqual({
      candidates: [],
      totalIndicative: 0,
      totalFinal: 0,
    });
    expect(calculateVoteStats([], [], [])).toEqual({
      choices: [],
      totalIndicative: 0,
      totalFinal: 0,
    });
  });

  it('adds offline tallies into vote totals and percentages', () => {
    const choices = [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ] as unknown as Parameters<typeof calculateVoteStats>[0];

    const result = calculateVoteStats(
      choices,
      [{ choice_id: 'yes' }],
      [{ choice_id: 'no' }],
      [
        { phase: 'indicative', choice_id: 'yes', count: 2 },
        { phase: 'final', choice_id: 'no', count: 3 },
      ]
    );

    expect(result.totalIndicative).toBe(3);
    expect(result.totalFinal).toBe(4);
    expect(result.choices[0]?.indicativeCount).toBe(3);
    expect(result.choices[1]?.finalCount).toBe(4);
    expect(Math.round(result.choices[0]?.indicativePercentage ?? 0)).toBe(100);
    expect(Math.round(result.choices[1]?.finalPercentage ?? 0)).toBe(100);
  });

  it('adds offline tallies into election totals and percentages', () => {
    const candidates = [{ id: 'alice' }, { id: 'bob' }] as unknown as Parameters<
      typeof calculateElectionStats
    >[0];

    const result = calculateElectionStats(
      candidates,
      [{ candidate_id: 'alice' }],
      [{ candidate_id: 'alice' }, { candidate_id: 'bob' }],
      [
        { phase: 'indicative', candidate_id: 'bob', count: 2 },
        { phase: 'final', candidate_id: 'alice', count: 1 },
      ]
    );

    expect(result.totalIndicative).toBe(3);
    expect(result.totalFinal).toBe(3);
    expect(result.candidates[0]?.finalCount).toBe(2);
    expect(result.candidates[1]?.indicativeCount).toBe(2);
    expect(Math.round(result.candidates[0]?.finalPercentage ?? 0)).toBe(67);
  });

  it('ignores unrelated tallies and normalizes nullable counts and zero totals', () => {
    const candidates = [{ id: 'alice' }] as unknown as Parameters<typeof calculateElectionStats>[0];
    const election = calculateElectionStats(
      candidates,
      [],
      [],
      [
        { phase: 'other', candidate_id: 'alice', count: 9 },
        { phase: 'indicative', candidate_id: 'other', count: 3 },
        { phase: 'final', candidate_id: 'other', count: 4 },
        { phase: 'indicative', candidate_id: 'alice', count: null },
        { phase: 'final', candidate_id: 'alice', count: null },
      ]
    );
    expect(election.candidates[0]).toEqual(
      expect.objectContaining({
        indicativeCount: 0,
        finalCount: 0,
        indicativePercentage: 0,
        finalPercentage: 0,
      })
    );

    const choices = [{ id: 'yes', label: 'Yes' }] as unknown as Parameters<
      typeof calculateVoteStats
    >[0];
    const vote = calculateVoteStats(
      choices,
      [],
      [],
      [
        { phase: 'other', choice_id: 'yes', count: 9 },
        { phase: 'indicative', choice_id: 'other', count: 3 },
        { phase: 'final', choice_id: 'other', count: 4 },
        { phase: 'indicative', choice_id: 'yes', count: null },
        { phase: 'final', choice_id: 'yes', count: null },
      ]
    );
    expect(vote.choices[0]).toEqual(
      expect.objectContaining({
        indicativeCount: 0,
        finalCount: 0,
        indicativePercentage: 0,
        finalPercentage: 0,
      })
    );

    expect(calculateElectionStats(candidates, [], []).candidates[0]).toEqual(
      expect.objectContaining({ indicativePercentage: 0, finalPercentage: 0 })
    );
    expect(calculateVoteStats(choices, [], []).choices[0]).toEqual(
      expect.objectContaining({ indicativePercentage: 0, finalPercentage: 0 })
    );
  });
});
