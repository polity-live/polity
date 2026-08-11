import { describe, expect, it } from 'vitest';
import {
  groupConflictDraftRelationshipSchema,
  groupConflictPreflightSchema,
} from '../groupConflictPreflight';

describe('groupConflictPreflight schemas', () => {
  it('accepts draft relationships and membership identifiers', () => {
    expect(
      groupConflictDraftRelationshipSchema.parse({
        id: 'r',
        group_id: 'a',
        related_group_id: 'b',
        relationship_type: null,
        with_right: null,
        status: null,
      })
    ).toBeTruthy();
    expect(
      groupConflictPreflightSchema.safeParse({ kind: 'membership_activation', group_id: 'g' })
        .success
    ).toBe(true);
    expect(
      groupConflictPreflightSchema.safeParse({ kind: 'membership_activation', membership_id: 'm' })
        .success
    ).toBe(true);
  });

  it('rejects membership requests without either group or membership id', () => {
    expect(groupConflictPreflightSchema.safeParse({ kind: 'membership_activation' }).success).toBe(
      false
    );
  });

  it('accepts distinct connections and rejects self-connections', () => {
    const connection = {
      kind: 'group_connection_upsert',
      group_a_id: 'a',
      group_b_id: 'b',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      grants: [],
    };
    expect(groupConflictPreflightSchema.safeParse(connection).success).toBe(true);
    expect(groupConflictPreflightSchema.safeParse({ ...connection, group_b_id: 'a' }).success).toBe(
      false
    );
  });
});
