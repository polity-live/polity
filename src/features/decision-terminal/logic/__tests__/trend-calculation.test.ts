import { describe, expect, it } from 'vitest';

import {
  calculateSupportPercentage,
  calculateTrend,
  calculateTurnout,
  detectVolatility,
  getTrendWithVolatility,
  isQuorumReached,
  type HistoricalVoteSnapshot,
} from '../trend-calculation';

const vote = (support: number, oppose = 0, abstain = 0) => ({ support, oppose, abstain });
const snapshot = (support: number, oppose: number): HistoricalVoteSnapshot => ({
  timestamp: new Date(0),
  votes: vote(support, oppose),
});

describe('trend-calculation', () => {
  it('returns stable without usable historical totals', () => {
    expect(calculateTrend(vote(1), null)).toEqual({ direction: 'stable', percentage: 0 });
    expect(calculateTrend(vote(0), vote(1))).toEqual({ direction: 'stable', percentage: 0 });
    expect(calculateTrend(vote(1), vote(0))).toEqual({ direction: 'stable', percentage: 0 });
  });

  it.each([
    [vote(51, 49), vote(50, 50), { direction: 'up', percentage: 1 }],
    [vote(49, 51), vote(50, 50), { direction: 'down', percentage: -1 }],
    [vote(503, 497), vote(500, 500), { direction: 'stable', percentage: 0 }],
  ] as const)(
    'calculates support direction and rounded change',
    (current, historical, expected) => {
      expect(calculateTrend(current, historical)).toEqual(expected);
    }
  );

  it('requires at least three snapshots for volatility', () => {
    expect(detectVolatility([])).toBe(false);
    expect(detectVolatility([snapshot(1, 1), snapshot(2, 1)])).toBe(false);
  });

  it('ignores stable periods and detects repeated direction changes', () => {
    expect(
      detectVolatility([snapshot(50, 50), snapshot(50, 50), snapshot(60, 40), snapshot(40, 60)])
    ).toBe(true);
    expect(detectVolatility([snapshot(30, 70), snapshot(40, 60), snapshot(50, 50)])).toBe(false);
  });

  it('reports volatile direction with the overall oldest-snapshot change', () => {
    const snapshots = [snapshot(50, 50), snapshot(60, 40), snapshot(40, 60)];
    expect(getTrendWithVolatility(vote(70, 30), snapshots)).toEqual({
      direction: 'volatile',
      percentage: 20,
    });
  });

  it('compares against the most recent snapshot or null when not volatile', () => {
    expect(getTrendWithVolatility(vote(60, 40), [snapshot(50, 50)])).toEqual({
      direction: 'up',
      percentage: 10,
    });
    expect(getTrendWithVolatility(vote(60, 40), [])).toEqual({
      direction: 'stable',
      percentage: 0,
    });
  });

  it('calculates support, turnout and quorum boundaries', () => {
    expect(calculateSupportPercentage(vote(0))).toBe(0);
    expect(calculateSupportPercentage(vote(2, 1, 1))).toBe(50);
    expect(calculateTurnout(4, 0)).toBe(0);
    expect(calculateTurnout(2, 3)).toBe(67);
    expect(isQuorumReached(49)).toBe(false);
    expect(isQuorumReached(50)).toBe(true);
    expect(isQuorumReached(20, 20)).toBe(true);
  });
});
