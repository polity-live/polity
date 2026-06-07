import { zql } from '../schema';
import type { NetworkLinkRightSnapshot } from './request-types';
import {
  flattenMembershipRulesForStorage,
  hasActiveMembershipRules,
  normalizeMembershipRules,
  sameMembershipRules,
  toDirectionalMembershipRuleInput,
  toLegacyMembershipRuleFields,
} from './membershipRules';

type MutatorTx = any;

interface NetworkLinkRightInput {
  id?: string;
  right_key: string;
  direction: string;
  status?: string;
  initiator_group_id?: string | null;
}

interface NetworkLinkMembershipRuleInput {
  id?: string;
  membership_direction?: string | null;
  membership_mode?: string;
  role_id?: string | null;
  source_group_ids?: string[] | null;
}

interface ProposeNetworkLinkChangeInput {
  id: string;
  active_network_link_id?: string | null;
  proposed_network_link_id: string;
  source_group_id: string;
  target_group_id: string;
  structural_relation: 'parent_child' | 'sibling';
  status?: string;
  initiator_group_id: string;
  desired_rights: NetworkLinkRightSnapshot[];
  desired_membership_direction?: 'forward' | 'backward' | null;
  desired_membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  desired_role_id?: string | null;
  desired_source_group_ids?: string[] | null;
}

interface NetworkLinkRow {
  id: string;
  source_group_id: string;
  target_group_id: string;
  structural_relation: 'parent_child' | 'sibling';
  status?: string | null;
}

interface NetworkLinkRightRow {
  id: string;
  network_link_id: string;
  right_key: string;
  direction: string;
  status?: string | null;
  initiator_group_id?: string | null;
  updated_at?: number | null;
  created_at?: number | null;
}

interface NetworkLinkMembershipRuleRow {
  id: string;
  network_link_id: string;
  membership_direction?: 'forward' | 'backward' | null;
  membership_mode: string;
  role_id?: string | null;
  source_group_ids?: string[] | null;
  updated_at?: number | null;
  created_at?: number | null;
}

interface NetworkLinkChangeRequestRow {
  id: string;
  active_network_link_id?: string | null;
  proposed_network_link_id: string;
  source_group_id: string;
  target_group_id: string;
  structural_relation: 'parent_child' | 'sibling';
  status?: string | null;
  initiator_group_id: string;
  desired_rights: NetworkLinkRightSnapshot[];
  desired_membership_direction?: 'forward' | 'backward' | null;
  desired_membership_mode: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
  desired_role_id?: string | null;
  desired_source_group_ids?: string[] | null;
  updated_at?: number | null;
  created_at?: number | null;
}

type NetworkLinkChangeRequestRightSnapshotRow =
  NetworkLinkChangeRequestRow['desired_rights'][number];

function sortByRecency<
  T extends { updated_at?: number | null; created_at?: number | null; id: string },
>(rows: readonly T[]) {
  return [...rows].sort((left, right) => {
    const leftTs = left.updated_at ?? left.created_at ?? 0;
    const rightTs = right.updated_at ?? right.created_at ?? 0;
    if (leftTs !== rightTs) {
      return rightTs - leftTs;
    }
    return right.id.localeCompare(left.id);
  });
}

function deterministicUuidFromSeed(seed: string) {
  const hex = Array.from(seed).reduce(
    (state, character) => {
      const code = character.charCodeAt(0);
      state.a = (state.a * 33 + code) >>> 0;
      state.b = (state.b * 33 + code * 3) >>> 0;
      state.c = (state.c * 33 + code * 7) >>> 0;
      state.d = (state.d * 33 + code * 11) >>> 0;
      return state;
    },
    { a: 0x811c9dc5, b: 0x9e3779b9, c: 0x7f4a7c15, d: 0x94d049bb }
  );

  const hexString = [hex.a, hex.b, hex.c, hex.d]
    .map(part => part.toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32);

  return `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-4${hexString.slice(13, 16)}-a${hexString.slice(17, 20)}-${hexString.slice(20, 32)}`;
}

function normalizeDesiredRights(rights: readonly NetworkLinkRightInput[]) {
  const uniqueByKey = new Map<string, NetworkLinkRightInput>();
  for (const right of rights) {
    uniqueByKey.set(right.right_key, right);
  }

  return [...uniqueByKey.values()]
    .map(right => ({
      id: right.id,
      right_key: right.right_key,
      direction: right.direction,
      status: right.status ?? 'active',
      initiator_group_id: right.initiator_group_id ?? null,
    }))
    .sort((left, right) => left.right_key.localeCompare(right.right_key));
}

function toRightSnapshots(
  rights: readonly NetworkLinkRightInput[],
  linkIdSeed: string
): NetworkLinkRightSnapshot[] {
  return normalizeDesiredRights(rights).map(right => ({
    id: right.id ?? deterministicUuidFromSeed(`${linkIdSeed}:${right.right_key}`),
    right_key: right.right_key as NetworkLinkRightSnapshot['right_key'],
    direction: right.direction as NetworkLinkRightSnapshot['direction'],
  }));
}

function sameRights(
  left: readonly { right_key: string; direction: string }[],
  right: readonly { right_key: string; direction: string }[]
) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort((a, b) => a.right_key.localeCompare(b.right_key));
  const sortedRight = [...right].sort((a, b) => a.right_key.localeCompare(b.right_key));

  return sortedLeft.every(
    (entry, index) =>
      entry.right_key === sortedRight[index]?.right_key &&
      entry.direction === sortedRight[index]?.direction
  );
}

async function dedupeNetworkLinkRights(tx: MutatorTx, linkId: string) {
  const rights = (await tx.run(
    zql.network_link_right.where('network_link_id', linkId)
  )) as NetworkLinkRightRow[];
  const rightsByKey = new Map<string, (typeof rights)[number][]>();

  for (const right of rights) {
    const rows = rightsByKey.get(right.right_key) ?? [];
    rows.push(right);
    rightsByKey.set(right.right_key, rows);
  }

  for (const [, matchingRights] of rightsByKey.entries()) {
    const [keep, ...duplicates] = sortByRecency(matchingRights);
    for (const duplicate of duplicates) {
      await tx.mutate.network_link_right.delete({ id: duplicate.id });
    }
    if (!keep) {
      continue;
    }
  }

  return tx.run(zql.network_link_right.where('network_link_id', linkId));
}

export async function ensureSingleMembershipRule(
  tx: MutatorTx,
  linkId: string
): Promise<NetworkLinkMembershipRuleRow | null> {
  const rules = (await tx.run(
    zql.network_link_membership_rule.where('network_link_id', linkId)
  )) as NetworkLinkMembershipRuleRow[];
  const [keep, ...duplicates] = sortByRecency(rules);

  for (const duplicate of duplicates) {
    await tx.mutate.network_link_membership_rule.delete({ id: duplicate.id });
  }

  return keep ?? null;
}

export async function loadNetworkLinkState(tx: MutatorTx, linkId: string) {
  const link = (await tx.run(zql.network_link.where('id', linkId).one())) as NetworkLinkRow | null;
  const rights = await dedupeNetworkLinkRights(tx, linkId);
  const membershipRule = await ensureSingleMembershipRule(tx, linkId);

  return {
    link,
    rights,
    membershipRule,
  };
}

export async function syncNetworkLinkChildren(
  tx: MutatorTx,
  args: {
    linkId: string;
    rights?: NetworkLinkRightInput[];
    membership_rule?: NetworkLinkMembershipRuleInput | null;
  }
) {
  const now = Date.now();
  const existingRights = await dedupeNetworkLinkRights(tx, args.linkId);
  const desiredRights = normalizeDesiredRights(args.rights ?? []);
  const desiredRightKeys = new Set(desiredRights.map(right => right.right_key));

  for (const existingRight of existingRights) {
    if (!desiredRightKeys.has(existingRight.right_key)) {
      await tx.mutate.network_link_right.delete({ id: existingRight.id });
    }
  }

  for (const desiredRight of desiredRights) {
    const existingRight = existingRights.find(
      (right: (typeof existingRights)[number]) => right.right_key === desiredRight.right_key
    );

    if (existingRight) {
      await tx.mutate.network_link_right.update({
        id: existingRight.id,
        direction: desiredRight.direction,
        status: desiredRight.status,
        initiator_group_id: desiredRight.initiator_group_id ?? null,
        updated_at: now,
      });
      continue;
    }

    await tx.mutate.network_link_right.insert({
      id: desiredRight.id ?? deterministicUuidFromSeed(`${args.linkId}:${desiredRight.right_key}`),
      network_link_id: args.linkId,
      right_key: desiredRight.right_key,
      direction: desiredRight.direction,
      status: desiredRight.status,
      initiator_group_id: desiredRight.initiator_group_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }

  const normalizedRule = normalizeMembershipRules(args.membership_rule);
  const existingRule = await ensureSingleMembershipRule(tx, args.linkId);

  if (!hasActiveMembershipRules(normalizedRule)) {
    if (existingRule) {
      await tx.mutate.network_link_membership_rule.delete({ id: existingRule.id });
    }
    return;
  }

  if (existingRule) {
    await tx.mutate.network_link_membership_rule.update({
      id: existingRule.id,
      ...flattenMembershipRulesForStorage(normalizedRule),
      updated_at: now,
    });
    return;
  }

  await tx.mutate.network_link_membership_rule.insert({
    id: args.membership_rule?.id ?? deterministicUuidFromSeed(`${args.linkId}:membership_rule`),
    network_link_id: args.linkId,
    ...flattenMembershipRulesForStorage(normalizedRule),
    created_at: now,
    updated_at: now,
  });
}

export async function deleteNetworkLinkChildren(tx: MutatorTx, linkId: string) {
  const rights = await tx.run(zql.network_link_right.where('network_link_id', linkId));
  for (const right of rights) {
    await tx.mutate.network_link_right.delete({ id: right.id });
  }

  const rule = await ensureSingleMembershipRule(tx, linkId);
  if (rule) {
    await tx.mutate.network_link_membership_rule.delete({ id: rule.id });
  }
}

async function findExistingChangeRequest(
  tx: MutatorTx,
  args: {
    activeNetworkLinkId?: string | null;
    sourceGroupId: string;
    targetGroupId: string;
    structuralRelation: string;
  }
) {
  if (args.activeNetworkLinkId) {
    const byLink = (await tx.run(
      zql.network_link_change_request.where('active_network_link_id', args.activeNetworkLinkId)
    )) as NetworkLinkChangeRequestRow[];
    if (byLink[0]) {
      return byLink[0];
    }
  }

  const byPair = (await tx.run(
    zql.network_link_change_request
      .where('source_group_id', args.sourceGroupId)
      .where('target_group_id', args.targetGroupId)
      .where('structural_relation', args.structuralRelation)
  )) as NetworkLinkChangeRequestRow[];
  return byPair[0] ?? null;
}

async function deleteChangeRequestsByLinkId(tx: MutatorTx, linkId: string) {
  const requests = (await tx.run(zql.network_link_change_request)) as NetworkLinkChangeRequestRow[];
  for (const request of requests) {
    if (request.active_network_link_id === linkId || request.proposed_network_link_id === linkId) {
      await tx.mutate.network_link_change_request.delete({ id: request.id });
    }
  }
}

export async function deleteNetworkLinkAndRequests(tx: MutatorTx, linkId: string) {
  await deleteChangeRequestsByLinkId(tx, linkId);
  await deleteNetworkLinkChildren(tx, linkId);
  await tx.mutate.network_link.delete({ id: linkId });
}

function getDesiredMembershipRules(args: ProposeNetworkLinkChangeInput) {
  return normalizeMembershipRules({
    membership_direction: args.desired_membership_direction ?? null,
    membership_mode: args.desired_membership_mode,
    role_id: args.desired_role_id ?? null,
    source_group_ids: args.desired_source_group_ids ?? null,
  });
}

function getRequestedMembershipRule(
  request: Pick<
    NetworkLinkChangeRequestRow,
    | 'desired_membership_direction'
    | 'desired_membership_mode'
    | 'desired_role_id'
    | 'desired_source_group_ids'
  >
) {
  return {
    membership_direction: request.desired_membership_direction ?? null,
    membership_mode: request.desired_membership_mode,
    role_id: request.desired_role_id ?? null,
    source_group_ids: request.desired_source_group_ids ?? null,
  };
}

function buildActiveComparableState(args: {
  link:
    | {
        source_group_id: string;
        target_group_id: string;
        structural_relation: string;
      }
    | null
    | undefined;
  rights: readonly { right_key: string; direction: string }[];
  membershipRule:
    | {
        membership_direction?: string | null;
        membership_mode?: string | null;
        role_id?: string | null;
        source_group_ids?: string[] | null;
      }
    | null
    | undefined;
}) {
  return {
    source_group_id: args.link?.source_group_id ?? null,
    target_group_id: args.link?.target_group_id ?? null,
    structural_relation: args.link?.structural_relation ?? null,
    rights: [...args.rights].map(right => ({
      right_key: right.right_key,
      direction: right.direction,
    })),
    membership_rule: normalizeMembershipRules(args.membershipRule),
  };
}

function desiredStateMatchesActive(args: {
  active: {
    source_group_id: string | null;
    target_group_id: string | null;
    structural_relation: string | null;
    rights: readonly { right_key: string; direction: string }[];
    membership_rule: NetworkLinkMembershipRuleInput;
  } | null;
  desired: ProposeNetworkLinkChangeInput;
}) {
  if (!args.active) {
    return false;
  }

  return (
    args.active.source_group_id === args.desired.source_group_id &&
    args.active.target_group_id === args.desired.target_group_id &&
    args.active.structural_relation === args.desired.structural_relation &&
    sameRights(args.active.rights, args.desired.desired_rights) &&
    sameMembershipRules(args.active.membership_rule, getDesiredMembershipRules(args.desired))
  );
}

function normalizeRequestedRightIds(
  desiredRights: readonly NetworkLinkChangeRequestRightSnapshotRow[],
  rightIds?: readonly string[] | null
) {
  if (!rightIds || rightIds.length === 0) {
    return null;
  }

  const desiredRightIds = new Set(desiredRights.map(right => right.id));
  const selectedRightIds = [...new Set(rightIds)].filter(rightId => desiredRightIds.has(rightId));

  return selectedRightIds.length > 0 ? new Set(selectedRightIds) : null;
}

function getRemainingDesiredRights(args: {
  desiredRights: readonly NetworkLinkChangeRequestRightSnapshotRow[];
  activeRights: readonly Pick<NetworkLinkRightRow, 'right_key' | 'direction'>[];
}) {
  const activeRightsByKey = new Map(
    args.activeRights.map(right => [right.right_key, right.direction])
  );

  return args.desiredRights.filter(desiredRight => {
    return activeRightsByKey.get(desiredRight.right_key) !== desiredRight.direction;
  });
}

function mergeDesiredRightsIntoActive(args: {
  activeRights: readonly Pick<
    NetworkLinkRightRow,
    'id' | 'right_key' | 'direction' | 'initiator_group_id'
  >[];
  desiredRights: readonly NetworkLinkChangeRequestRightSnapshotRow[];
  initiatorGroupId: string;
}) {
  const rightsByKey = new Map(
    args.activeRights.map(right => [
      right.right_key,
      {
        id: right.id,
        right_key: right.right_key,
        direction: right.direction,
        status: 'active',
        initiator_group_id: right.initiator_group_id ?? null,
      } satisfies NetworkLinkRightInput,
    ])
  );

  for (const desiredRight of args.desiredRights) {
    const existingRight = rightsByKey.get(desiredRight.right_key);
    rightsByKey.set(desiredRight.right_key, {
      id: existingRight?.id ?? desiredRight.id,
      right_key: desiredRight.right_key,
      direction: desiredRight.direction,
      status: 'active',
      initiator_group_id: args.initiatorGroupId,
    });
  }

  return [...rightsByKey.values()].sort((left, right) =>
    left.right_key.localeCompare(right.right_key)
  );
}

async function upsertNetworkLinkFromRequest(args: {
  tx: MutatorTx;
  request: NetworkLinkChangeRequestRow;
  linkId: string;
  now: number;
}) {
  const existingLink = (await args.tx.run(
    zql.network_link.where('id', args.linkId).one()
  )) as NetworkLinkRow | null;

  if (existingLink) {
    await args.tx.mutate.network_link.update({
      id: args.linkId,
      source_group_id: args.request.source_group_id,
      target_group_id: args.request.target_group_id,
      structural_relation: args.request.structural_relation,
      status: 'active',
      updated_at: args.now,
    });
    return;
  }

  await args.tx.mutate.network_link.insert({
    id: args.linkId,
    source_group_id: args.request.source_group_id,
    target_group_id: args.request.target_group_id,
    structural_relation: args.request.structural_relation,
    status: 'active',
    created_by_id: null,
    created_at: args.now,
    updated_at: args.now,
  });
}

async function upsertChangeRequest(tx: MutatorTx, args: ProposeNetworkLinkChangeInput) {
  const now = Date.now();
  const existingRequest = await findExistingChangeRequest(tx, {
    activeNetworkLinkId: args.active_network_link_id ?? null,
    sourceGroupId: args.source_group_id,
    targetGroupId: args.target_group_id,
    structuralRelation: args.structural_relation,
  });

  const payload = {
    active_network_link_id: args.active_network_link_id ?? null,
    proposed_network_link_id: args.proposed_network_link_id,
    source_group_id: args.source_group_id,
    target_group_id: args.target_group_id,
    structural_relation: args.structural_relation,
    status: args.status ?? 'requested',
    initiator_group_id: args.initiator_group_id,
    desired_rights: toRightSnapshots(args.desired_rights, args.proposed_network_link_id),
    desired_membership_direction: toLegacyMembershipRuleFields(getDesiredMembershipRules(args))
      .membership_direction,
    desired_membership_mode: toLegacyMembershipRuleFields(getDesiredMembershipRules(args))
      .membership_mode,
    desired_role_id: toLegacyMembershipRuleFields(getDesiredMembershipRules(args)).role_id,
    desired_source_group_ids: toLegacyMembershipRuleFields(getDesiredMembershipRules(args))
      .source_group_ids,
    updated_at: now,
  };

  if (existingRequest) {
    await tx.mutate.network_link_change_request.update({
      id: existingRequest.id,
      ...payload,
    });
    return existingRequest.id;
  }

  await tx.mutate.network_link_change_request.insert({
    id: args.id,
    ...payload,
    created_at: now,
  });
  return args.id;
}

export async function proposeNetworkLinkChange(tx: MutatorTx, args: ProposeNetworkLinkChangeInput) {
  const desiredRights = normalizeDesiredRights(
    args.desired_rights.map(right => ({
      ...right,
      status: 'active',
      initiator_group_id: args.initiator_group_id,
    }))
  );
  const desiredRightSnapshots = toRightSnapshots(desiredRights, args.proposed_network_link_id);
  const desiredMembershipRules = getDesiredMembershipRules(args);

  const activeLinkId = args.active_network_link_id ?? null;
  const existing =
    activeLinkId != null
      ? await loadNetworkLinkState(tx, activeLinkId)
      : { link: null, rights: [], membershipRule: null };

  if (!existing.link) {
    await upsertChangeRequest(tx, {
      ...args,
      active_network_link_id: null,
      desired_rights: desiredRightSnapshots,
    });
    return;
  }

  const desiredRightByKey = new Map(desiredRights.map(right => [right.right_key, right]));
  const retainedActiveRights = existing.rights.filter((existingRight: NetworkLinkRightRow) => {
    const desiredRight = desiredRightByKey.get(existingRight.right_key);
    return Boolean(desiredRight);
  });

  const rightsToKeepActive = retainedActiveRights.filter((existingRight: NetworkLinkRightRow) => {
    const desiredRight = desiredRightByKey.get(existingRight.right_key);
    return desiredRight?.direction === existingRight.direction;
  });

  if (rightsToKeepActive.length === 0) {
    await deleteNetworkLinkChildren(tx, existing.link.id);
    await tx.mutate.network_link.delete({ id: existing.link.id });
  } else {
    await syncNetworkLinkChildren(tx, {
      linkId: existing.link.id,
      rights: rightsToKeepActive.map((right: NetworkLinkRightRow) => ({
        id: right.id,
        right_key: right.right_key,
        direction: right.direction,
        status: 'active',
        initiator_group_id: right.initiator_group_id ?? null,
      })),
      membership_rule: !hasActiveMembershipRules(desiredMembershipRules)
        ? null
        : sameMembershipRules(existing.membershipRule, desiredMembershipRules)
          ? toDirectionalMembershipRuleInput(desiredMembershipRules, existing.membershipRule?.id)
          : existing.membershipRule
            ? toDirectionalMembershipRuleInput(existing.membershipRule, existing.membershipRule.id)
            : null,
    });
  }

  const refreshedActive =
    rightsToKeepActive.length === 0 ? null : await loadNetworkLinkState(tx, existing.link.id);

  const activeComparable = refreshedActive?.link
    ? buildActiveComparableState({
        link: refreshedActive.link,
        rights: refreshedActive.rights,
        membershipRule: refreshedActive.membershipRule,
      })
    : null;

  if (
    desiredStateMatchesActive({
      active: activeComparable,
      desired: {
        ...args,
        desired_rights: desiredRightSnapshots,
      },
    })
  ) {
    const existingRequest = await findExistingChangeRequest(tx, {
      activeNetworkLinkId: activeLinkId,
      sourceGroupId: args.source_group_id,
      targetGroupId: args.target_group_id,
      structuralRelation: args.structural_relation,
    });
    if (existingRequest) {
      await tx.mutate.network_link_change_request.delete({ id: existingRequest.id });
    }
    return;
  }

  await upsertChangeRequest(tx, {
    ...args,
    active_network_link_id: refreshedActive?.link?.id ?? null,
    desired_rights: desiredRightSnapshots,
    desired_membership_direction: desiredMembershipRules.membership_direction,
  });
}

export async function approveNetworkLinkChangeRequest(
  tx: MutatorTx,
  requestId: string,
  rightIds?: readonly string[] | null
) {
  const request = (await tx.run(
    zql.network_link_change_request.where('id', requestId).one()
  )) as NetworkLinkChangeRequestRow | null;
  if (!request) {
    throw new Error('Network link change request not found');
  }

  const requestedRightIds = normalizeRequestedRightIds(request.desired_rights ?? [], rightIds);
  const now = Date.now();
  const finalLinkId = request.active_network_link_id ?? request.proposed_network_link_id;
  const isPartialApproval =
    requestedRightIds != null && requestedRightIds.size < (request.desired_rights ?? []).length;

  await upsertNetworkLinkFromRequest({
    tx,
    request,
    linkId: finalLinkId,
    now,
  });

  const existingState = await loadNetworkLinkState(tx, finalLinkId);

  if (isPartialApproval) {
    const selectedDesiredRights = (request.desired_rights ?? []).filter(desiredRight =>
      requestedRightIds.has(desiredRight.id)
    );

    await syncNetworkLinkChildren(tx, {
      linkId: finalLinkId,
      rights: mergeDesiredRightsIntoActive({
        activeRights: existingState.rights,
        desiredRights: selectedDesiredRights,
        initiatorGroupId: request.initiator_group_id,
      }),
      membership_rule: hasActiveMembershipRules(getRequestedMembershipRule(request))
        ? toDirectionalMembershipRuleInput(getRequestedMembershipRule(request))
        : null,
    });

    const refreshedState = await loadNetworkLinkState(tx, finalLinkId);
    const remainingDesiredRights = getRemainingDesiredRights({
      desiredRights: request.desired_rights ?? [],
      activeRights: refreshedState.rights,
    });

    if (remainingDesiredRights.length === 0) {
      await tx.mutate.network_link_change_request.delete({ id: request.id });
      return request;
    }

    await tx.mutate.network_link_change_request.update({
      id: request.id,
      active_network_link_id: finalLinkId,
      proposed_network_link_id: finalLinkId,
      desired_rights: remainingDesiredRights,
      updated_at: now,
    });
    return request;
  }

  await syncNetworkLinkChildren(tx, {
    linkId: finalLinkId,
    rights: mergeDesiredRightsIntoActive({
      activeRights: existingState.rights,
      desiredRights: request.desired_rights ?? [],
      initiatorGroupId: request.initiator_group_id,
    }),
    membership_rule: hasActiveMembershipRules(getRequestedMembershipRule(request))
      ? toDirectionalMembershipRuleInput(getRequestedMembershipRule(request))
      : null,
  });

  await tx.mutate.network_link_change_request.delete({ id: request.id });
  return request;
}

export async function rejectNetworkLinkChangeRequest(
  tx: MutatorTx,
  requestId: string,
  rightIds?: readonly string[] | null
) {
  const request = (await tx.run(
    zql.network_link_change_request.where('id', requestId).one()
  )) as NetworkLinkChangeRequestRow | null;
  if (!request) {
    throw new Error('Network link change request not found');
  }

  const requestedRightIds = normalizeRequestedRightIds(request.desired_rights ?? [], rightIds);
  const isPartialRejection =
    requestedRightIds != null && requestedRightIds.size < (request.desired_rights ?? []).length;

  if (isPartialRejection) {
    const activeState =
      request.active_network_link_id != null
        ? await loadNetworkLinkState(tx, request.active_network_link_id)
        : { link: null, rights: [], membershipRule: null };
    const remainingDesiredRights = getRemainingDesiredRights({
      desiredRights: (request.desired_rights ?? []).filter(
        desiredRight => !requestedRightIds.has(desiredRight.id)
      ),
      activeRights: activeState.rights,
    });

    if (remainingDesiredRights.length === 0) {
      await tx.mutate.network_link_change_request.delete({ id: request.id });
      return request;
    }

    await tx.mutate.network_link_change_request.update({
      id: request.id,
      desired_rights: remainingDesiredRights,
      updated_at: Date.now(),
    });
    return request;
  }

  await tx.mutate.network_link_change_request.delete({ id: request.id });
  return request;
}
