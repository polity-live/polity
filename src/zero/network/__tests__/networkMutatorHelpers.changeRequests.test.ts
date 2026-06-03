import { describe, expect, it, vi } from 'vitest';

import {
  approveNetworkLinkChangeRequest,
  rejectNetworkLinkChangeRequest,
} from '../mutator-helpers';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      network_link: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      network_link_right: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      network_link_membership_rule: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      network_link_change_request: {
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

describe('network change request helpers', () => {
  it('fully approves rights by merging with existing active rights', async () => {
    const tx = createTx();
    const request = {
      id: 'request-merge',
      active_network_link_id: 'link-merge',
      proposed_network_link_id: 'link-merge',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'requested' as const,
      initiator_group_id: 'group-a',
      desired_rights: [
        {
          id: 'right-passive',
          right_key: 'passiveVotingRight' as const,
          direction: 'forward' as const,
        },
      ],
      desired_membership_mode: 'none' as const,
      desired_role_id: null,
      desired_source_group_ids: null,
      created_at: 1,
      updated_at: 1,
    };
    const activeLink = {
      id: 'link-merge',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'active',
      created_at: 1,
      updated_at: 1,
    };
    const activeRightsBefore = [
      {
        id: 'right-info',
        network_link_id: 'link-merge',
        right_key: 'informationRight',
        direction: 'forward',
        status: 'active',
        initiator_group_id: 'group-a',
        created_at: 1,
        updated_at: 1,
      },
    ];

    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce([]);

    await approveNetworkLinkChangeRequest(tx as never, 'request-merge');

    expect(tx.mutate.network_link_right.delete).not.toHaveBeenCalledWith({ id: 'right-info' });
    expect(tx.mutate.network_link_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'right-passive',
        network_link_id: 'link-merge',
        right_key: 'passiveVotingRight',
        direction: 'forward',
      })
    );
    expect(tx.mutate.network_link_change_request.delete).toHaveBeenCalledWith({
      id: 'request-merge',
    });
  });

  it('approves only the selected rights and keeps the remaining request open', async () => {
    const tx = createTx();
    const request = {
      id: 'request-1',
      active_network_link_id: 'link-1',
      proposed_network_link_id: 'link-1',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'requested' as const,
      initiator_group_id: 'group-a',
      desired_rights: [
        { id: 'right-info', right_key: 'informationRight' as const, direction: 'forward' as const },
        { id: 'right-speak', right_key: 'rightToSpeak' as const, direction: 'forward' as const },
        { id: 'right-amend', right_key: 'amendmentRight' as const, direction: 'forward' as const },
      ],
      desired_membership_mode: 'none' as const,
      desired_role_id: null,
      desired_source_group_ids: null,
      created_at: 1,
      updated_at: 1,
    };
    const activeLink = {
      id: 'link-1',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'active',
      created_at: 1,
      updated_at: 1,
    };
    const activeRightsBefore = [
      {
        id: 'right-amend',
        network_link_id: 'link-1',
        right_key: 'amendmentRight',
        direction: 'forward',
        status: 'active',
        initiator_group_id: 'group-a',
        created_at: 1,
        updated_at: 1,
      },
    ];
    const activeRightsAfter = [
      ...activeRightsBefore,
      {
        id: 'right-info',
        network_link_id: 'link-1',
        right_key: 'informationRight',
        direction: 'forward',
        status: 'active',
        initiator_group_id: 'group-a',
        created_at: 2,
        updated_at: 2,
      },
    ];

    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce(activeRightsBefore)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce(activeRightsAfter)
      .mockResolvedValueOnce(activeRightsAfter)
      .mockResolvedValueOnce([]);

    await approveNetworkLinkChangeRequest(tx as never, 'request-1', ['right-info']);

    expect(tx.mutate.network_link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'link-1',
        status: 'active',
      })
    );
    expect(tx.mutate.network_link_right.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'right-info',
        network_link_id: 'link-1',
        right_key: 'informationRight',
        direction: 'forward',
      })
    );
    expect(tx.mutate.network_link_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        active_network_link_id: 'link-1',
        proposed_network_link_id: 'link-1',
        desired_rights: [
          {
            id: 'right-speak',
            right_key: 'rightToSpeak',
            direction: 'forward',
          },
        ],
      })
    );
    expect(tx.mutate.network_link_change_request.delete).not.toHaveBeenCalled();
  });

  it('rejects only the selected rights and trims already-satisfied rights from the request', async () => {
    const tx = createTx();
    const request = {
      id: 'request-1',
      active_network_link_id: 'link-1',
      proposed_network_link_id: 'link-1',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'requested' as const,
      initiator_group_id: 'group-a',
      desired_rights: [
        { id: 'right-info', right_key: 'informationRight' as const, direction: 'forward' as const },
        { id: 'right-speak', right_key: 'rightToSpeak' as const, direction: 'forward' as const },
        { id: 'right-amend', right_key: 'amendmentRight' as const, direction: 'forward' as const },
      ],
      desired_membership_mode: 'none' as const,
      desired_role_id: null,
      desired_source_group_ids: null,
      created_at: 1,
      updated_at: 1,
    };
    const activeLink = {
      id: 'link-1',
      source_group_id: 'group-a',
      target_group_id: 'group-b',
      structural_relation: 'parent_child' as const,
      status: 'active',
      created_at: 1,
      updated_at: 1,
    };

    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(activeLink)
      .mockResolvedValueOnce([
        {
          id: 'right-amend',
          network_link_id: 'link-1',
          right_key: 'amendmentRight',
          direction: 'forward',
          status: 'active',
          initiator_group_id: 'group-a',
          created_at: 1,
          updated_at: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'right-amend',
          network_link_id: 'link-1',
          right_key: 'amendmentRight',
          direction: 'forward',
          status: 'active',
          initiator_group_id: 'group-a',
          created_at: 1,
          updated_at: 1,
        },
      ])
      .mockResolvedValueOnce([]);

    await rejectNetworkLinkChangeRequest(tx as never, 'request-1', ['right-info']);

    expect(tx.mutate.network_link_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        desired_rights: [
          {
            id: 'right-speak',
            right_key: 'rightToSpeak',
            direction: 'forward',
          },
        ],
      })
    );
    expect(tx.mutate.network_link_change_request.delete).not.toHaveBeenCalled();
  });
});
