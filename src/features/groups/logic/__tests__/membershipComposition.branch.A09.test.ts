import { describe, expect, it } from 'vitest';

import { resolveMembershipProvenance } from '../membershipComposition';

describe('membership composition remaining branch A09', () => {
  it('falls back when a derived sibling membership names an unavailable root group', () => {
    const [resolved] = resolveMembershipProvenance({
      group: {
        id: 'assembly',
        name: 'Assembly',
        group_type: 'sibling',
        sibling_membership_mode: 'parliament',
      },
      memberships: [
        {
          id: 'membership',
          user_id: 'user-1',
          user: { id: 'user-1' },
          group_id: 'assembly',
          status: 'active',
          source: 'derived',
          source_group_id: 'missing-root',
          source_group: null,
          roles: [],
          role: null,
        },
      ],
      rootMemberships: [],
      relationships: [],
    });

    expect(resolved).toMatchObject({
      partGroup: { id: 'missing-root' },
      baseGroup: { id: 'missing-root' },
    });
  });
});
