import { describe, expect, it } from 'vitest';

import {
  assertConnectionEndpoints,
  assertHierarchyGraphIsUnambiguous,
  canonicalGroupPair,
  type GroupConnectionShape,
} from '../connectionValidation';
import type { GroupConnectionRowLike } from '../derived';

function connection(overrides: Partial<GroupConnectionShape> = {}): GroupConnectionShape {
  return {
    id: 'connection',
    group_a_id: 'a',
    group_b_id: 'b',
    connection_type: 'hierarchy',
    parent_group_id: 'a',
    child_group_id: 'b',
    ...overrides,
  };
}

function graphConnection(
  id: string,
  parentGroupId: string | null,
  childGroupId: string | null,
  overrides: Partial<GroupConnectionRowLike> = {}
): GroupConnectionRowLike {
  return {
    id,
    group_a_id: parentGroupId ?? 'a',
    group_b_id: childGroupId ?? 'b',
    connection_type: 'hierarchy',
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    status: 'active',
    ...overrides,
  };
}

describe('network connection validation', () => {
  it('canonicalizes distinct group ids and rejects self-connections', () => {
    expect(canonicalGroupPair('a', 'b')).toEqual({ group_a_id: 'a', group_b_id: 'b' });
    expect(canonicalGroupPair('b', 'a')).toEqual({ group_a_id: 'a', group_b_id: 'b' });
    expect(() => canonicalGroupPair('a', 'a')).toThrow('cannot be connected to itself');
  });

  it('accepts complete hierarchy and peer endpoint contracts', () => {
    expect(() => assertConnectionEndpoints({ connection: connection() })).not.toThrow();
    expect(() =>
      assertConnectionEndpoints({
        connection: connection({
          connection_type: 'peer',
          parent_group_id: null,
          child_group_id: null,
        }),
        grants: [{ holder_group_id: 'a', scope_group_id: 'b' }],
        membershipRule: {
          member_source_group_id: 'a',
          member_target_group_id: 'b',
          membership_mode: 'all_members',
        },
      })
    ).not.toThrow();
  });

  it.each([
    ['noncanonical', connection({ group_a_id: 'b', group_b_id: 'a' }), 'canonical'],
    ['missing parent', connection({ parent_group_id: null }), 'explicit parent'],
    ['missing child', connection({ child_group_id: null }), 'explicit parent'],
    ['outside parent', connection({ parent_group_id: 'outside' }), 'explicit parent'],
    ['outside child', connection({ child_group_id: 'outside' }), 'explicit parent'],
    ['same hierarchy endpoint', connection({ child_group_id: 'a' }), 'explicit parent'],
    [
      'peer parent',
      connection({ connection_type: 'peer', child_group_id: null }),
      'Peer connections',
    ],
    [
      'peer child',
      connection({ connection_type: 'peer', parent_group_id: null }),
      'Peer connections',
    ],
  ])('rejects %s', (_label, candidate, message) => {
    expect(() => assertConnectionEndpoints({ connection: candidate })).toThrow(message);
  });

  it.each([
    [{ holder_group_id: 'a', scope_group_id: 'a' }, 'same endpoints'],
    [{ holder_group_id: 'outside', scope_group_id: 'b' }, 'outside holder'],
    [{ holder_group_id: 'a', scope_group_id: 'outside' }, 'outside scope'],
  ])('rejects invalid grant endpoints: %s', (grant, _label) => {
    expect(() => assertConnectionEndpoints({ connection: connection(), grants: [grant] })).toThrow(
      'Every right grant'
    );
  });

  it.each([
    [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'a',
        membership_mode: 'all_members',
      },
      'connection endpoints',
    ],
    [
      {
        member_source_group_id: 'outside',
        member_target_group_id: 'b',
        membership_mode: 'all_members',
      },
      'connection endpoints',
    ],
    [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'outside',
        membership_mode: 'all_members',
      },
      'connection endpoints',
    ],
    [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'b',
        membership_mode: 'role_members',
      },
      'source-group role',
    ],
    [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'b',
        membership_mode: 'selected_source_groups',
      },
      'eligible origin',
    ],
    [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'b',
        membership_mode: 'selected_source_groups',
        eligible_origin_group_ids: [],
      },
      'eligible origin',
    ],
  ])('rejects invalid membership rule %#', (membershipRule, message) => {
    expect(() => assertConnectionEndpoints({ connection: connection(), membershipRule })).toThrow(
      message
    );
  });

  it('accepts role and selected-source membership requirements', () => {
    for (const membershipRule of [
      {
        member_source_group_id: 'a',
        member_target_group_id: 'b',
        membership_mode: 'role_members',
        required_source_role_id: 'role',
      },
      {
        member_source_group_id: 'a',
        member_target_group_id: 'b',
        membership_mode: 'selected_source_groups',
        eligible_origin_group_ids: ['origin'],
      },
    ]) {
      expect(() =>
        assertConnectionEndpoints({ connection: connection(), membershipRule })
      ).not.toThrow();
    }
  });

  it('accepts an empty or branching acyclic hierarchy', () => {
    expect(() => assertHierarchyGraphIsUnambiguous([])).not.toThrow();
    expect(() =>
      assertHierarchyGraphIsUnambiguous([
        graphConnection('a-b', 'a', 'b'),
        graphConnection('a-c', 'a', 'c'),
        graphConnection('ignored-peer', null, null, { connection_type: 'peer' }),
        graphConnection('ignored-parent', null, 'd'),
        graphConnection('ignored-child', 'd', null),
        graphConnection('ignored-inactive', 'd', 'e', { status: 'pending' }),
      ])
    ).not.toThrow();
  });

  it('rejects cycles and duplicate ancestor paths', () => {
    expect(() =>
      assertHierarchyGraphIsUnambiguous([
        graphConnection('a-b', 'a', 'b'),
        graphConnection('b-a', 'b', 'a'),
      ])
    ).toThrow('cycle');

    expect(() =>
      assertHierarchyGraphIsUnambiguous([
        graphConnection('a-b', 'a', 'b'),
        graphConnection('a-c', 'a', 'c'),
        graphConnection('b-d', 'b', 'd'),
        graphConnection('c-d', 'c', 'd'),
      ])
    ).toThrow('duplicate ancestor paths');
  });
});
