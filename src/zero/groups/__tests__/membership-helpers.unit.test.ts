import { describe, expect, it, vi } from 'vitest';

const serverHelperMocks = vi.hoisted(() => ({
  recomputeGroupCounters: vi.fn(),
  recomputeUserCounters: vi.fn(),
  syncUserWithGroupConversation: vi.fn(),
}));

vi.mock('../../server-helpers', () => ({
  isActiveGroupStatus: (status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes((status ?? '').toLowerCase()),
  recomputeGroupCounters: serverHelperMocks.recomputeGroupCounters,
  recomputeUserCounters: serverHelperMocks.recomputeUserCounters,
  syncUserWithGroupConversation: serverHelperMocks.syncUserWithGroupConversation,
}));

import {
  assertValidSiblingConfiguration,
  recomputeSiblingGroupMemberships,
} from '../membership-helpers';

function createHelperTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_membership: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_membership_role: {
        insert: vi.fn(),
      },
    },
  };
}

describe('assertValidSiblingConfiguration', () => {
  it('allows sibling groups to connect to other sibling groups', async () => {
    const tx = {
      run: vi.fn().mockResolvedValueOnce({
        id: 'connected-sibling',
        group_type: 'sibling',
      }),
    };

    await expect(
      assertValidSiblingConfiguration(tx as never, {
        groupId: 'group-1',
        groupType: 'sibling',
        connectedGroupId: 'connected-sibling',
        siblingMembershipMode: 'open',
      })
    ).resolves.toBeUndefined();
  });

  it('accepts elected sibling connections when the connected role belongs to a sibling group', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'connected-sibling',
          group_type: 'sibling',
        })
        .mockResolvedValueOnce({
          id: 'role-1',
          group_id: 'connected-sibling',
          scope: 'group',
          assignee_kind: 'member',
        }),
    };

    await expect(
      assertValidSiblingConfiguration(tx as never, {
        groupId: 'group-1',
        groupType: 'sibling',
        connectedGroupId: 'connected-sibling',
        siblingMembershipMode: 'elected',
        siblingRoleId: 'role-1',
      })
    ).resolves.toBeUndefined();
  });
});

describe('recomputeSiblingGroupMemberships', () => {
  it('derives parliament membership for a user in exactly one sibling source group', async () => {
    const tx = createHelperTx();
    tx.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connection-1',
          group_a_id: 'connected-1',
          group_b_id: 'parliament-1',
          connection_type: 'peer',
          status: 'active',
          created_at: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          connection_id: 'connection-1',
          member_source_group_id: 'connected-1',
          member_target_group_id: 'parliament-1',
          membership_mode: 'selected_source_groups',
        },
      ])
      .mockResolvedValueOnce([
        {
          membership_rule_id: 'rule-1',
          eligible_origin_group_id: 'source-sibling-1',
        },
      ])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await recomputeSiblingGroupMemberships(tx as never, 'parliament-1');

    expect(tx.mutate.group_membership.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'parliament-1',
        user_id: 'user-1',
        source: 'sibling_parliament',
        source_group_id: 'source-sibling-1',
      })
    );
  });

  it('does not derive parliament membership for a user in two source groups in one rule', async () => {
    const tx = createHelperTx();
    tx.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connection-1',
          group_a_id: 'connected-1',
          group_b_id: 'parliament-1',
          connection_type: 'peer',
          status: 'active',
          created_at: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          connection_id: 'connection-1',
          member_source_group_id: 'connected-1',
          member_target_group_id: 'parliament-1',
          membership_mode: 'selected_source_groups',
        },
      ])
      .mockResolvedValueOnce([
        { membership_rule_id: 'rule-1', eligible_origin_group_id: 'source-a' },
        { membership_rule_id: 'rule-1', eligible_origin_group_id: 'source-b' },
      ])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }]);

    await recomputeSiblingGroupMemberships(tx as never, 'parliament-1');

    expect(tx.mutate.group_membership.insert).not.toHaveBeenCalled();
    expect(tx.mutate.group_membership.update).not.toHaveBeenCalled();
  });

  it('does not choose an arbitrary parliament source across separate peer connections', async () => {
    const tx = createHelperTx();
    tx.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connection-1',
          group_a_id: 'connected-1',
          group_b_id: 'parliament-1',
          connection_type: 'peer',
          status: 'active',
          created_at: 1,
        },
        {
          id: 'connection-2',
          group_a_id: 'connected-2',
          group_b_id: 'parliament-1',
          connection_type: 'peer',
          status: 'active',
          created_at: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          connection_id: 'connection-1',
          member_source_group_id: 'connected-1',
          member_target_group_id: 'parliament-1',
          membership_mode: 'selected_source_groups',
        },
        {
          id: 'rule-2',
          connection_id: 'connection-2',
          member_source_group_id: 'connected-2',
          member_target_group_id: 'parliament-1',
          membership_mode: 'selected_source_groups',
        },
      ])
      .mockResolvedValueOnce([
        { membership_rule_id: 'rule-1', eligible_origin_group_id: 'source-a' },
        { membership_rule_id: 'rule-2', eligible_origin_group_id: 'source-b' },
      ])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'user-1', status: 'active' }]);

    await recomputeSiblingGroupMemberships(tx as never, 'parliament-1');

    expect(tx.mutate.group_membership.insert).not.toHaveBeenCalled();
    expect(tx.mutate.group_membership.update).not.toHaveBeenCalled();
  });
});
