import { describe, expect, it } from 'vitest';

import { buildDerivedGroupNetworkMetaMap, deriveGroupRelationships } from '../derived';

describe('zero network derived helpers', () => {
  it('derives structure, rights, and membership from explicit endpoints', () => {
    const rows = deriveGroupRelationships({
      connections: [
        {
          id: 'connection-1',
          group_a_id: 'B1',
          group_b_id: 'H1',
          connection_type: 'hierarchy',
          parent_group_id: 'H1',
          child_group_id: 'B1',
          status: 'active',
          created_at: 1,
          updated_at: 1,
        },
      ],
      grants: [
        {
          id: 'grant-info',
          connection_id: 'connection-1',
          right_key: 'informationRight',
          holder_group_id: 'H1',
          scope_group_id: 'B1',
          status: 'active',
          initiator_group_id: 'H1',
          created_at: 2,
        },
        {
          id: 'grant-amend',
          connection_id: 'connection-1',
          right_key: 'amendmentRight',
          holder_group_id: 'B1',
          scope_group_id: 'H1',
          status: 'active',
          initiator_group_id: 'B1',
          created_at: 3,
        },
      ],
      rules: [
        {
          id: 'rule-1',
          connection_id: 'connection-1',
          member_source_group_id: 'B1',
          member_target_group_id: 'H1',
          membership_mode: 'all_members',
          required_source_role_id: null,
          origins: [],
        },
      ],
      includeInactive: false,
    });

    expect(
      rows.map(row => ({
        id: row.id,
        group_id: row.group_id,
        related_group_id: row.related_group_id,
        relationship_type: row.relationship_type,
        with_right: row.with_right,
        member_source_group_id: row.member_source_group_id,
        member_target_group_id: row.member_target_group_id,
      }))
    ).toEqual([
      {
        id: 'connection-1:structure',
        group_id: 'H1',
        related_group_id: 'B1',
        relationship_type: 'parent',
        with_right: null,
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
      },
      {
        id: 'grant-info',
        group_id: 'H1',
        related_group_id: 'B1',
        relationship_type: 'parent',
        with_right: 'informationRight',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
      },
      {
        id: 'grant-amend',
        group_id: 'B1',
        related_group_id: 'H1',
        relationship_type: 'child',
        with_right: 'amendmentRight',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
      },
    ]);
  });

  it('stores mutual rights as two independent grant rows and filters suspended grants', () => {
    const rows = deriveGroupRelationships({
      connections: [
        {
          id: 'connection-1',
          group_a_id: 'B1',
          group_b_id: 'H1',
          connection_type: 'peer',
          status: 'active',
        },
      ],
      grants: [
        {
          id: 'grant-vote-a',
          connection_id: 'connection-1',
          right_key: 'activeVotingRight',
          holder_group_id: 'B1',
          scope_group_id: 'H1',
          status: 'active',
        },
        {
          id: 'grant-vote-b',
          connection_id: 'connection-1',
          right_key: 'activeVotingRight',
          holder_group_id: 'H1',
          scope_group_id: 'B1',
          status: 'suspended',
        },
      ],
      rules: [],
      includeInactive: false,
    });

    expect(rows.map(row => row.id)).toEqual(['connection-1:structure', 'grant-vote-a']);
  });

  it('marks hierarchy and peer membership metadata from direct connection rows', () => {
    const meta = buildDerivedGroupNetworkMetaMap({
      groupIds: ['B1', 'H1', 'S1'],
      connections: [
        {
          id: 'hierarchy-1',
          group_a_id: 'B1',
          group_b_id: 'H1',
          connection_type: 'hierarchy',
          parent_group_id: 'H1',
          child_group_id: 'B1',
          status: 'active',
          created_at: 1,
          updated_at: 1,
        },
        {
          id: 'peer-1',
          group_a_id: 'B1',
          group_b_id: 'S1',
          connection_type: 'peer',
          status: 'active',
          created_at: 2,
          updated_at: 2,
        },
      ],
      grants: [],
      rules: [
        {
          id: 'rule-1',
          connection_id: 'peer-1',
          member_source_group_id: 'B1',
          member_target_group_id: 'S1',
          membership_mode: 'selected_source_groups',
          required_source_role_id: null,
          origins: [{ eligible_origin_group_id: 'B1' }, { eligible_origin_group_id: 'B2' }],
        },
      ],
    });

    expect(meta.get('H1')?.group_type).toBe('hierarchical');
    expect(meta.get('H1')?.has_hierarchy_children).toBe(true);
    expect(meta.get('H1')?.has_sibling_connections).toBe(false);
    expect(meta.get('B1')?.group_type).toBe('sibling');
    expect(meta.get('B1')?.has_hierarchy_children).toBe(false);
    expect(meta.get('B1')?.has_sibling_connections).toBe(true);
    expect(meta.get('B1')?.primary_outgoing_sibling_membership_mode).toBe('selected_source_groups');
    expect(meta.get('S1')?.primary_incoming_sibling_membership_mode).toBe('selected_source_groups');
    expect(meta.get('S1')?.incoming_parliament_source_group_ids).toEqual(['B1', 'B2']);
  });

  it('keeps hierarchical as the primary type for groups that also have peer connections', () => {
    const meta = buildDerivedGroupNetworkMetaMap({
      groupIds: ['H1', 'B1', 'B2', 'H1-faction'],
      connections: [
        {
          id: 'hierarchy-1',
          group_a_id: 'H1',
          group_b_id: 'B1',
          connection_type: 'hierarchy',
          parent_group_id: 'H1',
          child_group_id: 'B1',
          status: 'active',
          created_at: 1,
          updated_at: 1,
        },
        {
          id: 'hierarchy-2',
          group_a_id: 'H1',
          group_b_id: 'B2',
          connection_type: 'hierarchy',
          parent_group_id: 'H1',
          child_group_id: 'B2',
          status: 'active',
          created_at: 2,
          updated_at: 2,
        },
        {
          id: 'peer-1',
          group_a_id: 'H1',
          group_b_id: 'H1-faction',
          connection_type: 'peer',
          status: 'active',
          created_at: 3,
          updated_at: 3,
        },
      ],
      grants: [],
      rules: [
        {
          id: 'rule-1',
          connection_id: 'peer-1',
          member_source_group_id: 'H1',
          member_target_group_id: 'H1-faction',
          membership_mode: 'role_members',
          required_source_role_id: 'role-members',
          origins: [],
        },
      ],
    });

    expect(meta.get('H1')).toMatchObject({
      group_type: 'hierarchical',
      has_hierarchy_children: true,
      has_sibling_connections: true,
      primary_outgoing_sibling_membership_mode: 'role_members',
    });
  });

  it('aggregates parliament source groups from multiple incoming peer connections', () => {
    const meta = buildDerivedGroupNetworkMetaMap({
      groupIds: ['S1', 'C1', 'C2'],
      connections: [
        {
          id: 'peer-older',
          group_a_id: 'C1',
          group_b_id: 'S1',
          connection_type: 'peer',
          status: 'active',
          created_at: 1,
          updated_at: 1,
        },
        {
          id: 'peer-newer',
          group_a_id: 'C2',
          group_b_id: 'S1',
          connection_type: 'peer',
          status: 'active',
          created_at: 2,
          updated_at: 2,
        },
      ],
      grants: [],
      rules: [
        {
          id: 'rule-older',
          connection_id: 'peer-older',
          member_source_group_id: 'C1',
          member_target_group_id: 'S1',
          membership_mode: 'selected_source_groups',
          required_source_role_id: null,
          origins: [{ eligible_origin_group_id: 'P1' }],
        },
        {
          id: 'rule-newer',
          connection_id: 'peer-newer',
          member_source_group_id: 'C2',
          member_target_group_id: 'S1',
          membership_mode: 'selected_source_groups',
          required_source_role_id: null,
          origins: [{ eligible_origin_group_id: 'P2' }, { eligible_origin_group_id: 'P3' }],
        },
      ],
    });

    expect(meta.get('S1')).toMatchObject({
      connected_group_id: 'C2',
      primary_incoming_sibling_membership_mode: 'selected_source_groups',
      incoming_parliament_source_group_ids: ['P2', 'P3', 'P1'],
      parliament_source_group_ids: ['P2', 'P3', 'P1'],
    });
  });

  it('uses legacy endpoint, status, and timestamp fallbacks while filtering inactive rows', () => {
    const now = Date.now();
    const rows = deriveGroupRelationships({
      connections: [
        {
          id: 'legacy-hierarchy',
          group_a_id: 'A',
          group_b_id: 'B',
          connection_type: 'hierarchy',
          parent_group_id: null,
          child_group_id: null,
          status: undefined,
        },
        {
          id: 'inactive',
          group_a_id: 'A',
          group_b_id: 'C',
          connection_type: 'peer',
          status: 'pending',
        },
      ],
      grants: [
        {
          id: 'missing-connection',
          connection_id: 'missing',
          right_key: 'informationRight',
          holder_group_id: 'A',
          scope_group_id: 'B',
        },
        {
          id: 'legacy-grant',
          connection_id: 'legacy-hierarchy',
          right_key: 'informationRight',
          holder_group_id: 'A',
          scope_group_id: 'B',
        },
      ],
      rules: [],
    });

    expect(rows.map(row => row.id)).toEqual([
      'legacy-hierarchy:structure',
      'inactive:structure',
      'legacy-grant',
    ]);
    expect(rows[0]).toMatchObject({
      group_id: 'A',
      related_group_id: 'B',
      status: null,
      parent_group_id: null,
      child_group_id: null,
    });
    expect(rows[0]?.created_at).toBeGreaterThanOrEqual(now);
    expect(rows[2]).toMatchObject({ status: null, initiator_group_id: null });
    expect(rows[2]?.created_at).toBeGreaterThanOrEqual(now);

    const filtered = deriveGroupRelationships({
      connections: [
        {
          id: 'active',
          group_a_id: 'A',
          group_b_id: 'B',
          connection_type: 'peer',
          status: 'active',
          created_at: 7,
        },
        {
          id: 'inactive',
          group_a_id: 'A',
          group_b_id: 'C',
          connection_type: 'peer',
          status: 'pending',
        },
      ],
      grants: [
        {
          id: 'connection-status-fallback',
          connection_id: 'active',
          right_key: 'informationRight',
          holder_group_id: 'A',
          scope_group_id: 'B',
          status: undefined,
        },
      ],
      rules: [],
      includeInactive: false,
    });
    expect(filtered.map(row => row.id)).toEqual(['active:structure']);
  });

  it('derives open peer metadata and timestamp ordering fallbacks', () => {
    const meta = buildDerivedGroupNetworkMetaMap({
      groupIds: ['target', 'isolated'],
      connections: [
        {
          id: 'undated',
          group_a_id: 'old-source',
          group_b_id: 'target',
          connection_type: 'peer',
          status: 'active',
        },
        {
          id: 'created-only',
          group_a_id: 'source',
          group_b_id: 'target',
          connection_type: 'peer',
          status: 'active',
          created_at: 5,
        },
      ],
      rules: [
        {
          id: 'open-rule',
          connection_id: 'created-only',
          member_source_group_id: 'source',
          member_target_group_id: 'target',
          membership_mode: 'all_members',
        },
      ],
    });

    expect(meta.get('target')).toMatchObject({
      primary_sibling_connection_id: 'created-only',
      connected_group_id: 'source',
      primary_incoming_sibling_membership_mode: 'all_members',
      primary_outgoing_sibling_membership_mode: 'none',
      sibling_membership_mode: 'open',
    });
    expect(meta.get('isolated')).toEqual(expect.objectContaining({ group_type: 'base' }));

    expect(
      buildDerivedGroupNetworkMetaMap({ groupIds: ['isolated'], rules: [] }).get('isolated')
    ).toEqual(expect.objectContaining({ has_sibling_connections: false }));

    const reversedTimestampInputs = [
      {
        id: 'created-only',
        group_a_id: 'source',
        group_b_id: 'target',
        connection_type: 'peer' as const,
        status: 'active',
        created_at: 5,
      },
      {
        id: 'undated',
        group_a_id: 'old-source',
        group_b_id: 'target',
        connection_type: 'peer' as const,
        status: 'active',
      },
    ];
    expect(
      buildDerivedGroupNetworkMetaMap({
        groupIds: ['target'],
        connections: reversedTimestampInputs,
        rules: [],
      }).get('target')?.primary_sibling_connection_id
    ).toBe('created-only');
  });
});
