import { describe, expect, it } from 'vitest';

import {
  getAgendaDisplayType,
  getEffectiveCRVotingPhase,
  getEffectiveVotingPhase,
  normalizeSearchToken,
  resolveAttendanceMode,
} from '../agendaUiHelpers';

describe('agendaUiHelpers', () => {
  describe('getEffectiveVotingPhase', () => {
    it('keeps an explicit pending phase', () => {
      expect(getEffectiveVotingPhase('pending', null)).toBe('pending');
    });

    it('applies closed, final, pending, and indication precedence', () => {
      expect(getEffectiveVotingPhase('final', 'closed')).toBe('closed');
      expect(getEffectiveVotingPhase('final', 'pending')).toBe('final');
      expect(getEffectiveVotingPhase(null, 'pending')).toBe('pending');
      expect(getEffectiveVotingPhase('indicative', 'unknown')).toBe('indication');
    });
  });

  describe('getEffectiveCRVotingPhase', () => {
    it('returns null without an item', () => {
      expect(getEffectiveCRVotingPhase()).toBeNull();
    });

    it('defaults a status-less item to the indication phase', () => {
      expect(getEffectiveCRVotingPhase({})).toBe('indication');
    });
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

  it('resolves attendance from explicit mode before legacy location type', () => {
    expect(resolveAttendanceMode({ attendance_mode: 'online' })).toBe('online');
    expect(resolveAttendanceMode({ attendance_mode: 'hybrid' })).toBe('hybrid');
    expect(resolveAttendanceMode({ location_type: 'online' })).toBe('online');
    expect(resolveAttendanceMode()).toBe('offline');
  });

  it('normalizes search tokens and maps agenda display types', () => {
    expect(normalizeSearchToken(null)).toBe('');
    expect(normalizeSearchToken(' Change_Request ')).toBe('changerequest');
    expect(getAgendaDisplayType('amendment')).toBe('vote');
    expect(getAgendaDisplayType('implementation_review')).toBe('vote');
    expect(getAgendaDisplayType('support_confirmation')).toBe('vote');
    expect(getAgendaDisplayType('election')).toBe('election');
    expect(getAgendaDisplayType('accreditation')).toBe('accreditation');
    expect(getAgendaDisplayType('unknown')).toBe('discussion');
  });
});
