import { describe, expect, it, vi } from 'vitest';

import {
  loadEffectiveOfflineMembershipsForGroup,
  recomputeOfflineSiblingGroupMemberships,
} from '../offline-membership-helpers';

function createHelperTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_offline_membership: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

describe('offline-membership-helpers', () => {
  it('filters connected offline members out of effective memberships', async () => {
    const tx = createHelperTx();
    tx.run.mockResolvedValueOnce([
      {
        id: 'membership-1',
        group_id: 'group-1',
        group_offline_member_id: 'offline-1',
        status: 'active',
        group_offline_member: {
          id: 'offline-1',
          connected_user_id: null,
        },
      },
      {
        id: 'membership-2',
        group_id: 'group-1',
        group_offline_member_id: 'offline-2',
        status: 'active',
        group_offline_member: {
          id: 'offline-2',
          connected_user_id: 'user-2',
        },
      },
      {
        id: 'membership-3',
        group_id: 'group-1',
        group_offline_member_id: 'offline-3',
        status: 'invited',
        group_offline_member: {
          id: 'offline-3',
          connected_user_id: null,
        },
      },
    ]);

    const memberships = await loadEffectiveOfflineMembershipsForGroup(tx as never, 'group-1');

    expect(memberships.map(membership => membership.id)).toEqual(['membership-1']);
  });

  it('does not derive elected sibling memberships for offline members without the elected role', async () => {
    const tx = createHelperTx();
    tx.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connection-1',
          group_a_id: 'connected-1',
          group_b_id: 'sibling-1',
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
          member_target_group_id: 'sibling-1',
          membership_mode: 'role_members',
          required_source_role_id: 'role-admin',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connected-membership-1',
          group_id: 'connected-1',
          group_offline_member_id: 'offline-1',
          status: 'active',
          group_offline_member: {
            id: 'offline-1',
            connected_user_id: null,
          },
        },
      ])
      .mockResolvedValueOnce([]);

    await recomputeOfflineSiblingGroupMemberships(tx as never, 'sibling-1');

    expect(tx.mutate.group_offline_membership.insert).not.toHaveBeenCalled();
    expect(tx.mutate.group_offline_membership.update).not.toHaveBeenCalled();
  });

  it('derives elected sibling memberships only for unconnected offline members with the elected role', async () => {
    const tx = createHelperTx();
    tx.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connection-1',
          group_a_id: 'connected-1',
          group_b_id: 'sibling-1',
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
          member_target_group_id: 'sibling-1',
          membership_mode: 'role_members',
          required_source_role_id: 'role-admin',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'connected-membership-1',
          group_id: 'connected-1',
          group_offline_member_id: 'offline-1',
          status: 'active',
          group_offline_member: {
            id: 'offline-1',
            connected_user_id: null,
          },
        },
        {
          id: 'connected-membership-2',
          group_id: 'connected-1',
          group_offline_member_id: 'offline-2',
          status: 'active',
          group_offline_member: {
            id: 'offline-2',
            connected_user_id: 'user-2',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'link-1',
          group_offline_membership_id: 'connected-membership-1',
          role_id: 'role-admin',
        },
        {
          id: 'link-2',
          group_offline_membership_id: 'connected-membership-2',
          role_id: 'role-admin',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'connected-membership-1',
          group_id: 'connected-1',
          group_offline_member_id: 'offline-1',
          status: 'active',
          source_group_id: null,
          group_offline_member: {
            id: 'offline-1',
            connected_user_id: null,
          },
        },
        {
          id: 'connected-membership-2',
          group_id: 'connected-1',
          group_offline_member_id: 'offline-2',
          status: 'active',
          source_group_id: null,
          group_offline_member: {
            id: 'offline-2',
            connected_user_id: 'user-2',
          },
        },
      ])
      .mockResolvedValueOnce(null);

    await recomputeOfflineSiblingGroupMemberships(tx as never, 'sibling-1');

    expect(tx.mutate.group_offline_membership.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.group_offline_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_offline_member_id: 'offline-1',
        group_id: 'sibling-1',
        source: 'sibling_elected',
        source_group_id: 'connected-1',
      })
    );
  });
});
