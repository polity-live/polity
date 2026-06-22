import { describe, expect, it } from 'vitest';

import { getEffectiveCRVotingPhase, getEffectiveVotingPhase } from '../agendaUiHelpers';

describe('agendaUiHelpers', () => {
  describe('getEffectiveVotingPhase', () => {
    it('keeps an explicit pending phase', () => {
      expect(getEffectiveVotingPhase('pending', null)).toBe('pending');
    });
  });

  describe('getEffectiveCRVotingPhase', () => {
    it('prefers the vote phase over a pending timeline link', () => {
      expect(
        getEffectiveCRVotingPhase({
          status: 'pending',
          vote: { status: 'final' },
        })
      ).toBe('final');
    });

    it('uses a pending timeline link when the vote has no phase yet', () => {
      expect(
        getEffectiveCRVotingPhase({
          status: 'pending',
          vote: {},
        })
      ).toBe('pending');
    });

    it('prefers an indicative vote phase over a pending timeline link', () => {
      expect(
        getEffectiveCRVotingPhase({
          status: 'pending',
          vote: { status: 'indicative' },
        })
      ).toBe('indication');
    });

    it('treats a completed timeline link as closed when the vote has no phase', () => {
      expect(
        getEffectiveCRVotingPhase({
          status: 'completed',
          vote: {},
        })
      ).toBe('closed');
    });
  });
});
