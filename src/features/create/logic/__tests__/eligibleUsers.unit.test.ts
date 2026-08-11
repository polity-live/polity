import { describe, expect, it } from 'vitest';

import {
  collectUserIds,
  getRowUserId,
  isActiveEventParticipantStatus,
  isActiveGroupMemberStatus,
  uniqueUserIds,
} from '../eligibleUsers';

describe('eligible user helpers', () => {
  it('normalizes active and absent relationship statuses', () => {
    expect(isActiveGroupMemberStatus('admin')).toBe(true);
    expect(isActiveGroupMemberStatus(undefined)).toBe(false);
    expect(isActiveEventParticipantStatus('confirmed')).toBe(true);
    expect(isActiveEventParticipantStatus(null)).toBe(false);
  });

  it('prefers a hydrated user id and falls back to the scalar id', () => {
    expect(getRowUserId({ user_id: 'scalar', user: { id: 'hydrated' } })).toBe('hydrated');
    expect(getRowUserId({ user_id: 'scalar', user: null })).toBe('scalar');
    expect(getRowUserId(undefined)).toBeNull();
  });

  it('deduplicates truthy ids across groups and rows', () => {
    expect(uniqueUserIds(['a', null], ['b', 'a', undefined])).toEqual(['a', 'b']);
    expect(
      collectUserIds([{ user_id: 'a' }, { user_id: 'ignored', user: { id: 'b' } }, {}])
    ).toEqual(['a', 'b']);
  });
});
