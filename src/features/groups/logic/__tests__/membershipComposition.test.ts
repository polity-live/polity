import { describe, expect, it } from 'vitest';
import {
  buildMembershipCompositionBuckets,
  DIRECT_WITHOUT_PATH_LABEL,
  resolveMembershipProvenance,
} from '../membershipComposition';

function group(
  id: string,
  groupType: 'base' | 'hierarchical' | 'sibling',
  overrides: Partial<{
    name: string;
    sibling_membership_mode: 'parliament' | 'elected' | null;
    connected_group_id: string | null;
  }> = {}
) {
  return {
    id,
    name: overrides.name ?? id,
    group_type: groupType,
    sibling_membership_mode: overrides.sibling_membership_mode ?? null,
    connected_group_id: overrides.connected_group_id ?? null,
  };
}

function membership(
  id: string,
  overrides: Partial<{
    user_id: string;
    group_id: string | null;
    status: string;
    source: string;
    source_group_id: string | null;
    source_group: ReturnType<typeof group> | null;
    roles: { id: string; name: string }[];
  }> = {}
) {
  return {
    id,
    user_id: overrides.user_id ?? `user-${id}`,
    user: { id: overrides.user_id ?? `user-${id}` },
    group_id: overrides.group_id ?? null,
    status: overrides.status ?? 'active',
    source: overrides.source ?? 'derived',
    source_group_id: overrides.source_group_id ?? null,
    source_group: overrides.source_group ?? null,
    roles: overrides.roles ?? [],
    role: overrides.roles?.[0] ?? null,
  };
}

function relationship(id: string, parentGroupId: string, childGroupId: string) {
  return {
    id,
    group_id: parentGroupId,
    related_group_id: childGroupId,
    relationship_type: null,
    with_right: 'passiveVotingRight',
    status: 'active',
  };
}

function peerRelationship(id: string, firstGroupId: string, secondGroupId: string) {
  return {
    id,
    group_id: firstGroupId,
    related_group_id: secondGroupId,
    relationship_type: 'sibling',
    connection_type: 'peer',
    with_right: null,
    status: 'active',
  };
}

function rawGroup(id: string, name = id) {
  return { id, name } as ReturnType<typeof group>;
}

describe('membership composition provenance', () => {
  it('resolves part group and base group for a direct hierarchical leaf path', () => {
    const rootGroup = group('root', 'hierarchical');
    const baseGroup = group('base-a', 'base');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: rootGroup,
      memberships: [
        membership('membership-1', {
          source_group_id: 'base-a',
          source_group: baseGroup,
        }),
      ],
      relationships: [relationship('root-base-a', 'root', 'base-a')],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
    expect(resolvedMembership.provenanceBucketLabel).toBeNull();
  });

  it('uses the first group below the current hierarchy as the part group on longer paths', () => {
    const rootGroup = group('root', 'hierarchical');
    const baseGroup = group('base-a', 'base');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: rootGroup,
      memberships: [
        membership('membership-1', {
          source_group_id: 'base-a',
          source_group: baseGroup,
        }),
      ],
      relationships: [
        relationship('root-district', 'root', 'district'),
        relationship('district-base-a', 'district', 'base-a'),
      ],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'district', name: 'district' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
  });

  it('derives sibling elected provenance from the connected group membership', () => {
    const siblingGroup = group('parliament', 'sibling', { sibling_membership_mode: 'elected' });
    const connectedRoot = group('connected-root', 'hierarchical');
    const baseGroup = group('base-a', 'base');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: siblingGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_elected',
          source_group_id: 'connected-root',
          source_group: connectedRoot,
        }),
      ],
      rootMemberships: [
        membership('root-membership-1', {
          user_id: 'u1',
          source_group_id: 'base-a',
          source_group: baseGroup,
        }),
      ],
      relationships: [
        relationship('connected-root-district', 'connected-root', 'district'),
        relationship('district-base-a', 'district', 'base-a'),
      ],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'district', name: 'district' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
  });

  it('derives sibling parliament provenance from the selected source group membership', () => {
    const siblingGroup = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const sourceRoot = group('source-root', 'hierarchical');
    const baseGroup = group('base-a', 'base');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: siblingGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_parliament',
          source_group_id: 'source-root',
          source_group: sourceRoot,
        }),
      ],
      rootMemberships: [
        membership('root-membership-1', {
          user_id: 'u1',
          source_group_id: 'base-a',
          source_group: baseGroup,
        }),
      ],
      relationships: [
        relationship('source-root-local', 'source-root', 'local'),
        relationship('local-base-a', 'local', 'base-a'),
      ],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'local', name: 'local' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
  });

  it('shows a raw parliament base source group instead of the direct fallback', () => {
    const parliamentGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });

    const [resolvedMembership] = resolveMembershipProvenance({
      group: parliamentGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_parliament',
          source_group_id: 'source-base',
          source_group: rawGroup('source-base', 'Source Base'),
        }),
      ],
      relationships: [],
    });

    expect(resolvedMembership.partGroup).toMatchObject({
      id: 'source-base',
      name: 'Source Base',
    });
    expect(resolvedMembership.baseGroup).toMatchObject({
      id: 'source-base',
      name: 'Source Base',
    });
    expect(resolvedMembership.provenanceBucketLabel).toBeNull();
  });

  it('derives parliament provenance from raw hierarchy relationships when group_type is absent', () => {
    const parliamentGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });

    const [resolvedMembership] = resolveMembershipProvenance({
      group: parliamentGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_parliament',
          source_group_id: 'source-root',
          source_group: rawGroup('source-root'),
        }),
      ],
      rootMemberships: [
        membership('root-membership-1', {
          user_id: 'u1',
          group_id: 'source-root',
          source_group_id: 'base-a',
          source_group: rawGroup('base-a'),
        } as Parameters<typeof membership>[1]),
      ],
      relationships: [
        relationship('source-root-local', 'source-root', 'local'),
        relationship('local-base-a', 'local', 'base-a'),
      ],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'local', name: 'local' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
  });

  it('shows a parliament sibling source group as the feeding subgroup', () => {
    const parliamentGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });

    const [resolvedMembership] = resolveMembershipProvenance({
      group: parliamentGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_parliament',
          source_group_id: 'source-sibling',
          source_group: rawGroup('source-sibling', 'Source Sibling'),
        }),
      ],
      relationships: [peerRelationship('source-sibling-peer', 'source-sibling', 'source-root')],
    });

    expect(resolvedMembership.partGroup).toMatchObject({
      id: 'source-sibling',
      name: 'Source Sibling',
    });
    expect(resolvedMembership.baseGroup).toMatchObject({
      id: 'source-sibling',
      name: 'Source Sibling',
    });
    expect(resolvedMembership.provenanceBucketLabel).toBeNull();
  });

  it('keeps the sibling source as subgroup while showing a deeper base group when available', () => {
    const parliamentGroup = group('assembly', 'sibling', {
      sibling_membership_mode: 'parliament',
    });

    const [resolvedMembership] = resolveMembershipProvenance({
      group: parliamentGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_parliament',
          source_group_id: 'source-sibling',
          source_group: rawGroup('source-sibling', 'Source Sibling'),
        }),
      ],
      rootMemberships: [
        membership('source-sibling-membership-1', {
          user_id: 'u1',
          group_id: 'source-sibling',
          source: 'sibling_parliament',
          source_group_id: 'base-a',
          source_group: rawGroup('base-a', 'Base A'),
        } as Parameters<typeof membership>[1]),
      ],
      relationships: [peerRelationship('source-sibling-peer', 'source-sibling', 'source-root')],
    });

    expect(resolvedMembership.partGroup).toMatchObject({
      id: 'source-sibling',
      name: 'Source Sibling',
    });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'Base A' });
  });

  it('treats a base root group as both part group and base group', () => {
    const siblingGroup = group('parliament', 'sibling', { sibling_membership_mode: 'elected' });
    const baseGroup = group('base-a', 'base');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: siblingGroup,
      memberships: [
        membership('membership-1', {
          user_id: 'u1',
          source: 'sibling_elected',
          source_group_id: 'base-a',
          source_group: baseGroup,
        }),
      ],
      relationships: [],
    });

    expect(resolvedMembership.partGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
    expect(resolvedMembership.baseGroup).toMatchObject({ id: 'base-a', name: 'base-a' });
  });

  it('falls back to the direct bucket when no clean source path exists', () => {
    const rootGroup = group('root', 'hierarchical');

    const [resolvedMembership] = resolveMembershipProvenance({
      group: rootGroup,
      memberships: [membership('membership-1', { source: 'direct', source_group_id: null })],
      relationships: [],
    });

    expect(resolvedMembership.partGroup).toBeNull();
    expect(resolvedMembership.baseGroup).toBeNull();
    expect(resolvedMembership.provenanceBucketLabel).toBe(DIRECT_WITHOUT_PATH_LABEL);
  });
});

describe('membership composition aggregation', () => {
  it('counts active and offline memberships in the same hierarchy bucket', () => {
    const buckets = buildMembershipCompositionBuckets([
      {
        id: 'active-membership',
        partGroup: { id: 'district-a', name: 'District A', group_type: 'hierarchical' },
        baseGroup: { id: 'base-a', name: 'Base A', group_type: 'base' },
        provenanceBucketLabel: null,
        roles: [{ id: 'member', name: 'Member' }],
      },
      {
        id: 'offline-membership',
        user_id: 'offline:offline-member-1',
        partGroup: { id: 'district-a', name: 'District A', group_type: 'hierarchical' },
        baseGroup: { id: 'base-a', name: 'Base A', group_type: 'base' },
        provenanceBucketLabel: null,
        roles: [{ id: 'member', name: 'Member' }],
      },
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toEqual(
      expect.objectContaining({
        key: 'district-a',
        label: 'District A',
        memberCount: 2,
        leadershipAssignmentCount: 0,
        memberPercentage: 100,
        leadershipPercentage: 0,
      })
    );
  });

  it('counts members once and leadership roles per assignment', () => {
    const buckets = buildMembershipCompositionBuckets([
      {
        id: 'm1',
        partGroup: { id: 'district-a', name: 'District A', group_type: 'hierarchical' },
        baseGroup: { id: 'base-a', name: 'Base A', group_type: 'base' },
        provenanceBucketLabel: null,
        roles: [{ id: 'member', name: 'Member' }],
      },
      {
        id: 'm2',
        partGroup: { id: 'district-a', name: 'District A', group_type: 'hierarchical' },
        baseGroup: { id: 'base-b', name: 'Base B', group_type: 'base' },
        provenanceBucketLabel: null,
        roles: [{ id: 'chair', name: 'Chair' }],
      },
      {
        id: 'm3',
        partGroup: { id: 'district-b', name: 'District B', group_type: 'hierarchical' },
        baseGroup: { id: 'base-c', name: 'Base C', group_type: 'base' },
        provenanceBucketLabel: null,
        roles: [
          { id: 'chair', name: 'Chair' },
          { id: 'treasurer', name: 'Treasurer' },
        ],
      },
    ]);

    expect(buckets).toEqual([
      expect.objectContaining({
        key: 'district-a',
        label: 'District A',
        memberCount: 2,
        leadershipAssignmentCount: 1,
      }),
      expect.objectContaining({
        key: 'district-b',
        label: 'District B',
        memberCount: 1,
        leadershipAssignmentCount: 2,
      }),
    ]);

    const memberPercentageSum = buckets.reduce((sum, bucket) => sum + bucket.memberPercentage, 0);
    const leadershipPercentageSum = buckets.reduce(
      (sum, bucket) => sum + bucket.leadershipPercentage,
      0
    );

    expect(memberPercentageSum).toBeCloseTo(100, 5);
    expect(leadershipPercentageSum).toBeCloseTo(100, 5);
  });
});
