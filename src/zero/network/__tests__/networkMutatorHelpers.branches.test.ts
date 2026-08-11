import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../schema', () => {
  const make = (table: string, filters: unknown[] = [], single = false): any => ({
    table,
    filters,
    single,
    where: (...args: unknown[]) => make(table, [...filters, args], single),
    one: () => make(table, filters, true),
  });
  return { zql: new Proxy({}, { get: (_target, table: string) => make(table) }) };
});

import {
  approveGroupConnectionRequest,
  deleteGroupConnectionAndRequests,
  loadGroupConnectionState,
  proposeGroupConnectionChange,
  rejectGroupConnectionRequest,
  syncGroupConnectionChildren,
} from '../mutator-helpers';

function createTx(responses: Record<string, unknown[]> = {}) {
  const tables = [
    'group_connection',
    'group_right_grant',
    'group_membership_rule',
    'group_membership_rule_origin',
    'group_connection_request',
    'group_right_grant_request',
    'group_membership_rule_request',
    'group_membership_rule_request_origin',
  ];
  return {
    run: vi.fn(async (query: { table: string; single?: boolean }) => {
      const queue = responses[query.table] ?? [];
      return queue.length > 0 ? queue.shift() : query.single ? null : [];
    }),
    mutate: Object.fromEntries(
      tables.map(table => [table, { insert: vi.fn(), update: vi.fn(), delete: vi.fn() }])
    ) as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
  };
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    active_connection_id: null,
    proposed_connection_id: 'connection-1',
    group_a_id: 'A',
    group_b_id: 'B',
    desired_connection_type: 'hierarchy',
    desired_parent_group_id: 'A',
    desired_child_group_id: 'B',
    initiator_group_id: 'A',
    grants: [],
    membership_rule: null,
    ...overrides,
  } as any;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    active_connection_id: null,
    proposed_connection_id: 'connection-1',
    group_a_id: 'A',
    group_b_id: 'B',
    desired_connection_type: 'hierarchy',
    desired_parent_group_id: 'A',
    desired_child_group_id: 'B',
    structure_status: 'approved',
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('network mutator helper branch parity', () => {
  it('loads connection state with and without a membership rule', async () => {
    const withRule = createTx({
      group_connection: [{ id: 'connection-1' }],
      group_right_grant: [[{ id: 'grant-1' }]],
      group_membership_rule: [{ id: 'rule-1' }],
      group_membership_rule_origin: [[{ id: 'origin-1' }]],
    });
    expect(await loadGroupConnectionState(withRule as never, 'connection-1')).toEqual(
      expect.objectContaining({ origins: [{ id: 'origin-1' }] })
    );

    const withoutRule = createTx({
      group_connection: [null],
      group_right_grant: [[]],
      group_membership_rule: [null],
    });
    expect((await loadGroupConnectionState(withoutRule as never, 'connection-1')).origins).toEqual(
      []
    );
  });

  it('removes omitted children and an existing membership rule and origins', async () => {
    const tx = createTx({
      group_right_grant: [
        [{ id: 'old-grant', right_key: 'info', holder_group_id: 'A', scope_group_id: 'B' }],
      ],
      group_membership_rule: [{ id: 'old-rule' }],
      group_membership_rule_origin: [[{ id: 'old-origin' }]],
    });
    await syncGroupConnectionChildren(tx as never, { connectionId: 'connection-1' });
    expect(tx.mutate.group_right_grant.delete).toHaveBeenCalledWith({ id: 'old-grant' });
    expect(tx.mutate.group_membership_rule_origin.delete).toHaveBeenCalledWith({
      id: 'old-origin',
    });
    expect(tx.mutate.group_membership_rule.delete).toHaveBeenCalledWith({ id: 'old-rule' });

    const emptyTx = createTx({ group_right_grant: [[]], group_membership_rule: [null] });
    await syncGroupConnectionChildren(emptyTx as never, {
      connectionId: 'connection-1',
      grants: [],
      membership_rule: null,
    });
    expect(emptyTx.mutate.group_membership_rule.delete).not.toHaveBeenCalled();
  });

  it('updates/inserts grants and updates role membership with normalized defaults', async () => {
    const existingGrant = {
      id: 'existing-grant',
      right_key: 'info',
      holder_group_id: 'A',
      scope_group_id: 'B',
    };
    const tx = createTx({
      group_right_grant: [[existingGrant]],
      group_membership_rule: [{ id: 'existing-rule' }],
      group_membership_rule_origin: [[{ id: 'existing-origin' }]],
    });
    await syncGroupConnectionChildren(tx as never, {
      connectionId: 'connection-1',
      grants: [
        { ...existingGrant, status: 'requested', initiator_group_id: 'A' },
        { ...existingGrant, status: undefined, initiator_group_id: undefined },
        { id: 'explicit-grant', right_key: 'speak', holder_group_id: 'A', scope_group_id: 'B' },
        { right_key: 'vote', holder_group_id: 'B', scope_group_id: 'A' },
      ],
      membership_rule: {
        member_source_group_id: 'A',
        member_target_group_id: 'B',
        membership_mode: 'role_members',
        required_source_role_id: undefined,
      },
    });
    expect(tx.mutate.group_right_grant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-grant',
        status: 'requested',
        initiator_group_id: 'A',
      })
    );
    expect(tx.mutate.group_right_grant.insert).toHaveBeenCalledTimes(2);
    expect(tx.mutate.group_membership_rule.update).toHaveBeenCalledWith(
      expect.objectContaining({ required_source_role_id: null })
    );
  });

  it('inserts selected-source and ordinary membership rules with deduplicated origins', async () => {
    const selectedTx = createTx({
      group_right_grant: [[]],
      group_membership_rule: [null],
      group_membership_rule_origin: [[{ id: 'stale-origin' }]],
    });
    await syncGroupConnectionChildren(selectedTx as never, {
      connectionId: 'connection-1',
      grants: [],
      membership_rule: {
        id: 'selected-rule',
        member_source_group_id: 'A',
        member_target_group_id: 'B',
        membership_mode: 'selected_source_groups',
        eligible_origin_group_ids: ['A', 'A', 'B'],
      },
    });
    expect(selectedTx.mutate.group_membership_rule_origin.insert).toHaveBeenCalledTimes(2);

    const selectedWithoutOriginsTx = createTx({
      group_right_grant: [[]],
      group_membership_rule: [null],
      group_membership_rule_origin: [[]],
    });
    await syncGroupConnectionChildren(selectedWithoutOriginsTx as never, {
      connectionId: 'connection-without-origins',
      membership_rule: {
        member_source_group_id: 'A',
        member_target_group_id: 'B',
        membership_mode: 'selected_source_groups',
        eligible_origin_group_ids: undefined,
      },
    });

    const ordinaryTx = createTx({
      group_right_grant: [[]],
      group_membership_rule: [null],
      group_membership_rule_origin: [[]],
    });
    await syncGroupConnectionChildren(ordinaryTx as never, {
      connectionId: 'connection-2',
      membership_rule: {
        member_source_group_id: 'A',
        member_target_group_id: 'B',
        membership_mode: 'all_members',
      },
    });
    expect(ordinaryTx.mutate.group_membership_rule.insert).toHaveBeenCalled();
  });

  it('deletes requests that reference a connection from either side', async () => {
    const tx = createTx({
      group_connection_request: [
        [
          { id: 'active', active_connection_id: 'connection-1', proposed_connection_id: 'other' },
          { id: 'proposed', active_connection_id: null, proposed_connection_id: 'connection-1' },
          { id: 'unrelated', active_connection_id: 'other', proposed_connection_id: 'other' },
        ],
      ],
    });
    await deleteGroupConnectionAndRequests(tx as never, 'connection-1');
    expect(tx.mutate.group_connection_request.delete).toHaveBeenCalledTimes(2);
    expect(tx.mutate.group_connection.delete).toHaveBeenCalledWith({ id: 'connection-1' });
  });

  it('creates a pending proposal with generated nullable child ids and no membership', async () => {
    const tx = createTx({ group_connection_request: [null] });
    await proposeGroupConnectionChange(
      tx as never,
      proposal({
        desired_parent_group_id: undefined,
        desired_child_group_id: undefined,
        grants: [
          {
            id: 'grant-request',
            existing_grant_id: undefined,
            operation: 'upsert',
            right_key: 'info',
            holder_group_id: 'A',
            scope_group_id: 'B',
          },
        ],
      })
    );
    expect(tx.mutate.group_connection_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ structure_status: 'pending', active_connection_id: null })
    );
    expect(tx.mutate.group_membership_rule_request.insert).not.toHaveBeenCalled();
  });

  it('generates sparse membership request defaults and replaces request origins', async () => {
    const tx = createTx({
      group_connection_request: [null],
      group_membership_rule_request_origin: [[{ id: 'old-origin' }]],
    });
    await proposeGroupConnectionChange(
      tx as never,
      proposal({
        membership_rule: {
          id: undefined,
          existing_membership_rule_id: undefined,
          operation: 'upsert',
          member_source_group_id: undefined,
          member_target_group_id: undefined,
          membership_mode: undefined,
          required_source_role_id: undefined,
          eligible_origin_group_ids: undefined,
        },
      })
    );
    expect(tx.mutate.group_membership_rule_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ member_source_group_id: null, membership_mode: null })
    );
    expect(tx.mutate.group_membership_rule_request_origin.delete).toHaveBeenCalled();
  });

  it('throws for missing approvals and creates/normalizes a requested connection', async () => {
    await expect(
      approveGroupConnectionRequest(
        createTx({ group_connection_request: [null] }) as never,
        'missing'
      )
    ).rejects.toThrow('not found');

    const grants = [
      {
        id: 'remove-existing',
        operation: 'remove',
        existing_grant_id: 'grant-old',
        status: 'pending',
      },
      { id: 'remove-missing', operation: 'remove', existing_grant_id: null, status: 'pending' },
      {
        id: 'update-existing',
        operation: 'upsert',
        existing_grant_id: 'grant-update',
        right_key: 'info',
        holder_group_id: 'A',
        scope_group_id: 'B',
        initiator_group_id: 'A',
        status: 'pending',
      },
      {
        id: 'insert-existing-id',
        operation: 'upsert',
        existing_grant_id: 'missing-grant',
        right_key: 'speak',
        holder_group_id: 'B',
        scope_group_id: 'A',
        initiator_group_id: 'A',
        status: 'pending',
      },
      { id: 'already-approved', operation: 'upsert', status: 'approved' },
    ];
    const tx = createTx({
      group_connection_request: [request({ structure_status: 'pending' })],
      group_connection: [null],
      group_right_grant_request: [grants, []],
      group_right_grant: [{ id: 'grant-update' }, null],
      group_membership_rule_request: [null, null],
    });
    await approveGroupConnectionRequest(tx as never, 'request-1');
    expect(tx.mutate.group_connection.insert).toHaveBeenCalled();
    expect(tx.mutate.group_connection_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ structure_status: 'approved' })
    );
    expect(tx.mutate.group_right_grant.delete).toHaveBeenCalledWith({ id: 'grant-old' });
    expect(tx.mutate.group_right_grant.update).toHaveBeenCalled();
    expect(tx.mutate.group_right_grant.insert).toHaveBeenCalled();
    expect(tx.mutate.group_connection_request.delete).toHaveBeenCalled();
  });

  it.each([
    { member_source_group_id: null, member_target_group_id: 'B', membership_mode: 'all_members' },
    { member_source_group_id: 'A', member_target_group_id: null, membership_mode: 'all_members' },
    { member_source_group_id: 'A', member_target_group_id: 'B', membership_mode: null },
  ])('rejects incomplete membership approvals', async membershipFields => {
    const membershipRequest = {
      id: 'membership-request',
      operation: 'upsert',
      status: 'pending',
      ...membershipFields,
    };
    const tx = createTx({
      group_connection_request: [request()],
      group_connection: [{ id: 'connection-1' }],
      group_right_grant_request: [[]],
      group_membership_rule_request: [[membershipRequest]],
    });
    await expect(approveGroupConnectionRequest(tx as never, 'request-1')).rejects.toThrow(
      'explicit source, target, and mode'
    );
  });

  it('approves an upsert membership, prunes stale requests, and syncs origins', async () => {
    const primary = {
      id: 'membership-new',
      existing_membership_rule_id: null,
      operation: 'upsert',
      member_source_group_id: 'A',
      member_target_group_id: 'B',
      membership_mode: 'selected_source_groups',
      required_source_role_id: null,
      status: 'pending',
      updated_at: 3,
    };
    const stale = { id: 'membership-stale', status: 'pending', updated_at: 1 };
    const undatedA = {
      id: 'membership-undated-a',
      status: 'pending',
      updated_at: null,
      created_at: null,
    };
    const undatedB = {
      id: 'membership-undated-b',
      status: 'pending',
      updated_at: null,
      created_at: null,
    };
    const tx = createTx({
      group_connection_request: [request()],
      group_connection: [{ id: 'connection-1' }],
      group_right_grant_request: [[], []],
      group_membership_rule_request: [
        [primary, stale, undatedA, undatedB],
        [{ ...primary, status: 'approved' }],
      ],
      group_membership_rule_request_origin: [
        [{ id: 'stale-origin' }],
        [],
        [],
        [{ eligible_origin_group_id: 'A' }],
      ],
      group_right_grant: [[], []],
      group_membership_rule: [null],
      group_membership_rule_origin: [[]],
    });
    await approveGroupConnectionRequest(tx as never, 'request-1');
    expect(tx.mutate.group_membership_rule_request.delete).toHaveBeenCalledWith({
      id: 'membership-stale',
    });
    expect(tx.mutate.group_membership_rule.insert).toHaveBeenCalled();
    expect(tx.mutate.group_membership_rule_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'membership-new', status: 'approved' })
    );
  });

  it('approves a membership removal without a persisted rule id and normalizes object/null loads', async () => {
    const membership = {
      id: 'remove-membership',
      existing_membership_rule_id: null,
      operation: 'remove',
      status: 'pending',
    };
    const tx = createTx({
      group_connection_request: [request()],
      group_connection: [{ id: 'connection-1' }],
      group_right_grant_request: [[], []],
      group_membership_rule_request: [membership, null],
    });
    await approveGroupConnectionRequest(tx as never, 'request-1', [], true);
    expect(tx.mutate.group_membership_rule.delete).not.toHaveBeenCalled();
    expect(tx.mutate.group_membership_rule_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remove-membership', status: 'approved' })
    );
  });

  it('throws for missing rejection and rejects selected/all pending child requests', async () => {
    await expect(
      rejectGroupConnectionRequest(
        createTx({ group_connection_request: [null] }) as never,
        'missing'
      )
    ).rejects.toThrow('not found');

    const grantRows = [
      { id: 'selected', status: 'pending' },
      { id: 'unselected', status: 'pending' },
      { id: 'approved', status: 'approved' },
    ];
    const membership = { id: 'membership', status: 'pending' };
    const tx = createTx({
      group_connection_request: [request()],
      group_right_grant_request: [grantRows, []],
      group_membership_rule_request: [[membership], [{ ...membership, status: 'rejected' }]],
    });
    await rejectGroupConnectionRequest(tx as never, 'request-1', undefined, undefined, false);
    expect(tx.mutate.group_right_grant_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'selected', status: 'rejected' })
    );
    expect(tx.mutate.group_membership_rule_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'membership', status: 'rejected' })
    );
  });

  it('leaves nonpending structure children untouched when explicitly rejecting structure', async () => {
    const tx = createTx({
      group_connection_request: [request()],
      group_right_grant_request: [[{ id: 'approved', status: 'approved' }]],
      group_membership_rule_request: [[{ id: 'membership', status: 'approved' }]],
    });
    await rejectGroupConnectionRequest(tx as never, 'request-1', null, false, true);
    expect(tx.mutate.group_right_grant_request.update).not.toHaveBeenCalled();
    expect(tx.mutate.group_membership_rule_request.update).not.toHaveBeenCalled();
  });

  it('does not reject a pending membership when an explicit grant subset excludes it', async () => {
    const membership = { id: 'membership', status: 'pending' };
    const tx = createTx({
      group_connection_request: [request()],
      group_right_grant_request: [[], []],
      group_membership_rule_request: [[membership], [membership]],
    });
    await rejectGroupConnectionRequest(tx as never, 'request-1', [], false, false);
    expect(tx.mutate.group_membership_rule_request.update).not.toHaveBeenCalled();
  });
});
