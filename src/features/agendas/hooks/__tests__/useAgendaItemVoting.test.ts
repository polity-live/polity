import { describe, expect, it } from 'vitest';
import { calculateElectionStats, calculateVoteStats } from '../useAgendaItemVoting';

describe('useAgendaItemVoting offline tally aggregation', () => {
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
});
