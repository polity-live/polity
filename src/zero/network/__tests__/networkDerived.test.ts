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
    expect(meta.get('B1')?.group_type).toBe('sibling');
    expect(meta.get('B1')?.primary_outgoing_sibling_membership_mode).toBe('selected_source_groups');
    expect(meta.get('S1')?.primary_incoming_sibling_membership_mode).toBe('selected_source_groups');
    expect(meta.get('S1')?.incoming_parliament_source_group_ids).toEqual(['B1', 'B2']);
  });
});
