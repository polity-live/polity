import { describe, expect, it } from 'vitest';
import {
  getGroupAmendmentBadgeStatus,
  groupAmendmentsByDisplayStatus,
  normalizeGroupAmendmentDisplayStatus,
} from '@/features/groups/logic/groupAmendmentStatus';

describe('getGroupAmendmentBadgeStatus', () => {
  it('returns null without a usable status', () => {
    expect(getGroupAmendmentBadgeStatus()).toBeNull();
    expect(getGroupAmendmentBadgeStatus(null, undefined)).toBeNull();
  });

  it('preserves accepted versus approved badge states and collapses supported to accepted', () => {
    expect(getGroupAmendmentBadgeStatus('accepted')).toBe('accepted');
    expect(getGroupAmendmentBadgeStatus('supported')).toBe('accepted');
    expect(getGroupAmendmentBadgeStatus('approved')).toBe('approved');
    expect(getGroupAmendmentBadgeStatus('merged')).toBe('approved');
    expect(getGroupAmendmentBadgeStatus('completed')).toBe('approved');
  });

  it('applies rejected, withdrawn, approved, accepted, and pending precedence', () => {
    expect(getGroupAmendmentBadgeStatus('approved', 'rejected')).toBe('rejected');
    expect(getGroupAmendmentBadgeStatus('accepted', 'withdrawn')).toBe('withdrawn');
    expect(getGroupAmendmentBadgeStatus('pending', 'approved')).toBe('approved');
    expect(getGroupAmendmentBadgeStatus('pending', 'accepted')).toBe('accepted');
    expect(getGroupAmendmentBadgeStatus('pending')).toBe('pending');
  });

  it('maps unresolved scheduling states to pending', () => {
    expect(getGroupAmendmentBadgeStatus('forward_confirmed')).toBe('pending');
    expect(getGroupAmendmentBadgeStatus('scheduled', 'in_vote')).toBe('pending');
  });
});

describe('normalizeGroupAmendmentDisplayStatus', () => {
  it('returns null without a badge status', () => {
    expect(normalizeGroupAmendmentDisplayStatus()).toBeNull();
  });

  it('maps supported and approved states to accepted display group', () => {
    expect(normalizeGroupAmendmentDisplayStatus('supported')).toBe('accepted');
    expect(normalizeGroupAmendmentDisplayStatus('approved')).toBe('accepted');
    expect(normalizeGroupAmendmentDisplayStatus('merged')).toBe('accepted');
  });

  it('prefers rejected when mixed statuses are present', () => {
    expect(normalizeGroupAmendmentDisplayStatus('accepted', 'rejected')).toBe('rejected');
  });

  it('preserves withdrawn and pending display states', () => {
    expect(normalizeGroupAmendmentDisplayStatus('withdrawn')).toBe('withdrawn');
    expect(normalizeGroupAmendmentDisplayStatus('pending')).toBe('pending');
  });

  it('maps unresolved scheduling states to pending', () => {
    expect(normalizeGroupAmendmentDisplayStatus('forward_confirmed')).toBe('pending');
    expect(normalizeGroupAmendmentDisplayStatus('scheduled', 'in_vote')).toBe('pending');
  });
});

describe('groupAmendmentsByDisplayStatus', () => {
  it('groups accepted, pending, rejected, and withdrawn items', () => {
    const grouped = groupAmendmentsByDisplayStatus([
      { id: 'accepted', decision_status: 'accepted' },
      { id: 'pending', decision_status: 'pending' },
      { id: 'rejected', decision_status: 'rejected' },
      { id: 'withdrawn', decision_status: 'withdrawn' },
      { id: 'ignored', decision_status: 'supported' },
    ]);

    expect(grouped.accepted).toHaveLength(1);
    expect(grouped.pending).toHaveLength(1);
    expect(grouped.rejected).toHaveLength(1);
    expect(grouped.withdrawn).toHaveLength(1);
  });
});
