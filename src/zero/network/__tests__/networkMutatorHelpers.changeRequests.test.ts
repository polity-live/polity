import { describe, expect, it, vi } from 'vitest';

import {
  approveGroupConnectionRequest,
  proposeGroupConnectionChange,
  rejectGroupConnectionRequest,
} from '../mutator-helpers';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_connection: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_right_grant: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_membership_rule: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_membership_rule_origin: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_connection_request: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_right_grant_request: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_membership_rule_request: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      group_membership_rule_request_origin: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

const activePeerConnection = {
  id: 'connection-b1-h1',
  group_a_id: 'B1',
  group_b_id: 'H1',
  connection_type: 'peer',
  parent_group_id: null,
  child_group_id: null,
  status: 'active',
};

describe('group connection request helpers', () => {
  it('creates normalized grant and membership request rows', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(activePeerConnection)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);

    await proposeGroupConnectionChange(tx as never, {
      id: 'request-1',
      active_connection_id: 'connection-b1-h1',
      proposed_connection_id: 'connection-b1-h1',
      group_a_id: 'B1',
      group_b_id: 'H1',
      desired_connection_type: 'peer',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: 'B1',
      grants: [
        {
          id: 'grant-request-b1-h1',
          existing_grant_id: null,
          operation: 'upsert',
          right_key: 'activeVotingRight',
          holder_group_id: 'B1',
          scope_group_id: 'H1',
        },
        {
          id: 'grant-request-h1-b1',
          existing_grant_id: null,
          operation: 'upsert',
          right_key: 'activeVotingRight',
          holder_group_id: 'H1',
          scope_group_id: 'B1',
        },
      ],
      membership_rule: {
        id: 'membership-request-1',
        existing_membership_rule_id: null,
        operation: 'upsert',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'selected_source_groups',
        required_source_role_id: null,
        eligible_origin_group_ids: ['B1', 'B2'],
      },
    });

    expect(tx.mutate.group_connection_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        active_connection_id: 'connection-b1-h1',
        proposed_connection_id: 'connection-b1-h1',
        group_a_id: 'B1',
        group_b_id: 'H1',
        desired_connection_type: 'peer',
        structure_status: 'approved',
        status: 'pending',
      })
    );
    expect(tx.mutate.group_right_grant_request.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.group_right_grant_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grant-request-b1-h1',
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
      })
    );
    expect(tx.mutate.group_membership_rule_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'membership-request-1',
        operation: 'upsert',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'selected_source_groups',
      })
    );
    expect(tx.mutate.group_membership_rule_request_origin.insert).toHaveBeenCalledTimes(2);
  });

  it('clears duplicate membership rule request rows before replacing an existing request', async () => {
    const tx = createTx();
    const existingRequest = {
      id: 'request-1',
      active_connection_id: 'connection-b1-h1',
      proposed_connection_id: 'connection-b1-h1',
      group_a_id: 'B1',
      group_b_id: 'H1',
    };
    tx.run
      .mockResolvedValueOnce(activePeerConnection)
      .mockResolvedValueOnce(existingRequest)
      .mockResolvedValueOnce([{ id: 'old-grant-request' }])
      .mockResolvedValueOnce([
        { id: 'old-membership-request-1', updated_at: 1 },
        { id: 'old-membership-request-2', updated_at: 2 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await proposeGroupConnectionChange(tx as never, {
      id: 'request-1',
      active_connection_id: 'connection-b1-h1',
      proposed_connection_id: 'connection-b1-h1',
      group_a_id: 'B1',
      group_b_id: 'H1',
      desired_connection_type: 'peer',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: 'B1',
      grants: [],
      membership_rule: {
        id: 'membership-request-new',
        existing_membership_rule_id: null,
        operation: 'upsert',
        member_source_group_id: 'B1',
        member_target_group_id: 'H1',
        membership_mode: 'all_members',
        required_source_role_id: null,
        eligible_origin_group_ids: [],
      },
    });

    expect(tx.mutate.group_right_grant_request.delete).toHaveBeenCalledWith({
      id: 'old-grant-request',
    });
    expect(tx.mutate.group_membership_rule_request.delete).toHaveBeenCalledWith({
      id: 'old-membership-request-1',
    });
    expect(tx.mutate.group_membership_rule_request.delete).toHaveBeenCalledWith({
      id: 'old-membership-request-2',
    });
    expect(tx.mutate.group_membership_rule_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'membership-request-new',
        connection_request_id: 'request-1',
        membership_mode: 'all_members',
      })
    );
  });

  it('approves one side of a mutual right and keeps other pending items open', async () => {
    const tx = createTx();
    const request = {
      id: 'request-1',
      active_connection_id: 'connection-b1-h1',
      proposed_connection_id: 'connection-b1-h1',
      group_a_id: 'B1',
      group_b_id: 'H1',
      desired_connection_type: 'peer',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      structure_status: 'approved',
    };
    const grantRequests = [
      {
        id: 'grant-request-b1-h1',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'pending',
        initiator_group_id: 'B1',
      },
      {
        id: 'grant-request-h1-b1',
        existing_grant_id: null,
        operation: 'upsert',
        right_key: 'activeVotingRight',
        holder_group_id: 'H1',
        scope_group_id: 'B1',
        status: 'pending',
        initiator_group_id: 'B1',
      },
    ];
    const membershipRequest = {
      id: 'membership-request-1',
      operation: 'upsert',
      status: 'pending',
    };
    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(activePeerConnection)
      .mockResolvedValueOnce(grantRequests)
      .mockResolvedValueOnce(membershipRequest)
      .mockResolvedValueOnce([grantRequests[1]])
      .mockResolvedValueOnce(membershipRequest);

    await approveGroupConnectionRequest(tx as never, 'request-1', ['grant-request-b1-h1'], false);

    expect(tx.mutate.group_right_grant.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grant-request-b1-h1',
        connection_id: 'connection-b1-h1',
        right_key: 'activeVotingRight',
        holder_group_id: 'B1',
        scope_group_id: 'H1',
        status: 'active',
      })
    );
    expect(tx.mutate.group_right_grant_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grant-request-b1-h1',
        status: 'approved',
      })
    );
    expect(tx.mutate.group_connection_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        status: 'partially_approved',
      })
    );
    expect(tx.mutate.group_connection_request.delete).not.toHaveBeenCalled();
  });

  it('approves membership removal independently from rights', async () => {
    const tx = createTx();
    const request = {
      id: 'request-remove-membership',
      active_connection_id: 'connection-b1-h1',
      proposed_connection_id: 'connection-b1-h1',
      group_a_id: 'B1',
      group_b_id: 'H1',
      desired_connection_type: 'peer',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      structure_status: 'approved',
    };
    const membershipRequest = {
      id: 'membership-request-remove',
      existing_membership_rule_id: 'membership-rule-1',
      operation: 'remove',
      status: 'pending',
    };
    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(activePeerConnection)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(membershipRequest)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ...membershipRequest, status: 'approved' });

    await approveGroupConnectionRequest(tx as never, 'request-remove-membership', [], true);

    expect(tx.mutate.group_membership_rule.delete).toHaveBeenCalledWith({
      id: 'membership-rule-1',
    });
    expect(tx.mutate.group_membership_rule_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'membership-request-remove',
        status: 'approved',
      })
    );
    expect(tx.mutate.group_connection_request.delete).toHaveBeenCalledWith({
      id: 'request-remove-membership',
    });
  });

  it('rejects structure and marks still-open child items as rejected', async () => {
    const tx = createTx();
    const request = {
      id: 'request-reject-structure',
      active_connection_id: null,
      proposed_connection_id: 'connection-new',
      group_a_id: 'B1',
      group_b_id: 'H1',
      desired_connection_type: 'hierarchy',
      desired_parent_group_id: 'H1',
      desired_child_group_id: 'B1',
      structure_status: 'pending',
    };
    const grantRequest = {
      id: 'grant-request-1',
      status: 'pending',
    };
    const membershipRequest = {
      id: 'membership-request-1',
      status: 'pending',
    };
    tx.run
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce([grantRequest])
      .mockResolvedValueOnce(membershipRequest);

    await rejectGroupConnectionRequest(
      tx as never,
      'request-reject-structure',
      null,
      undefined,
      true
    );

    expect(tx.mutate.group_right_grant_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'grant-request-1',
        status: 'rejected',
      })
    );
    expect(tx.mutate.group_membership_rule_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'membership-request-1',
        status: 'rejected',
      })
    );
    expect(tx.mutate.group_connection_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-reject-structure',
        structure_status: 'rejected',
        status: 'rejected',
      })
    );
    expect(tx.mutate.group_connection_request.delete).not.toHaveBeenCalled();
  });
});
