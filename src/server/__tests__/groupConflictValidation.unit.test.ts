import { describe, expect, it } from 'vitest';

import { groupConflictPreflightSchema } from '@/features/groups/logic/groupConflictPreflight';

describe('group conflict group connection preflight', () => {
  it('requires a group or membership identifier for membership activation', () => {
    expect(groupConflictPreflightSchema.safeParse({ kind: 'membership_activation' }).success).toBe(
      false
    );
    expect(
      groupConflictPreflightSchema.safeParse({
        kind: 'membership_activation',
        membership_id: 'membership-1',
      }).success
    ).toBe(true);
  });

  it('accepts membership-only group connection upserts', () => {
    const parsed = groupConflictPreflightSchema.safeParse({
      kind: 'group_connection_upsert',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      connection_type: 'hierarchy',
      parent_group_id: 'group-b',
      child_group_id: 'group-a',
      grants: [],
      membership_rule: {
        member_source_group_id: 'group-a',
        member_target_group_id: 'group-b',
        membership_mode: 'all_members',
        required_source_role_id: null,
        eligible_origin_group_ids: [],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts structure-only group connection upserts', () => {
    const parsed = groupConflictPreflightSchema.safeParse({
      kind: 'group_connection_upsert',
      group_a_id: 'group-a',
      group_b_id: 'group-b',
      connection_type: 'hierarchy',
      parent_group_id: 'group-b',
      child_group_id: 'group-a',
      grants: [],
      membership_rule: null,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects self-connections', () => {
    const parsed = groupConflictPreflightSchema.safeParse({
      kind: 'group_connection_upsert',
      group_a_id: 'group-a',
      group_b_id: 'group-a',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      grants: [],
      membership_rule: null,
    });

    expect(parsed.success).toBe(false);
  });
});
