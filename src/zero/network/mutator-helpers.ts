import { zql } from '../schema';
import type { GroupMembershipRuleRequestInput, GroupRightGrantRequestInput } from './request-types';

type MutatorTx = any;

export interface GroupRightGrantInput {
  id?: string;
  right_key: string;
  holder_group_id: string;
  scope_group_id: string;
  status?: string;
  initiator_group_id?: string | null;
}

export interface GroupMembershipRuleInput {
  id?: string;
  member_source_group_id: string;
  member_target_group_id: string;
  membership_mode: 'all_members' | 'role_members' | 'selected_source_groups';
  required_source_role_id?: string | null;
  eligible_origin_group_ids?: readonly string[];
}

export interface ProposeGroupConnectionChangeInput {
  id: string;
  active_connection_id?: string | null;
  proposed_connection_id: string;
  group_a_id: string;
  group_b_id: string;
  desired_connection_type: 'hierarchy' | 'peer';
  desired_parent_group_id?: string | null;
  desired_child_group_id?: string | null;
  initiator_group_id: string;
  grants: GroupRightGrantRequestInput[];
  membership_rule:
    | (GroupMembershipRuleRequestInput & {
        eligible_origin_group_ids?: readonly string[];
      })
    | null;
}

function deterministicUuidFromSeed(seed: string) {
  const state = Array.from(seed).reduce(
    (result, character) => {
      const code = character.charCodeAt(0);
      result.a = (result.a * 33 + code) >>> 0;
      result.b = (result.b * 33 + code * 3) >>> 0;
      result.c = (result.c * 33 + code * 7) >>> 0;
      result.d = (result.d * 33 + code * 11) >>> 0;
      return result;
    },
    { a: 0x811c9dc5, b: 0x9e3779b9, c: 0x7f4a7c15, d: 0x94d049bb }
  );
  const hex = [state.a, state.b, state.c, state.d]
    .map(part => part.toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function grantKey(grant: { right_key: string; holder_group_id: string; scope_group_id: string }) {
  return `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`;
}

async function replaceOrigins(
  tx: MutatorTx,
  kind: 'rule' | 'request',
  parentId: string,
  originGroupIds: readonly string[]
) {
  if (kind === 'rule') {
    const existing = await tx.run(
      zql.group_membership_rule_origin.where('membership_rule_id', parentId)
    );
    for (const row of existing) {
      await tx.mutate.group_membership_rule_origin.delete({ id: row.id });
    }
    for (const groupId of [...new Set(originGroupIds)]) {
      await tx.mutate.group_membership_rule_origin.insert({
        id: deterministicUuidFromSeed(`${parentId}:origin:${groupId}`),
        membership_rule_id: parentId,
        eligible_origin_group_id: groupId,
        created_at: Date.now(),
      });
    }
    return;
  }

  const existing = await tx.run(
    zql.group_membership_rule_request_origin.where('membership_rule_request_id', parentId)
  );
  for (const row of existing) {
    await tx.mutate.group_membership_rule_request_origin.delete({ id: row.id });
  }
  for (const groupId of [...new Set(originGroupIds)]) {
    await tx.mutate.group_membership_rule_request_origin.insert({
      id: deterministicUuidFromSeed(`${parentId}:origin:${groupId}`),
      membership_rule_request_id: parentId,
      eligible_origin_group_id: groupId,
      created_at: Date.now(),
    });
  }
}

export async function loadGroupConnectionState(tx: MutatorTx, connectionId: string) {
  const [connection, grants, membershipRule] = await Promise.all([
    tx.run(zql.group_connection.where('id', connectionId).one()),
    tx.run(zql.group_right_grant.where('connection_id', connectionId)),
    tx.run(zql.group_membership_rule.where('connection_id', connectionId).one()),
  ]);
  const origins = membershipRule
    ? await tx.run(zql.group_membership_rule_origin.where('membership_rule_id', membershipRule.id))
    : [];
  return { connection, grants, membershipRule, origins };
}

export async function syncGroupConnectionChildren(
  tx: MutatorTx,
  args: {
    connectionId: string;
    grants?: readonly GroupRightGrantInput[];
    membership_rule?: GroupMembershipRuleInput | null;
  }
) {
  const now = Date.now();
  const existingGrants = await tx.run(
    zql.group_right_grant.where('connection_id', args.connectionId)
  );
  const desiredGrants = args.grants ?? [];
  const desiredByKey = new Map(desiredGrants.map(grant => [grantKey(grant), grant]));

  for (const existing of existingGrants) {
    if (!desiredByKey.has(grantKey(existing))) {
      await tx.mutate.group_right_grant.delete({ id: existing.id });
    }
  }

  for (const desired of desiredGrants) {
    const existing = existingGrants.find(
      (row: GroupRightGrantInput & { id: string }) => grantKey(row) === grantKey(desired)
    );
    if (existing) {
      await tx.mutate.group_right_grant.update({
        id: existing.id,
        status: desired.status ?? 'active',
        initiator_group_id: desired.initiator_group_id ?? null,
        updated_at: now,
      });
    } else {
      await tx.mutate.group_right_grant.insert({
        id:
          desired.id ??
          deterministicUuidFromSeed(`${args.connectionId}:grant:${grantKey(desired)}`),
        connection_id: args.connectionId,
        right_key: desired.right_key,
        holder_group_id: desired.holder_group_id,
        scope_group_id: desired.scope_group_id,
        status: desired.status ?? 'active',
        initiator_group_id: desired.initiator_group_id ?? null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  const existingRule = await tx.run(
    zql.group_membership_rule.where('connection_id', args.connectionId).one()
  );
  if (!args.membership_rule) {
    if (existingRule) {
      await replaceOrigins(tx, 'rule', existingRule.id, []);
      await tx.mutate.group_membership_rule.delete({ id: existingRule.id });
    }
    return;
  }

  const ruleId =
    existingRule?.id ??
    args.membership_rule.id ??
    deterministicUuidFromSeed(`${args.connectionId}:membership`);
  const payload = {
    member_source_group_id: args.membership_rule.member_source_group_id,
    member_target_group_id: args.membership_rule.member_target_group_id,
    membership_mode: args.membership_rule.membership_mode,
    required_source_role_id:
      args.membership_rule.membership_mode === 'role_members'
        ? (args.membership_rule.required_source_role_id ?? null)
        : null,
    updated_at: now,
  };

  if (existingRule) {
    await tx.mutate.group_membership_rule.update({ id: ruleId, ...payload });
  } else {
    await tx.mutate.group_membership_rule.insert({
      id: ruleId,
      connection_id: args.connectionId,
      ...payload,
      created_at: now,
    });
  }

  await replaceOrigins(
    tx,
    'rule',
    ruleId,
    args.membership_rule.membership_mode === 'selected_source_groups'
      ? (args.membership_rule.eligible_origin_group_ids ?? [])
      : []
  );
}

export async function deleteGroupConnectionAndRequests(tx: MutatorTx, connectionId: string) {
  const requests = await tx.run(zql.group_connection_request);
  for (const request of requests) {
    if (
      request.active_connection_id === connectionId ||
      request.proposed_connection_id === connectionId
    ) {
      await tx.mutate.group_connection_request.delete({ id: request.id });
    }
  }
  await tx.mutate.group_connection.delete({ id: connectionId });
}

function structureMatches(connection: any, request: ProposeGroupConnectionChangeInput) {
  return (
    connection?.group_a_id === request.group_a_id &&
    connection?.group_b_id === request.group_b_id &&
    connection?.connection_type === request.desired_connection_type &&
    (connection?.parent_group_id ?? null) === (request.desired_parent_group_id ?? null) &&
    (connection?.child_group_id ?? null) === (request.desired_child_group_id ?? null)
  );
}

async function clearRequestChildren(tx: MutatorTx, requestId: string) {
  const [grantRequests, membershipRequests] = await Promise.all([
    tx.run(zql.group_right_grant_request.where('connection_request_id', requestId)),
    loadMembershipRuleRequests(tx, requestId),
  ]);
  for (const item of grantRequests) {
    await tx.mutate.group_right_grant_request.delete({ id: item.id });
  }
  for (const membershipRequest of membershipRequests) {
    await deleteMembershipRuleRequest(tx, membershipRequest);
  }
}

async function loadMembershipRuleRequests(tx: MutatorTx, requestId: string) {
  const requests = await tx.run(
    zql.group_membership_rule_request.where('connection_request_id', requestId)
  );
  const rows = Array.isArray(requests) ? requests : requests ? [requests] : [];
  return [...rows].sort(
    (left, right) =>
      (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
  );
}

async function deleteMembershipRuleRequest(tx: MutatorTx, request: { id: string }) {
  const origins = await tx.run(
    zql.group_membership_rule_request_origin.where('membership_rule_request_id', request.id)
  );
  for (const origin of origins) {
    await tx.mutate.group_membership_rule_request_origin.delete({ id: origin.id });
  }
  await tx.mutate.group_membership_rule_request.delete({ id: request.id });
}

async function getPrimaryMembershipRuleRequest(tx: MutatorTx, requestId: string) {
  const [primary, ...stale] = await loadMembershipRuleRequests(tx, requestId);
  for (const request of stale) {
    await deleteMembershipRuleRequest(tx, request);
  }
  return primary ?? null;
}

export async function proposeGroupConnectionChange(
  tx: MutatorTx,
  args: ProposeGroupConnectionChangeInput
) {
  const active = args.active_connection_id
    ? await tx.run(zql.group_connection.where('id', args.active_connection_id).one())
    : null;
  const existingRequest = await tx.run(
    zql.group_connection_request
      .where('group_a_id', args.group_a_id)
      .where('group_b_id', args.group_b_id)
      .one()
  );
  const requestId = existingRequest?.id ?? args.id;
  const now = Date.now();
  const header = {
    active_connection_id: args.active_connection_id ?? null,
    proposed_connection_id: args.proposed_connection_id,
    group_a_id: args.group_a_id,
    group_b_id: args.group_b_id,
    desired_connection_type: args.desired_connection_type,
    desired_parent_group_id: args.desired_parent_group_id ?? null,
    desired_child_group_id: args.desired_child_group_id ?? null,
    structure_status: structureMatches(active, args) ? 'approved' : 'pending',
    status: 'pending',
    initiator_group_id: args.initiator_group_id,
    updated_at: now,
  };

  if (existingRequest) {
    await clearRequestChildren(tx, requestId);
    await tx.mutate.group_connection_request.update({ id: requestId, ...header });
  } else {
    await tx.mutate.group_connection_request.insert({
      id: requestId,
      ...header,
      created_at: now,
    });
  }

  for (const grant of args.grants) {
    await tx.mutate.group_right_grant_request.insert({
      id: grant.id,
      connection_request_id: requestId,
      existing_grant_id: grant.existing_grant_id ?? null,
      operation: grant.operation,
      right_key: grant.right_key,
      holder_group_id: grant.holder_group_id,
      scope_group_id: grant.scope_group_id,
      status: 'pending',
      initiator_group_id: args.initiator_group_id,
      created_at: now,
      updated_at: now,
    });
  }

  if (args.membership_rule) {
    const membership = args.membership_rule;
    const membershipRequestId =
      membership.id ?? deterministicUuidFromSeed(`${requestId}:membership-request`);
    await tx.mutate.group_membership_rule_request.insert({
      id: membershipRequestId,
      connection_request_id: requestId,
      existing_membership_rule_id: membership.existing_membership_rule_id ?? null,
      operation: membership.operation,
      member_source_group_id: membership.member_source_group_id ?? null,
      member_target_group_id: membership.member_target_group_id ?? null,
      membership_mode: membership.membership_mode ?? null,
      required_source_role_id: membership.required_source_role_id ?? null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    await replaceOrigins(
      tx,
      'request',
      membershipRequestId,
      membership.eligible_origin_group_ids ?? []
    );
  }
}

async function ensureRequestedConnection(tx: MutatorTx, request: any) {
  const connectionId = request.active_connection_id ?? request.proposed_connection_id;
  const existing = await tx.run(zql.group_connection.where('id', connectionId).one());
  const now = Date.now();
  const values = {
    group_a_id: request.group_a_id,
    group_b_id: request.group_b_id,
    connection_type: request.desired_connection_type,
    parent_group_id: request.desired_parent_group_id ?? null,
    child_group_id: request.desired_child_group_id ?? null,
    status: 'active',
    updated_at: now,
  };
  if (existing) {
    await tx.mutate.group_connection.update({ id: connectionId, ...values });
  } else {
    await tx.mutate.group_connection.insert({
      id: connectionId,
      ...values,
      created_by_id: null,
      created_at: now,
    });
  }
  if (request.structure_status !== 'approved') {
    await tx.mutate.group_connection_request.update({
      id: request.id,
      active_connection_id: connectionId,
      proposed_connection_id: connectionId,
      structure_status: 'approved',
      updated_at: now,
    });
  }
  return connectionId;
}

async function finalizeRequestStatus(tx: MutatorTx, requestId: string) {
  const [pendingGrants, membership] = await Promise.all([
    tx.run(
      zql.group_right_grant_request
        .where('connection_request_id', requestId)
        .where('status', 'pending')
    ),
    getPrimaryMembershipRuleRequest(tx, requestId),
  ]);
  if (pendingGrants.length === 0 && (!membership || membership.status !== 'pending')) {
    await tx.mutate.group_connection_request.delete({ id: requestId });
    return;
  }
  await tx.mutate.group_connection_request.update({
    id: requestId,
    status: 'partially_approved',
    updated_at: Date.now(),
  });
}

export async function approveGroupConnectionRequest(
  tx: MutatorTx,
  requestId: string,
  grantRequestIds?: readonly string[] | null,
  approveMembership?: boolean
) {
  const request = await tx.run(zql.group_connection_request.where('id', requestId).one());
  if (!request) {
    throw new Error('Group connection request not found');
  }
  const connectionId = await ensureRequestedConnection(tx, request);
  const allGrantRequests = await tx.run(
    zql.group_right_grant_request.where('connection_request_id', requestId)
  );
  const selectedIds =
    grantRequestIds && grantRequestIds.length > 0 ? new Set(grantRequestIds) : null;
  const selectedGrants = allGrantRequests.filter(
    (item: { id: string; status: string }) =>
      item.status === 'pending' && (!selectedIds || selectedIds.has(item.id))
  );
  const now = Date.now();

  for (const item of selectedGrants) {
    if (item.operation === 'remove') {
      if (item.existing_grant_id) {
        await tx.mutate.group_right_grant.delete({ id: item.existing_grant_id });
      }
    } else {
      const existing = item.existing_grant_id
        ? await tx.run(zql.group_right_grant.where('id', item.existing_grant_id).one())
        : null;
      const values = {
        connection_id: connectionId,
        right_key: item.right_key,
        holder_group_id: item.holder_group_id,
        scope_group_id: item.scope_group_id,
        status: 'active',
        initiator_group_id: item.initiator_group_id,
        updated_at: now,
      };
      if (existing) {
        await tx.mutate.group_right_grant.update({ id: existing.id, ...values });
      } else {
        await tx.mutate.group_right_grant.insert({
          id: item.existing_grant_id ?? item.id,
          ...values,
          created_at: now,
        });
      }
    }
    await tx.mutate.group_right_grant_request.update({
      id: item.id,
      status: 'approved',
      updated_at: now,
    });
  }

  const membershipRequest = await getPrimaryMembershipRuleRequest(tx, requestId);
  const shouldApproveMembership =
    membershipRequest?.status === 'pending' &&
    (approveMembership === true || (approveMembership == null && selectedIds == null));
  if (shouldApproveMembership && membershipRequest) {
    if (membershipRequest.operation === 'remove') {
      if (membershipRequest.existing_membership_rule_id) {
        await tx.mutate.group_membership_rule.delete({
          id: membershipRequest.existing_membership_rule_id,
        });
      }
    } else {
      if (
        !membershipRequest.member_source_group_id ||
        !membershipRequest.member_target_group_id ||
        !membershipRequest.membership_mode
      ) {
        throw new Error('Approved membership rules require explicit source, target, and mode.');
      }
      const origins = await tx.run(
        zql.group_membership_rule_request_origin.where(
          'membership_rule_request_id',
          membershipRequest.id
        )
      );
      await syncGroupConnectionChildren(tx, {
        connectionId,
        grants: await tx.run(zql.group_right_grant.where('connection_id', connectionId)),
        membership_rule: {
          id: membershipRequest.existing_membership_rule_id ?? membershipRequest.id,
          member_source_group_id: membershipRequest.member_source_group_id,
          member_target_group_id: membershipRequest.member_target_group_id,
          membership_mode: membershipRequest.membership_mode,
          required_source_role_id: membershipRequest.required_source_role_id,
          eligible_origin_group_ids: origins.map(
            (origin: { eligible_origin_group_id: string }) => origin.eligible_origin_group_id
          ),
        },
      });
    }
    await tx.mutate.group_membership_rule_request.update({
      id: membershipRequest.id,
      status: 'approved',
      updated_at: now,
    });
  }

  await finalizeRequestStatus(tx, requestId);
  return request;
}

export async function rejectGroupConnectionRequest(
  tx: MutatorTx,
  requestId: string,
  grantRequestIds?: readonly string[] | null,
  rejectMembership?: boolean,
  rejectStructure?: boolean
) {
  const request = await tx.run(zql.group_connection_request.where('id', requestId).one());
  if (!request) {
    throw new Error('Group connection request not found');
  }
  if (rejectStructure || request.structure_status === 'pending') {
    const now = Date.now();
    const [grantRequests, membershipRequest] = await Promise.all([
      tx.run(zql.group_right_grant_request.where('connection_request_id', requestId)),
      getPrimaryMembershipRuleRequest(tx, requestId),
    ]);
    for (const item of grantRequests) {
      if (item.status === 'pending') {
        await tx.mutate.group_right_grant_request.update({
          id: item.id,
          status: 'rejected',
          updated_at: now,
        });
      }
    }
    if (membershipRequest?.status === 'pending') {
      await tx.mutate.group_membership_rule_request.update({
        id: membershipRequest.id,
        status: 'rejected',
        updated_at: now,
      });
    }
    await tx.mutate.group_connection_request.update({
      id: requestId,
      structure_status: 'rejected',
      status: 'rejected',
      updated_at: now,
    });
    return request;
  }

  const selectedIds =
    grantRequestIds && grantRequestIds.length > 0 ? new Set(grantRequestIds) : null;
  const grantRequests = await tx.run(
    zql.group_right_grant_request.where('connection_request_id', requestId)
  );
  for (const item of grantRequests) {
    if (item.status === 'pending' && (!selectedIds || selectedIds.has(item.id))) {
      await tx.mutate.group_right_grant_request.update({
        id: item.id,
        status: 'rejected',
        updated_at: Date.now(),
      });
    }
  }

  const membershipRequest = await getPrimaryMembershipRuleRequest(tx, requestId);
  if (
    membershipRequest?.status === 'pending' &&
    (rejectMembership === true || (rejectMembership == null && selectedIds == null))
  ) {
    await tx.mutate.group_membership_rule_request.update({
      id: membershipRequest.id,
      status: 'rejected',
      updated_at: Date.now(),
    });
  }
  await finalizeRequestStatus(tx, requestId);
  return request;
}
