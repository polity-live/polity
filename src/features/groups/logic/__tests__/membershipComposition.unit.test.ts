import { describe, expect, it } from 'vitest';
import {
  buildMembershipCompositionBuckets,
  collectPathsFromBaseToTarget,
  DIRECT_WITHOUT_PATH_LABEL,
  getMembershipProvenanceDisplayLabel,
  resolveMembershipProvenance,
  supportsMembershipComposition,
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

describe('membership composition support and labels', () => {
  it('supports only hierarchies and configured parliament/elected sibling groups', () => {
    expect(supportsMembershipComposition(null)).toBe(false);
    expect(supportsMembershipComposition(group('base', 'base'))).toBe(false);
    expect(supportsMembershipComposition(group('root', 'hierarchical'))).toBe(true);
    expect(
      supportsMembershipComposition(
        group('parliament', 'sibling', { sibling_membership_mode: 'parliament' })
      )
    ).toBe(true);
    expect(
      supportsMembershipComposition(
        group('elected', 'sibling', { sibling_membership_mode: 'elected' })
      )
    ).toBe(true);
    expect(supportsMembershipComposition(group('plain', 'sibling'))).toBe(false);
  });

  it('formats projected groups, bucket labels, direct fallbacks, and empty values', () => {
    expect(
      getMembershipProvenanceDisplayLabel(
        {
          partGroup: { id: 'part', name: 'Part' },
          baseGroup: { id: 'base', name: 'Base' },
          provenanceBucketLabel: null,
        },
        'partGroup'
      )
    ).toBe('Part');
    expect(
      getMembershipProvenanceDisplayLabel(
        { partGroup: null, baseGroup: null, provenanceBucketLabel: 'Custom bucket' },
        'partGroup'
      )
    ).toBe('Custom bucket');
    expect(
      getMembershipProvenanceDisplayLabel(
        {
          partGroup: null,
          baseGroup: null,
          provenanceBucketLabel: DIRECT_WITHOUT_PATH_LABEL,
        },
        'baseGroup',
        { directWithoutPathLabel: 'Direct', emptyLabel: 'Empty' }
      )
    ).toBe('Direct');
    expect(
      getMembershipProvenanceDisplayLabel(
        { partGroup: null, baseGroup: null, provenanceBucketLabel: null },
        'baseGroup',
        { emptyLabel: 'Empty' }
      )
    ).toBe('Empty');
    expect(
      getMembershipProvenanceDisplayLabel(
        { partGroup: null, baseGroup: null, provenanceBucketLabel: null },
        'partGroup',
        { emptyLabel: 'Empty part' }
      )
    ).toBe('Empty part');
    expect(
      getMembershipProvenanceDisplayLabel(
        {
          partGroup: null,
          baseGroup: { id: 'base', name: 'Base' },
          provenanceBucketLabel: 'Ignored',
        },
        'baseGroup'
      )
    ).toBe('Base');
  });
});

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

  it('honors explicit part/base projection fields and legacy origin fallbacks', () => {
    const current = group('root', 'hierarchical');
    const part = group('part', 'hierarchical', { name: 'Part' });
    const base = group('base', 'base', { name: 'Base' });
    const rows = resolveMembershipProvenance({
      group: current,
      memberships: [
        {
          ...membership('part-only'),
          part_group_id: 'part',
          part_group: part,
        },
        {
          ...membership('base-only'),
          base_group_id: 'base',
          base_group: base,
        },
        {
          ...membership('origin'),
          origins: [
            {
              part_group_id: 'part',
              base_group_id: 'base',
              part_group: part,
              base_group: base,
            },
          ],
        },
        {
          ...membership('ids-only'),
          part_group_id: 'part-id-only',
          base_group_id: 'base-id-only',
          part_group: null,
          base_group: null,
        },
      ],
      relationships: [],
    });

    expect(rows[0]).toMatchObject({ partGroup: part, baseGroup: part });
    expect(rows[1]).toMatchObject({ partGroup: base, baseGroup: base });
    expect(rows[2]).toMatchObject({ partGroup: part, baseGroup: base });
    expect(rows[3]).toMatchObject({
      partGroup: { id: 'part-id-only' },
      baseGroup: { id: 'base-id-only' },
    });
  });

  it('falls back for unsupported groups and missing sibling source identities', () => {
    const unsupported = group('plain-sibling', 'sibling');
    const supported = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const rows = [
      ...resolveMembershipProvenance({
        group: unsupported,
        memberships: [membership('unsupported')],
        relationships: [],
      }),
      ...resolveMembershipProvenance({
        group: supported,
        memberships: [
          membership('missing-root', { source_group_id: null }),
          {
            ...membership('missing-user', { source_group_id: 'root' }),
            user: null,
            user_id: null,
          },
        ],
        relationships: [],
      }),
    ];

    expect(rows.every(row => row.provenanceBucketLabel === DIRECT_WITHOUT_PATH_LABEL)).toBe(true);
  });

  it('normalizes an unresolved sibling source id as a direct base source', () => {
    const supported = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const [row] = resolveMembershipProvenance({
      group: supported,
      memberships: [
        membership('unknown-source', {
          source_group_id: 'unknown-source',
          source_group: null,
        }),
      ],
      relationships: [],
    });

    expect(row).toMatchObject({
      partGroup: { id: 'unknown-source', group_type: null },
      baseGroup: { id: 'unknown-source', group_type: null },
    });
  });

  it('uses the first active root membership for an exact user/group key', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'elected' });
    const root = group('root', 'hierarchical');
    const baseA = group('base-a', 'base');
    const baseB = group('base-b', 'base');
    const [row] = resolveMembershipProvenance({
      group: assembly,
      memberships: [
        membership('assembly-member', {
          user_id: 'u1',
          source_group_id: 'root',
          source_group: root,
        }),
      ],
      rootMemberships: [
        {
          ...membership('inactive', {
            user_id: 'u1',
            group_id: 'root',
            status: 'requested',
            source_group_id: 'base-b',
            source_group: baseB,
          }),
        },
        membership('first', {
          user_id: 'u1',
          group_id: 'root',
          source_group_id: 'base-a',
          source_group: baseA,
        }),
        membership('duplicate', {
          user_id: 'u1',
          group_id: 'root',
          source_group_id: 'base-b',
          source_group: baseB,
        }),
        {
          ...membership('missing-key', { group_id: null }),
          user: null,
          user_id: null,
        },
        {
          ...membership('board-holder', {
            user_id: 'board-user',
            group_id: 'root',
            status: 'requested',
            source_group_id: 'base-a',
            source_group: baseA,
          }),
          roles: [
            { id: 'unnamed', name: null },
            { id: 'board', name: 'Board Member' },
          ],
          role: null,
        },
        {
          ...membership('board-holder-missing-status', {
            user_id: 'board-user-2',
            group_id: 'root',
            source_group_id: 'base-a',
            source_group: baseA,
          }),
          status: null,
          roles: [{ id: 'board', name: 'Board Member' }],
          role: null,
        },
      ],
      relationships: [
        relationship('root-a', 'root', 'base-a'),
        relationship('root-b', 'root', 'base-b'),
        { ...relationship('inactive', 'root', 'inactive'), status: 'requested' },
        {
          ...relationship('sibling-kind', 'peer-a', 'peer-b'),
          connection_type: 'hierarchy',
          relationship_type: 'sibling',
        },
        {
          ...relationship('self-link', 'same', 'same'),
          connection_type: 'hierarchy',
          relationship_type: null,
        },
        {
          id: 'unoriented',
          group_id: '',
          related_group_id: '',
          connection_type: null,
          relationship_type: null,
          with_right: null,
          status: 'active',
        } as any,
      ],
    });

    expect(row.baseGroup?.id).toBe('base-a');
  });

  it('uses a direct hierarchical source when no compatible root membership is unique', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const sourceRoot = group('source-root', 'hierarchical');
    const [withoutMatch, ambiguous] = resolveMembershipProvenance({
      group: assembly,
      memberships: [
        membership('without-match', {
          user_id: 'u1',
          source_group_id: 'source-root',
          source_group: sourceRoot,
        }),
        membership('ambiguous', {
          user_id: 'u2',
          source_group_id: 'source-root',
          source_group: sourceRoot,
        }),
      ],
      rootMemberships: [
        membership('wrong-user', {
          user_id: 'other',
          source_group_id: 'base-a',
        }),
        membership('missing-source', { user_id: 'u1', source_group_id: null }),
        membership('u2-a', { user_id: 'u2', source_group_id: 'base-a' }),
        membership('u2-b', { user_id: 'u2', source_group_id: 'base-b' }),
      ],
      relationships: [
        relationship('root-a', 'source-root', 'base-a'),
        relationship('root-b', 'source-root', 'base-b'),
      ],
    });

    expect(withoutMatch.partGroup?.id).toBe('source-root');
    expect(withoutMatch.baseGroup?.id).toBe('source-root');
    expect(ambiguous.partGroup?.id).toBe('source-root');
    expect(ambiguous.baseGroup?.id).toBe('source-root');
  });

  it('falls back when a hierarchy has no unique path to its base membership', () => {
    const root = group('root', 'hierarchical');
    const [missingBase, duplicatePath] = resolveMembershipProvenance({
      group: root,
      memberships: [
        membership('missing-base', { source_group_id: null }),
        membership('duplicate-path', {
          source_group_id: 'base',
          source_group: group('base', 'base'),
        }),
      ],
      relationships: [
        relationship('a-base', 'a', 'base'),
        relationship('b-base', 'b', 'base'),
        relationship('root-a', 'root', 'a'),
        relationship('root-b', 'root', 'b'),
      ],
    });

    expect(missingBase.provenanceBucketLabel).toBe(DIRECT_WITHOUT_PATH_LABEL);
    expect(duplicatePath.provenanceBucketLabel).toBe(DIRECT_WITHOUT_PATH_LABEL);
  });

  it('uses the hierarchy itself when the source membership points at the root', () => {
    const root = group('root', 'hierarchical');
    const [row] = resolveMembershipProvenance({
      group: root,
      memberships: [
        membership('root-source', {
          source_group_id: 'root',
          source_group: root,
        }),
      ],
      relationships: [],
    });

    expect(row).toMatchObject({ partGroup: { id: 'root' }, baseGroup: { id: 'root' } });
  });

  it('resolves nested hierarchical and sibling sources inside a sibling source', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const sourceSibling = group('source-sibling', 'sibling', {
      sibling_membership_mode: 'parliament',
    });
    const nestedRoot = group('nested-root', 'hierarchical');
    const nestedSibling = group('nested-sibling', 'sibling', {
      sibling_membership_mode: 'parliament',
    });
    const base = group('base', 'base');

    const rows = resolveMembershipProvenance({
      group: assembly,
      memberships: [
        membership('nested-hierarchy', {
          user_id: 'u1',
          source_group_id: 'source-sibling',
          source_group: sourceSibling,
        }),
        membership('nested-sibling', {
          user_id: 'u2',
          source_group_id: 'source-sibling',
          source_group: sourceSibling,
        }),
      ],
      rootMemberships: [
        membership('source-u1', {
          user_id: 'u1',
          group_id: 'source-sibling',
          source_group_id: 'nested-root',
          source_group: nestedRoot,
        }),
        membership('nested-u1', {
          user_id: 'u1',
          group_id: 'nested-root',
          source_group_id: 'base',
          source_group: base,
        }),
        membership('source-u2', {
          user_id: 'u2',
          group_id: 'source-sibling',
          source_group_id: 'nested-sibling',
          source_group: nestedSibling,
        }),
      ],
      relationships: [relationship('nested-base', 'nested-root', 'base')],
    });

    expect(rows[0]).toMatchObject({
      partGroup: { id: 'source-sibling' },
      baseGroup: { id: 'base' },
    });
    expect(rows[1]).toMatchObject({
      partGroup: { id: 'source-sibling' },
      baseGroup: { id: 'nested-sibling' },
    });
  });

  it('uses compatible and missing nested hierarchy memberships deterministically', () => {
    const assembly = group('assembly', 'sibling', { sibling_membership_mode: 'parliament' });
    const sourceSibling = group('source-sibling', 'sibling', {
      sibling_membership_mode: 'parliament',
    });
    const nestedRoot = group('nested-root', 'hierarchical');
    const base = group('base', 'base');

    const [compatible, missing] = resolveMembershipProvenance({
      group: assembly,
      memberships: [
        membership('compatible', {
          user_id: 'u1',
          source_group_id: 'source-sibling',
          source_group: sourceSibling,
        }),
        membership('missing', {
          user_id: 'u2',
          source_group_id: 'source-sibling',
          source_group: sourceSibling,
        }),
      ],
      rootMemberships: [
        membership('source-u1', {
          user_id: 'u1',
          group_id: 'source-sibling',
          source_group_id: 'nested-root',
          source_group: nestedRoot,
        }),
        membership('compatible-u1', {
          user_id: 'u1',
          group_id: null,
          source_group_id: 'base',
          source_group: base,
        }),
        membership('source-u2', {
          user_id: 'u2',
          group_id: 'source-sibling',
          source_group_id: 'nested-root',
          source_group: nestedRoot,
        }),
      ],
      relationships: [relationship('nested-base', 'nested-root', 'base')],
    });

    expect(compatible.baseGroup?.id).toBe('base');
    expect(missing.baseGroup?.id).toBe('nested-root');
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

  it('returns no buckets for no members and builds stable fallback buckets', () => {
    expect(buildMembershipCompositionBuckets([])).toEqual([]);

    expect(
      buildMembershipCompositionBuckets([
        {
          partGroup: null,
          provenanceBucketLabel: null,
          roles: [],
          role: { id: 'legacy-chair', name: 'Chair' },
        },
        {
          partGroup: null,
          provenanceBucketLabel: 'Custom',
          roles: [{ id: 'unnamed', name: null }],
          role: null,
        },
        {
          partGroup: null,
          provenanceBucketLabel: 'Empty',
          roles: [],
          role: null,
        },
      ])
    ).toEqual([
      expect.objectContaining({
        key: `fallback:${DIRECT_WITHOUT_PATH_LABEL}`,
        label: DIRECT_WITHOUT_PATH_LABEL,
        memberCount: 1,
        leadershipAssignmentCount: 1,
      }),
      expect.objectContaining({
        key: 'fallback:Custom',
        label: 'Custom',
        memberCount: 1,
        leadershipAssignmentCount: 1,
      }),
      expect.objectContaining({
        key: 'fallback:Empty',
        label: 'Empty',
        memberCount: 1,
        leadershipAssignmentCount: 0,
      }),
    ]);
  });

  it('uses name ordering after member and leadership counts tie', () => {
    const buckets = buildMembershipCompositionBuckets([
      {
        partGroup: { id: 'z', name: 'Zulu' },
        provenanceBucketLabel: null,
        roles: [{ id: 'member', name: 'MEMBER' }],
        role: null,
      },
      {
        partGroup: { id: 'a', name: 'Alpha' },
        provenanceBucketLabel: null,
        roles: [{ id: 'member-a', name: 'Member' }],
        role: null,
      },
    ]);

    expect(buckets.map(bucket => bucket.key)).toEqual(['a', 'z']);
    expect(buckets[0]?.leadershipAssignmentCount).toBe(0);
    expect(buckets[1]?.leadershipAssignmentCount).toBe(0);
  });
});

describe('collectPathsFromBaseToTarget', () => {
  it('ignores malformed edges, terminates cycles, and deduplicates path keys', () => {
    const paths = collectPathsFromBaseToTarget('base', 'root', [
      relationship('mid-base', 'mid', 'base'),
      relationship('root-mid', 'root', 'mid'),
      relationship('base-mid', 'base', 'mid'),
      {
        id: 'peer',
        group_id: 'base',
        related_group_id: 'peer',
        relationship_type: 'sibling',
        connection_type: 'peer',
        with_right: null,
        status: 'active',
      } as any,
    ]);

    expect(paths).toEqual([['base', 'mid', 'root']]);
    expect(collectPathsFromBaseToTarget('standalone', 'root', [])).toEqual([]);
  });
});
