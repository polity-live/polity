import { describe, expect, it } from 'vitest';

import { resolveMembershipProvenance } from '../membershipComposition';

const siblingGroup = (id: string) => ({
  id,
  name: id,
  group_type: 'sibling' as const,
  sibling_membership_mode: 'parliament' as const,
});

const membership = (
  id: string,
  userId: string,
  groupId: string | null,
  sourceGroupId: string,
  sourceGroup?: ReturnType<typeof siblingGroup>
) => ({
  id,
  user_id: userId,
  user: { id: userId },
  group_id: groupId,
  status: 'active',
  source: 'derived',
  source_group_id: sourceGroupId,
  source_group: sourceGroup ?? null,
  roles: [],
  role: null,
});

describe('nested sibling provenance fallback', () => {
  it('normalizes a non-empty nested source id when no lookup or embedded group exists', () => {
    const assembly = siblingGroup('assembly');
    const sourceSibling = siblingGroup('source-sibling');

    const [resolved] = resolveMembershipProvenance({
      group: assembly,
      memberships: [membership('derived', 'user-1', 'assembly', 'source-sibling', sourceSibling)],
      rootMemberships: [
        membership('source-membership', 'user-1', 'source-sibling', 'unknown-nested-source'),
      ],
      relationships: [],
    });

    expect(resolved).toMatchObject({
      partGroup: { id: 'source-sibling' },
      baseGroup: { id: 'unknown-nested-source', name: 'unknown-nested-source' },
      provenanceBucketLabel: null,
    });
  });
});
