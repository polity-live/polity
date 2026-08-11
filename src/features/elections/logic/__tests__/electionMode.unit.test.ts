import { describe, expect, it, vi } from 'vitest';

import {
  deriveElectionMaxVotes,
  getElectionModeLabel,
  getElectionModeSummaryLabel,
  getSeatCountLabel,
  normalizeDelegateElectionMode,
  normalizeElectionMode,
  resolveElectionMode,
  resolveElectionSeatCount,
} from '../electionMode';

const translate = vi.hoisted(() =>
  vi.fn((key: string, values?: object) => (values ? `${key}:${JSON.stringify(values)}` : key))
);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: object) => translate(key, values),
}));

describe('electionMode', () => {
  it('normalizes explicit modes and applies the requested fallback', () => {
    expect(normalizeElectionMode('single')).toBe('single');
    expect(normalizeElectionMode('list')).toBe('list');
    expect(normalizeElectionMode('invalid', 'list')).toBe('list');
    expect(normalizeDelegateElectionMode(null)).toBe('list');
  });

  it('resolves explicit, delegated, inferred and fallback modes in precedence order', () => {
    expect(resolveElectionMode({ electionMode: 'single', delegateAssignmentMode: 'list' })).toBe(
      'single'
    );
    expect(resolveElectionMode({ electionMode: 'invalid', delegateAssignmentMode: 'list' })).toBe(
      'list'
    );
    expect(resolveElectionMode({ seatCount: 2 })).toBe('list');
    expect(resolveElectionMode({ seatCount: 1, maxVotes: 2 })).toBe('list');
    expect(resolveElectionMode({ fallbackMode: 'list' })).toBe('list');
    expect(resolveElectionMode({})).toBe('single');
  });

  it('forces one seat for single elections', () => {
    expect(resolveElectionSeatCount({ electionMode: 'single', seatCount: 9 })).toBe(1);
    expect(deriveElectionMaxVotes('single', 9)).toBe(1);
  });

  it.each([
    [{ electionMode: 'list', seatCount: 3 }, 3],
    [{ electionMode: 'list', seatCount: 0, fallbackSeatCount: 4 }, 4],
    [{ electionMode: 'list', seatCount: Number.NaN, fallbackSeatCount: 0, maxVotes: 2.9 }, 2],
    [{ electionMode: 'list', seatCount: -5 }, 1],
    [{ electionMode: 'list' }, 1],
  ] as const)('normalizes list seat counts', (args, expected) => {
    expect(resolveElectionSeatCount(args)).toBe(expected);
  });

  it('derives normalized list max votes', () => {
    expect(deriveElectionMaxVotes('list', 3.8)).toBe(3);
    expect(deriveElectionMaxVotes('list', null)).toBe(1);
  });

  it('translates mode and singular/plural seat labels', () => {
    expect(getElectionModeLabel('single')).toBe('features.elections.mode.single');
    expect(getSeatCountLabel(1)).toBe('1 features.elections.mode.position');
    expect(getSeatCountLabel(2)).toBe('2 features.elections.mode.positions');
  });

  it('builds list summaries and falls back to a single position', () => {
    expect(getElectionModeSummaryLabel('list', 2)).toContain('"seatCount":2');
    expect(getElectionModeSummaryLabel('list', 0)).toContain('"seatCount":1');
    expect(getElectionModeSummaryLabel('single', 4)).toBe('features.elections.mode.single');
  });
});
