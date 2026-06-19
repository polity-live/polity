import { describe, expect, it } from 'vitest';
import { getDelegateMembersPerSeatInfo } from '../delegateRatio';

describe('getDelegateMembersPerSeatInfo', () => {
  it('returns the exact members-per-delegate ratio for ratio-based delegate assemblies', () => {
    expect(
      getDelegateMembersPerSeatInfo({
        event_type: 'delegate_assembly',
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: '1',
      })
    ).toEqual({
      count: 1,
      translationKey: 'features.delegates.ratio.oneMember',
    });
  });

  it('falls back to the server default when the ratio is invalid', () => {
    expect(
      getDelegateMembersPerSeatInfo({
        event_type: 'delegate_assembly',
        delegate_seat_allocation_type: 'members_per_delegate',
        main_group_delegate_allocation_mode: 'not-a-number',
      })
    ).toEqual({
      count: 50,
      translationKey: 'features.delegates.ratio.members',
    });
  });

  it('does not return ratio info for fixed-total delegate assemblies', () => {
    expect(
      getDelegateMembersPerSeatInfo({
        event_type: 'delegate_assembly',
        delegate_seat_allocation_type: 'fixed_total',
        main_group_delegate_allocation_mode: '1',
      })
    ).toBeNull();
  });
});
