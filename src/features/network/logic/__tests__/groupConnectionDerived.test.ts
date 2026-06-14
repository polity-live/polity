import { describe, expect, it } from 'vitest';

import {
  buildDerivedGroupNetworkMetaMap,
  deriveNormalizedGroupConnectionRelationships,
  deriveNormalizedGroupConnectionRequestRelationships,
} from '../groupConnectionDerived';
import type { GroupConnectionListRow, GroupConnectionRequestListRow } from '@/zero/network/queries';

function createConnection(overrides?: Partial<GroupConnectionListRow>): GroupConnectionListRow {
  return {
    id: 'connection-1',
    group_a_id: 'B1',
    group_b_id: 'H1',
    connection_type: 'hierarchy',
    parent_group_id: 'H1',
    child_group_id: 'B1',
    status: 'active',
    created_by_id: null,
    created_at: 1,
    updated_at: 1,
    grants: [
      {
        id: 'grant-amend',
        connection_id: 'connection-1',
        right_key: 'amendmentRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'active',
        initiator_group_id: 'B1',
        created_at: 2,
        updated_at: 2,
        holder_group: { id: 'B1', name: 'B1' },
        scope_group: { id: 'H1', name: 'H1' },
        initiator_group: { id: 'B1', name: 'B1' },
      },
    ],
    membership_rule: {
      id: 'rule-1',
      connection_id: 'connection-1',
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      created_at: 1,
      updated_at: 1,
      member_source_group: { id: 'B1', name: 'B1' },
      member_target_group: { id: 'H1', name: 'H1' },
      required_source_role: { id: 'role-1', name: 'Delegate' },
      origins: [],
    },
    group_a: { id: 'B1', name: 'B1' },
    group_b: { id: 'H1', name: 'H1' },
    parent_group: { id: 'H1', name: 'H1' },
    child_group: { id: 'B1', name: 'B1' },
    created_by: null,
    ...overrides,
  } as GroupConnectionListRow;
}

function createRequest(
  overrides?: Partial<GroupConnectionRequestListRow>
): GroupConnectionRequestListRow {
  return {
    id: 'request-1',
    active_connection_id: null,
    proposed_connection_id: 'connection-1',
    group_a_id: 'B1',
    group_b_id: 'H1',
    desired_connection_type: 'peer',
    desired_parent_group_id: null,
    desired_child_group_id: null,
    structure_status: 'pending',
    status: 'pending',
    initiator_group_id: 'B1',
    created_at: 1,
    updated_at: 1,
    group_a: { id: 'B1', name: 'B1' },
    group_b: { id: 'H1', name: 'H1' },
    initiator_group: { id: 'B1', name: 'B1' },
    active_connection: null,
    grant_requests: [
      {
        id: 'grant-request-1',
        connection_request_id: 'request-1',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'pending',
        initiator_group_id: 'B1',
        created_at: 2,
        updated_at: 2,
        holder_group: { id: 'B1', name: 'B1' },
        scope_group: { id: 'H1', name: 'H1' },
        initiator_group: { id: 'B1', name: 'B1' },
      },
    ],
    membership_rule_requests: [
      {
        id: 'membership-request-1',
        connection_request_id: 'request-1',
        existing_membership_rule_id: null,
        operation: 'upsert',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'all_members',
        required_source_role_id: null,
        status: 'pending',
        created_at: 1,
        updated_at: 1,
        required_source_role: null,
        origins: [],
      },
    ],
    ...overrides,
  } as GroupConnectionRequestListRow;
}

describe('groupConnectionDerived', () => {
  it('creates one structure row and holder-to-scope grant rows for active connections', () => {
    const rows = deriveNormalizedGroupConnectionRelationships(createConnection());

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

  it('keeps membership-only hierarchy connections in derived group meta', () => {
    const meta = buildDerivedGroupNetworkMetaMap([createConnection({ grants: [] })]);

    expect(meta.get('H1')?.group_type).toBe('hierarchical');
    expect(meta.get('B1')?.group_type).toBe('base');
  });

  it('creates request rows from explicit structure, grant requests, and membership request', () => {
    const rows = deriveNormalizedGroupConnectionRequestRelationships(createRequest());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'request-1:structure',
      group_id: 'B1',
      related_group_id: 'H1',
      relationship_type: 'sibling',
      with_right: null,
      member_source_group_id: 'B1',
      member_target_group_id: 'H1',
      membership_mode: 'all_members',
    });
    expect(rows[1]).toMatchObject({
      id: 'grant-request-1',
      group_id: 'B1',
      related_group_id: 'H1',
      with_right: 'activeVotingRight',
    });
  });
});
