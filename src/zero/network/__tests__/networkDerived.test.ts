import { describe, expect, it } from 'vitest';

import { buildDerivedGroupNetworkMetaMap, explodeNetworkLinksToRelationships } from '../derived';

describe('zero network derived helpers', () => {
  it('creates structural rows for membership-only links', () => {
    const rows = explodeNetworkLinksToRelationships({
      links: [
        {
          id: 'link-1',
          source_group_id: 'group-parent',
          target_group_id: 'group-child',
          structural_relation: 'parent_child',
          status: 'active',
          created_at: 1,
        },
      ],
      rights: [],
      rules: [
        {
          id: 'rule-1',
          network_link_id: 'link-1',
          membership_mode: 'all_members',
          role_id: null,
          source_group_ids: null,
        },
      ],
      includeInactive: false,
    });

    expect(
      rows.map(row => ({
        id: row.id,
        relationship_type: row.relationship_type,
        group_id: row.group_id,
        related_group_id: row.related_group_id,
        with_right: row.with_right,
        membership_mode: row.membership_mode,
      }))
    ).toEqual([
      {
        id: 'link-1:structural:forward',
        relationship_type: 'child',
        group_id: 'group-parent',
        related_group_id: 'group-child',
        with_right: null,
        membership_mode: 'all_members',
      },
      {
        id: 'link-1:structural:backward',
        relationship_type: 'parent',
        group_id: 'group-child',
        related_group_id: 'group-parent',
        with_right: null,
        membership_mode: 'all_members',
      },
    ]);
  });

  it('marks membership-only parent-child links as hierarchical in derived meta', () => {
    const meta = buildDerivedGroupNetworkMetaMap({
      groupIds: ['group-parent', 'group-child'],
      links: [
        {
          id: 'link-1',
          source_group_id: 'group-parent',
          target_group_id: 'group-child',
          structural_relation: 'parent_child',
          status: 'active',
          created_at: 1,
          updated_at: 1,
        },
      ],
      rights: [],
      rules: [
        {
          id: 'rule-1',
          network_link_id: 'link-1',
          membership_mode: 'all_members',
          role_id: null,
          source_group_ids: null,
        },
      ],
    });

    expect(meta.get('group-parent')?.group_type).toBe('hierarchical');
    expect(meta.get('group-child')?.group_type).toBe('base');
  });
});
