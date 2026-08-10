import { describe, expect, it } from 'vitest';

import {
  formatCountPercent,
  formatInt,
  getDecisionTotal,
  getDelta,
  getElectionCandidateRows,
  getInitials,
  getResultBarClassName,
  getResultSnapshot,
  getVoteData,
  getVoteResultBarTone,
  hasHref,
  normalizeContextText,
  normalizePercent,
} from '../DecisionWidgetContent';
import {
  formatMobileDecisionCountPercent,
  getMobileDecisionInitials,
  getMobileElectionCandidateRows,
  normalizeMobileDecisionPercent,
} from '../MobileDecisionCard';

const decision = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'decision-1',
    sourceId: 'source-1',
    type: 'vote',
    title: 'Decision',
    body: 'Body',
    endsAt: new Date(),
    status: 'active',
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    isClosed: false,
    ...overrides,
  }) as any;

const candidates = [
  {
    id: 'winner',
    name: 'Ada Lovelace',
    votes: 3,
    indicationVotes: 1,
    actualPercentage: 75,
    indicationPercentage: 25,
    isWinner: true,
  },
  {
    id: 'runner-up',
    name: 'Grace Hopper',
    votes: 1,
    indicationVotes: 3,
    isWinner: false,
  },
  { id: 'empty', name: '', votes: undefined, indicationVotes: undefined, isWinner: false },
];

describe('DecisionWidgetContent result helpers', () => {
  it('formats numeric, percent, initials, context, and href edge cases', () => {
    expect(formatInt(null)).toBe('0');
    expect(formatInt(1.6)).toBe('2');
    expect(normalizePercent(Number.NaN)).toBe(0);
    expect(normalizePercent(-2)).toBe(0);
    expect(normalizePercent(120)).toBe(100);
    expect(normalizePercent(25)).toBe(25);
    expect(formatCountPercent(undefined, undefined)).toBe('0 · 0%');
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('   ')).toBe('?');
    expect(normalizeContextText('  A   B ')).toBe('a b');
    expect(normalizeContextText(null)).toBe('');
    expect(hasHref('/decision/1')).toBe(true);
    expect(hasHref('#')).toBe(false);
    expect(hasHref()).toBe(false);
  });

  it('selects vote data and calculates totals through each fallback', () => {
    expect(getVoteData(decision({ type: 'election' }))).toBeNull();
    const indicationVotes = { support: 2, oppose: 1, abstain: 0 };
    expect(
      getVoteData(decision({ isIndicationPhase: true, indicationVotes, votes: { support: 9 } }))
    ).toBe(indicationVotes);
    const finalVotes = { support: 3, oppose: 2, abstain: 1 };
    expect(getVoteData(decision({ votes: finalVotes }))).toBe(finalVotes);
    expect(getVoteData(decision())).toBeNull();

    expect(getDecisionTotal(decision({ votedCount: 2.6 }))).toBe(3);
    expect(getDecisionTotal(decision({ votes: finalVotes }))).toBe(6);
    expect(
      getDecisionTotal(decision({ type: 'election', isIndicationPhase: true, candidates }))
    ).toBe(4);
    expect(getDecisionTotal(decision({ type: 'election', candidates }))).toBe(4);
    expect(getDecisionTotal(decision())).toBe(0);
  });

  it('builds election and vote snapshots with label and value fallbacks', () => {
    const electionRows = getResultSnapshot(
      decision({ type: 'election', isIndicationPhase: true, candidates })
    );
    expect(electionRows.map(row => row.value)).toEqual([1, 3, 0]);
    expect(
      getResultSnapshot(decision({ type: 'election', isIndicationPhase: false, candidates })).map(
        row => row.value
      )
    ).toEqual([3, 1, 0]);
    expect(getResultSnapshot(decision({ type: 'election', candidates: undefined }))).toEqual([]);
    expect(
      getResultSnapshot(
        decision({
          votes: { support: 2, oppose: 1, abstain: 0 },
          choices: [{ id: 'yes', label: 'Yes' }],
        })
      ).map(row => row.label)
    ).toEqual(['Yes', 'Oppose', 'Abstain']);
    expect(getResultSnapshot(decision())).toEqual([]);
  });

  it('finds deltas and assigns all result tones', () => {
    const deltas = [{ key: 'vote:support', label: 'Support', value: 1, tone: 'success' as const }];
    expect(getDelta(deltas, 'vote:support')).toEqual(deltas[0]);
    expect(getDelta(undefined, 'vote:support')).toBeUndefined();
    const rows = [
      { key: 'a', label: 'A', value: 2, tone: 'success' as const },
      { key: 'b', label: 'B', value: 1, tone: 'danger' as const },
    ];
    expect(getVoteResultBarTone(decision(), rows[0], rows)).toBe('success');
    expect(getVoteResultBarTone(decision({ isClosed: true }), rows[1], rows)).toBe('danger');
    expect(
      getVoteResultBarTone(decision({ isClosed: true, status: 'passed' }), rows[0], rows)
    ).toBe('success');
    expect(
      getVoteResultBarTone(decision({ isClosed: true, status: 'failed' }), rows[0], rows)
    ).toBe('danger');
    const zeroRows = [{ key: 'z', label: 'Z', value: 0, tone: 'neutral' as const }];
    expect(getVoteResultBarTone(decision({ isClosed: true }), zeroRows[0], zeroRows)).toBe(
      'neutral'
    );
    expect(getResultBarClassName('success')).toContain('success');
    expect(getResultBarClassName('danger')).toContain('danger');
    expect(getResultBarClassName('neutral')).toContain('muted');
  });

  it('derives, ranks, and bounds election candidate rows in both phases', () => {
    expect(getElectionCandidateRows(decision())).toEqual([]);
    expect(getElectionCandidateRows(decision({ type: 'election', candidates: [] }))).toEqual([]);
    const finalRows = getElectionCandidateRows(
      decision({ type: 'election', isClosed: true, winnerName: 'Grace Hopper', candidates })
    );
    expect(finalRows).toHaveLength(3);
    expect(finalRows[0].isWinner).toBe(true);
    const indicationRows = getElectionCandidateRows(
      decision({ type: 'election', isIndicationPhase: true, candidates })
    );
    expect(indicationRows[0].percent).toBeGreaterThanOrEqual(0);
    const zeroRows = getElectionCandidateRows(
      decision({
        type: 'election',
        candidates: [
          { id: 'b', name: 'Same', votes: 0, indicationVotes: 0 },
          { id: 'a', name: 'Same', votes: 0, indicationVotes: 0 },
          { id: 'c', name: 'Alpha', votes: 0, indicationVotes: 0 },
        ],
      })
    );
    expect(zeroRows.every(row => row.percent === 0)).toBe(true);
    const nullExplicitRows = getElectionCandidateRows(
      decision({
        type: 'election',
        isIndicationPhase: true,
        candidates: [
          {
            id: 'nulls',
            name: 'Nulls',
            votes: 0,
            indicationVotes: 0,
            actualPercentage: null,
            indicationPercentage: null,
          },
        ],
      })
    );
    expect(nullExplicitRows[0].percent).toBe(0);
    expect(
      getElectionCandidateRows(
        decision({
          type: 'election',
          isIndicationPhase: false,
          candidates: [
            {
              id: 'nulls-final',
              name: 'Nulls final',
              votes: 0,
              indicationVotes: 0,
              actualPercentage: null,
              indicationPercentage: null,
            },
          ],
        })
      )[0].percent
    ).toBe(0);
  });
});

describe('MobileDecisionCard result helpers', () => {
  it('covers mobile formatting and candidate calculations', () => {
    expect(getMobileDecisionInitials('Ada Lovelace')).toBe('AL');
    expect(getMobileDecisionInitials('')).toBe('?');
    expect(normalizeMobileDecisionPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeMobileDecisionPercent(-1)).toBe(0);
    expect(normalizeMobileDecisionPercent(101)).toBe(100);
    expect(formatMobileDecisionCountPercent(undefined, undefined)).toBe('0 · 0%');
    expect(getMobileElectionCandidateRows(decision())).toEqual([]);
    expect(
      getMobileElectionCandidateRows(
        decision({ type: 'election', isIndicationPhase: true, candidates })
      )
    ).toHaveLength(3);
    expect(
      getMobileElectionCandidateRows(
        decision({ type: 'election', isClosed: true, winnerName: 'Grace Hopper', candidates })
      )[0].isWinner
    ).toBe(true);
    expect(
      getMobileElectionCandidateRows(
        decision({
          type: 'election',
          candidates: [
            { id: 'a', name: 'Same', votes: 0, indicationVotes: 0 },
            { id: 'b', name: 'Same', votes: 0, indicationVotes: 0 },
          ],
        })
      ).every(row => row.percent === 0)
    ).toBe(true);
    expect(
      getMobileElectionCandidateRows(
        decision({
          type: 'election',
          isIndicationPhase: true,
          candidates: [
            {
              id: 'nulls',
              name: 'Nulls',
              votes: 0,
              indicationVotes: 0,
              actualPercentage: null,
              indicationPercentage: null,
            },
          ],
        })
      )[0].percent
    ).toBe(0);
    expect(
      getMobileElectionCandidateRows(
        decision({
          type: 'election',
          isIndicationPhase: false,
          candidates: [
            {
              id: 'nulls-final',
              name: 'Nulls final',
              votes: 0,
              indicationVotes: 0,
              actualPercentage: null,
              indicationPercentage: null,
            },
          ],
        })
      )[0].percent
    ).toBe(0);
  });
});
