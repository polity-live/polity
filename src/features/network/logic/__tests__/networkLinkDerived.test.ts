import { describe, expect, it } from 'vitest';

import {
  buildDerivedGroupNetworkMetaMap,
  explodeNetworkLinkChangeRequestToRelationships,
  explodeNetworkLinkToRelationships,
} from '../networkLinkDerived';
import type { NetworkLinkChangeRequestListRow, NetworkLinkListRow } from '@/zero/network/queries';

function createLink(overrides?: Partial<NetworkLinkListRow>): NetworkLinkListRow {
  return {
    id: 'link-1',
    source_group_id: 'group-parent',
    target_group_id: 'group-child',
    structural_relation: 'parent_child',
    status: 'active',
    created_at: 1,
    updated_at: 1,
    rights: [],
    membership_rule: {
      id: 'rule-1',
      network_link_id: 'link-1',
      membership_mode: 'all_members',
      role_id: null,
      source_group_ids: null,
      forward_membership_mode: 'role_members',
      forward_role_id: 'role-forward',
      forward_source_group_ids: null,
      backward_membership_mode: 'all_members',
      backward_role_id: null,
      backward_source_group_ids: null,
      created_at: 1,
      updated_at: 1,
    },
    source_group: {
      id: 'group-parent',
      name: 'Parent',
    },
    target_group: {
      id: 'group-child',
      name: 'Child',
    },
    created_by: null,
    ...overrides,
  } as NetworkLinkListRow;
}

function createRequest(
  overrides?: Partial<NetworkLinkChangeRequestListRow>
): NetworkLinkChangeRequestListRow {
  return {
    id: 'request-1',
    active_network_link_id: null,
    proposed_network_link_id: 'link-1',
    source_group_id: 'group-a',
    target_group_id: 'group-b',
    structural_relation: 'sibling',
    status: 'requested',
    initiator_group_id: 'group-a',
    desired_rights: [],
    desired_membership_rules: {
      forward: {
        membership_mode: 'role_members',
        role_id: 'role-1',
        source_group_ids: null,
      },
      backward: {
        membership_mode: 'none',
        role_id: null,
        source_group_ids: null,
      },
    },
    desired_membership_mode: 'role_members',
    desired_role_id: 'role-1',
    desired_source_group_ids: null,
    created_at: 1,
    updated_at: 1,
    source_group: {
      id: 'group-a',
      name: 'Group A',
    },
    target_group: {
      id: 'group-b',
      name: 'Group B',
    },
    initiator_group: {
      id: 'group-a',
      name: 'Group A',
    },
    desired_role: null,
    active_network_link: null,
    ...overrides,
  } as NetworkLinkChangeRequestListRow;
}

describe('networkLinkDerived', () => {
  it('creates structural relationship rows for active membership-only links', () => {
    const rows = explodeNetworkLinkToRelationships(createLink());

    expect(
      rows.map(row => ({
        id: row.id,
        group_id: row.group_id,
        related_group_id: row.related_group_id,
        relationship_type: row.relationship_type,
        with_right: row.with_right,
        membership_mode: row.membership_mode,
      }))
    ).toEqual([
      {
        id: 'link-1:structural:forward',
        group_id: 'group-parent',
        related_group_id: 'group-child',
        relationship_type: 'child',
        with_right: null,
        membership_mode: 'role_members',
      },
      {
        id: 'link-1:structural:backward',
        group_id: 'group-child',
        related_group_id: 'group-parent',
        relationship_type: 'parent',
        with_right: null,
        membership_mode: 'all_members',
      },
    ]);
  });

  it('keeps membership-only links in derived group meta', () => {
    const meta = buildDerivedGroupNetworkMetaMap([createLink()]);

    expect(meta.get('group-parent')?.group_type).toBe('hierarchical');
    expect(meta.get('group-child')?.group_type).toBe('base');
  });

  it('creates structural request rows for membership-only change requests', () => {
    const rows = explodeNetworkLinkChangeRequestToRelationships(createRequest());

    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.with_right === null)).toBe(true);
    expect(rows.map(row => row.membership_mode)).toEqual(['role_members', 'none']);
  });
});
