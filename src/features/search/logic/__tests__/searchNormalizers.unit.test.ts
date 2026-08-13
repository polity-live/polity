import { describe, expect, it } from 'vitest';
import {
  normalizeAmendmentStatus,
  normalizeElectionStatus,
  normalizeVotePhase,
} from '../searchNormalizers';

describe('search status normalizers', () => {
  it.each([
    [undefined, 'edit'],
    ['VOTE_INTERNAL', 'vote_internal'],
    ['unknown', 'edit'],
  ])('normalizes amendment status %s', (input, expected) => {
    expect(normalizeAmendmentStatus(input)).toBe(expected);
  });

  it.each([
    'open',
    'closing_soon',
    'last_hour',
    'final_minutes',
    'passed',
    'failed',
    'tied',
  ] as const)('preserves vote phase %s case-insensitively', phase => {
    expect(normalizeVotePhase(phase.toUpperCase())).toBe(phase);
  });

  it('defaults absent and unknown vote phases', () => {
    expect(normalizeVotePhase(undefined)).toBe('open');
    expect(normalizeVotePhase('unknown')).toBe('open');
  });

  it.each([
    ['nominations_open', 'nominations_open'],
    ['voting_open', 'voting_open'],
    ['closed', 'closed'],
    ['runoff_required', 'closed'],
    ['no_winner', 'closed'],
    ['winner_announced', 'winner_announced'],
  ] as const)('normalizes election status %s', (input, expected) => {
    expect(normalizeElectionStatus(input.toUpperCase())).toBe(expected);
  });

  it('defaults absent and unknown election statuses', () => {
    expect(normalizeElectionStatus(undefined)).toBe('voting_open');
    expect(normalizeElectionStatus('unknown')).toBe('voting_open');
  });
});
