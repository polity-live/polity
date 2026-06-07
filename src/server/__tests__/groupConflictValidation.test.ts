import { describe, expect, it } from 'vitest';

import { groupConflictPreflightSchema } from '@/features/groups/logic/groupConflictPreflight';
import { buildDraftNetworkLinkRelationships } from '../group-conflict-validation';

describe('group conflict network link preflight', () => {
  it('accepts membership-only upserts', () => {
    const parsed = groupConflictPreflightSchema.safeParse({
      kind: 'network_link_upsert',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child',
      rights: [],
      membership_rule: {
        membership_direction: 'forward',
        membership_mode: 'all_members',
        role_id: null,
        source_group_ids: null,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty network-link upserts that have neither rights nor membership', () => {
    const parsed = groupConflictPreflightSchema.safeParse({
      kind: 'network_link_upsert',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child',
      rights: [],
      membership_rule: {
        membership_mode: 'none',
        role_id: null,
        source_group_ids: null,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('builds structural draft rows for membership-only upserts', () => {
    const rows = buildDraftNetworkLinkRelationships({
      kind: 'network_link_upsert',
      link_id: 'link-1',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child',
      rights: [],
      membership_rule: {
        membership_direction: 'forward',
        membership_mode: 'all_members',
        role_id: null,
        source_group_ids: null,
      },
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
        group_id: 'group-a',
        related_group_id: 'group-b',
        with_right: null,
        membership_mode: 'all_members',
      },
      {
        id: 'link-1:structural:backward',
        relationship_type: 'parent',
        group_id: 'group-b',
        related_group_id: 'group-a',
        with_right: null,
        membership_mode: 'all_members',
      },
    ]);
  });
});
