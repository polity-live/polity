import { isActiveGroupStatus } from '../server-helpers';
import { zql } from '../schema';
import {
  HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
  SIBLING_ALL_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from '../groups/membership-source-constants';

interface ReconcileTx {
  run: (query: any) => Promise<any>;
  mutate: Record<string, any>;
}

export interface GroupGraphReconcileResult {
  affectedGroupIds: Set<string>;
  affectedUserIds: Set<string>;
  affectedMembershipPairs: Set<string>;
}

export interface GroupGraphChangeSet {
  groupIds?: readonly (string | null | undefined)[];
  userIds?: readonly (string | null | undefined)[];
  eventIds?: readonly (string | null | undefined)[];
  assignedById?: string | null;
  reason?: string;
}

type ConnectionKind = 'hierarchy' | 'sibling' | 'parliament' | 'committee' | 'institution';

interface HierarchyMembershipOriginPlan {
  sourceGroupId: string;
  sourceMembershipId: string;
  connectionId: string | null;
  partGroupId: string | null;
  baseGroupId: string;
  pathGroupIds: string[];
  depth: number;
}

interface HierarchyMembershipPlan {
  groupId: string;
  userId: string;
  origins: HierarchyMembershipOriginPlan[];
}

const SIBLING_SOURCE_TO_ORIGIN_KIND = new Map<string, string>([
  [SIBLING_ALL_MEMBERSHIP_SOURCE, 'sibling_all_members'],
  [SIBLING_ELECTED_MEMBERSHIP_SOURCE, 'sibling_role_members'],
  [SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE, 'sibling_selected_source_groups'],
]);

const ACTIVE_RIGHT_KEYS = new Set([
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
]);

function uniqueStrings(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function pairKey(groupId: string, userId: string) {
  return `${groupId}:${userId}`;
}

function asActiveStatus(status: string | null | undefined) {
  return status === 'active';
}

function normalizeConnectionKind(
  connection: any,
  groupsById: ReadonlyMap<string, any>
): ConnectionKind {
  if (connection.connection_kind) {
    return connection.connection_kind;
  }

  if (connection.connection_type === 'hierarchy') {
    return 'hierarchy';
  }

  const endpointTypes = [
    groupsById.get(connection.group_a_id)?.group_type,
    groupsById.get(connection.group_b_id)?.group_type,
  ];
  if (endpointTypes.includes('committee')) return 'committee';
  if (endpointTypes.includes('institution')) return 'institution';
  if (endpointTypes.includes('parliament')) return 'parliament';
  return 'sibling';
}

function getDirectedConnectionFields(connection: any, groupsById: ReadonlyMap<string, any>) {
  if (connection.connection_type === 'hierarchy') {
    return {
      from_group_id: connection.child_group_id ?? connection.from_group_id ?? connection.group_b_id,
      to_group_id: connection.parent_group_id ?? connection.to_group_id ?? connection.group_a_id,
      connection_kind: 'hierarchy' as const,
    };
  }

  return {
    from_group_id: connection.from_group_id ?? connection.group_a_id,
    to_group_id: connection.to_group_id ?? connection.group_b_id,
    connection_kind: normalizeConnectionKind(connection, groupsById),
  };
}

function toSiblingMembershipKind(mode: string | null | undefined) {
  switch (mode) {
    case 'role_members':
      return 'elected';
    case 'selected_source_groups':
      return 'parliament';
    case 'all_members':
    case 'none':
      return 'open';
    default:
      return null;
  }
}

function buildExplicitGroupMetaMap(args: {
  groups: readonly any[];
  connections: readonly any[];
  rules: readonly any[];
}) {
  const rulesByConnectionId = new Map(args.rules.map(rule => [rule.connection_id, rule]));
  const result = new Map<string, any>();

  for (const group of args.groups) {
    const groupId = group.id;
    const activeConnections = args.connections.filter(connection => {
      if (!asActiveStatus(connection.status)) {
        return false;
      }
      const directed = getDirectedConnectionFields(connection, new Map());
      return (
        connection.group_a_id === groupId ||
        connection.group_b_id === groupId ||
        directed.from_group_id === groupId ||
        directed.to_group_id === groupId
      );
    });
    const hasHierarchyChildren = activeConnections.some(connection => {
      const directed = getDirectedConnectionFields(connection, new Map());
      return directed.connection_kind === 'hierarchy' && directed.to_group_id === groupId;
    });
    const siblingConnections = activeConnections
      .filter(connection => {
        const directed = getDirectedConnectionFields(connection, new Map());
        return (
          connection.connection_type === 'peer' ||
          (directed.connection_kind !== 'hierarchy' && directed.connection_kind != null)
        );
      })
      .sort(
        (left, right) =>
          (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
      );
    const incomingSiblingContext =
      siblingConnections
        .map(connection => ({
          connection,
          rule: rulesByConnectionId.get(connection.id),
        }))
        .find(context => context.rule?.member_target_group_id === groupId) ?? null;
    const primarySiblingConnection = incomingSiblingContext?.connection ?? siblingConnections[0];
    const primarySiblingMode = incomingSiblingContext
      ? (incomingSiblingContext.rule?.membership_mode ?? 'none')
      : siblingConnections.length > 0
        ? 'none'
        : null;
    const directedSibling = primarySiblingConnection
      ? getDirectedConnectionFields(primarySiblingConnection, new Map())
      : null;
    const connectedGroupId =
      incomingSiblingContext?.rule?.member_source_group_id ??
      (directedSibling == null
        ? null
        : directedSibling.from_group_id === groupId
          ? directedSibling.to_group_id
          : directedSibling.from_group_id);

    result.set(groupId, {
      group_type: hasHierarchyChildren
        ? 'hierarchical'
        : siblingConnections.length > 0
          ? 'sibling'
          : 'base',
      has_hierarchy_children: hasHierarchyChildren,
      has_sibling_connections: siblingConnections.length > 0,
      connected_group_id: connectedGroupId ?? null,
      primary_sibling_membership_mode: primarySiblingMode,
      sibling_membership_mode: toSiblingMembershipKind(primarySiblingMode),
      sibling_role_id: incomingSiblingContext?.rule?.required_source_role_id ?? null,
    });
  }

  return result;
}

function buildHierarchyPaths(connections: readonly any[]) {
  const activeHierarchyConnections = connections.filter(
    connection => asActiveStatus(connection.status) && connection.connection_type === 'hierarchy'
  );
  const parentEdgesByChildId = new Map<string, any[]>();

  for (const connection of activeHierarchyConnections) {
    const childGroupId =
      connection.child_group_id ?? connection.from_group_id ?? connection.group_b_id;
    const parentGroupId =
      connection.parent_group_id ?? connection.to_group_id ?? connection.group_a_id;
    if (!childGroupId || !parentGroupId || childGroupId === parentGroupId) {
      continue;
    }
    const edges = parentEdgesByChildId.get(childGroupId) ?? [];
    edges.push({ connection, childGroupId, parentGroupId });
    parentEdgesByChildId.set(childGroupId, edges);
  }

  const paths: any[] = [];

  function visit(
    baseGroupId: string,
    currentGroupId: string,
    pathGroupIds: string[],
    visited: Set<string>
  ) {
    const edges = parentEdgesByChildId.get(currentGroupId) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.parentGroupId)) {
        continue;
      }
      const nextPath = [...pathGroupIds, edge.parentGroupId];
      paths.push({
        ancestor_group_id: edge.parentGroupId,
        descendant_group_id: baseGroupId,
        direct_child_group_id:
          nextPath.length > 2 ? nextPath[nextPath.length - 2] : edge.childGroupId,
        base_group_id: baseGroupId,
        depth: nextPath.length - 1,
        path_group_ids: nextPath,
        connection_id: edge.connection.id,
      });
      visit(baseGroupId, edge.parentGroupId, nextPath, new Set([...visited, edge.parentGroupId]));
    }
  }

  for (const childGroupId of parentEdgesByChildId.keys()) {
    visit(childGroupId, childGroupId, [childGroupId], new Set([childGroupId]));
  }

  const seen = new Set<string>();
  return paths.filter(path => {
    const key = `${path.ancestor_group_id}:${path.descendant_group_id}:${path.base_group_id}:${path.path_group_ids.join('>')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function findHierarchyPathForMembership(
  paths: readonly any[],
  groupId: string,
  baseGroupId: string | null
) {
  if (!baseGroupId) {
    return null;
  }
  return (
    paths
      .filter(path => path.ancestor_group_id === groupId && path.base_group_id === baseGroupId)
      .sort((left, right) => left.depth - right.depth)[0] ?? null
  );
}

function sortHierarchyOrigins(origins: readonly HierarchyMembershipOriginPlan[]) {
  return [...origins].sort((left, right) => {
    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }
    return left.baseGroupId.localeCompare(right.baseGroupId);
  });
}

export function buildHierarchyMembershipPlans(args: {
  memberships: readonly any[];
  hierarchyPaths: readonly any[];
}) {
  const pathsByBaseGroupId = new Map<string, any[]>();
  for (const path of args.hierarchyPaths) {
    const paths = pathsByBaseGroupId.get(path.base_group_id) ?? [];
    paths.push(path);
    pathsByBaseGroupId.set(path.base_group_id, paths);
  }

  const plansByKey = new Map<string, HierarchyMembershipPlan>();

  for (const membership of args.memberships) {
    if (membership.source !== 'direct' || !isActiveGroupStatus(membership.status)) {
      continue;
    }

    const hierarchyPaths = pathsByBaseGroupId.get(membership.group_id) ?? [];
    for (const path of hierarchyPaths) {
      const key = pairKey(path.ancestor_group_id, membership.user_id);
      const plan =
        plansByKey.get(key) ??
        ({
          groupId: path.ancestor_group_id,
          userId: membership.user_id,
          origins: [] as HierarchyMembershipOriginPlan[],
        } satisfies HierarchyMembershipPlan);
      plan.origins.push({
        sourceGroupId: membership.group_id,
        sourceMembershipId: membership.id,
        connectionId: path.connection_id ?? null,
        partGroupId: path.direct_child_group_id ?? membership.group_id,
        baseGroupId: membership.group_id,
        pathGroupIds: Array.isArray(path.path_group_ids)
          ? path.path_group_ids
          : [membership.group_id, path.ancestor_group_id],
        depth: path.depth ?? 0,
      });
      plansByKey.set(key, plan);
    }
  }

  for (const [key, plan] of plansByKey) {
    plansByKey.set(key, {
      ...plan,
      origins: sortHierarchyOrigins(plan.origins),
    });
  }

  return plansByKey;
}

function findMembershipRuleForMembership(rules: readonly any[], membership: any) {
  if (!membership.source_group_id) {
    return null;
  }
  return (
    rules.find(
      rule =>
        rule.member_target_group_id === membership.group_id &&
        rule.member_source_group_id === membership.source_group_id
    ) ?? null
  );
}

function resolveMembershipProjection(args: {
  membership: any;
  hierarchyPaths: readonly any[];
  directMembershipByUserAndGroup: ReadonlyMap<string, any>;
  rules: readonly any[];
}) {
  const { membership, hierarchyPaths, directMembershipByUserAndGroup, rules } = args;
  const source = membership.source ?? 'direct';
  const siblingOriginKind = SIBLING_SOURCE_TO_ORIGIN_KIND.get(source);
  const membershipRule = findMembershipRuleForMembership(rules, membership);

  if (source === 'direct') {
    return {
      origin_kind: 'direct',
      connection_id: null,
      membership_rule_id: null,
      part_group_id: membership.group_id,
      base_group_id: membership.group_id,
      is_auto_managed: false,
      source_membership_id: membership.id,
      source_role_id: null,
      path_group_ids: [membership.group_id],
      depth: 0,
    };
  }

  if (source === HIERARCHY_DERIVED_MEMBERSHIP_SOURCE) {
    const baseGroupId = membership.source_group_id ?? membership.base_group_id ?? null;
    const path = findHierarchyPathForMembership(hierarchyPaths, membership.group_id, baseGroupId);
    const sourceMembership = baseGroupId
      ? directMembershipByUserAndGroup.get(`${membership.user_id}:${baseGroupId}`)
      : null;

    return {
      origin_kind: 'hierarchy',
      connection_id: path?.connection_id ?? membership.connection_id ?? null,
      membership_rule_id: null,
      part_group_id: path?.direct_child_group_id ?? baseGroupId ?? membership.part_group_id ?? null,
      base_group_id: baseGroupId,
      is_auto_managed: true,
      source_membership_id: sourceMembership?.id ?? null,
      source_role_id: null,
      path_group_ids: path?.path_group_ids ?? [baseGroupId, membership.group_id].filter(Boolean),
      depth: path?.depth ?? 0,
    };
  }

  if (siblingOriginKind) {
    return {
      origin_kind: siblingOriginKind,
      connection_id: membershipRule?.connection_id ?? membership.connection_id ?? null,
      membership_rule_id: membershipRule?.id ?? membership.membership_rule_id ?? null,
      part_group_id: membership.source_group_id ?? membership.part_group_id ?? null,
      base_group_id: membership.source_group_id ?? membership.base_group_id ?? null,
      is_auto_managed: true,
      source_membership_id:
        membership.source_group_id != null
          ? (directMembershipByUserAndGroup.get(
              `${membership.user_id}:${membership.source_group_id}`
            )?.id ?? null)
          : null,
      source_role_id: membershipRule?.required_source_role_id ?? null,
      path_group_ids: [membership.source_group_id, membership.group_id].filter(Boolean),
      depth: 1,
    };
  }

  return {
    origin_kind: 'manual_projection',
    connection_id: membership.connection_id ?? null,
    membership_rule_id: membership.membership_rule_id ?? membershipRule?.id ?? null,
    part_group_id: membership.part_group_id ?? membership.source_group_id ?? membership.group_id,
    base_group_id: membership.base_group_id ?? membership.source_group_id ?? membership.group_id,
    is_auto_managed: false,
    source_membership_id: null,
    source_role_id: membershipRule?.required_source_role_id ?? null,
    path_group_ids: [membership.source_group_id, membership.group_id].filter(Boolean),
    depth: 0,
  };
}

async function clearTable(tx: ReconcileTx, tableName: string, rows: readonly any[]) {
  for (const row of rows) {
    await tx.mutate[tableName].delete({ id: row.id });
  }
}

async function reconcileConnections(
  tx: ReconcileTx,
  connections: readonly any[],
  groupsById: ReadonlyMap<string, any>
) {
  for (const connection of connections) {
    const directed = getDirectedConnectionFields(connection, groupsById);
    const patch: Record<string, unknown> = { id: connection.id };
    for (const [key, value] of Object.entries(directed)) {
      if (connection[key] !== value) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length > 1) {
      await tx.mutate.group_connection.update(patch);
    }
  }
}

async function reconcileGroupMeta(
  tx: ReconcileTx,
  args: {
    groups: readonly any[];
    connections: readonly any[];
    rules: readonly any[];
  }
) {
  const metaByGroupId = buildExplicitGroupMetaMap({
    groups: args.groups,
    connections: args.connections,
    rules: args.rules,
  });

  for (const group of args.groups) {
    const meta = metaByGroupId.get(group.id);
    if (!meta) {
      continue;
    }
    const patch: Record<string, unknown> = { id: group.id };
    for (const key of [
      'group_type',
      'has_hierarchy_children',
      'has_sibling_connections',
      'connected_group_id',
      'primary_sibling_membership_mode',
      'sibling_membership_mode',
      'sibling_role_id',
    ] as const) {
      if (group[key] !== meta[key]) {
        patch[key] = meta[key];
      }
    }
    if (Object.keys(patch).length > 1) {
      await tx.mutate.group.update(patch);
    }
  }
}

async function reconcileHierarchyPaths(tx: ReconcileTx, paths: readonly any[]) {
  const existingPaths = await tx.run(zql.group_hierarchy_path);
  await clearTable(tx, 'group_hierarchy_path', existingPaths);
  const now = Date.now();

  for (const path of paths) {
    await tx.mutate.group_hierarchy_path.insert({
      id: crypto.randomUUID(),
      ...path,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }
}

async function reconcileEffectiveRights(tx: ReconcileTx, grants: readonly any[]) {
  const existingRights = await tx.run(zql.group_effective_right);
  await clearTable(tx, 'group_effective_right', existingRights);
  const now = Date.now();

  const insertedKeys = new Set<string>();
  for (const grant of grants) {
    if (!asActiveStatus(grant.status) || !ACTIVE_RIGHT_KEYS.has(grant.right_key)) {
      continue;
    }
    const key = `${grant.holder_group_id}:${grant.scope_group_id}:${grant.right_key}:${grant.connection_id}:${grant.id}`;
    if (insertedKeys.has(key)) {
      continue;
    }
    insertedKeys.add(key);
    await tx.mutate.group_effective_right.insert({
      id: crypto.randomUUID(),
      holder_group_id: grant.holder_group_id,
      scope_group_id: grant.scope_group_id,
      right_key: grant.right_key,
      source_connection_id: grant.connection_id,
      source_grant_id: grant.id,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }
}

async function ensureMemberRoleLink(
  tx: ReconcileTx,
  args: {
    membershipId: string;
    groupId: string;
    roles: readonly any[];
    membershipRoles: readonly any[];
    assignedById?: string | null;
  }
) {
  const memberRole = args.roles.find(
    role =>
      role.group_id === args.groupId &&
      role.name === 'Member' &&
      role.scope === 'group' &&
      role.assignee_kind !== 'guest'
  );
  if (!memberRole) {
    return;
  }

  const existingLink = args.membershipRoles.find(
    link => link.group_membership_id === args.membershipId && link.role_id === memberRole.id
  );
  if (existingLink) {
    return;
  }

  const now = Date.now();
  await tx.mutate.group_membership_role.insert({
    id: crypto.randomUUID(),
    group_membership_id: args.membershipId,
    role_id: memberRole.id,
    assigned_at: now,
    assigned_by_id: args.assignedById ?? null,
    created_at: now,
  });
}

async function reconcileHierarchyMembershipRows(
  tx: ReconcileTx,
  args: {
    memberships: readonly any[];
    hierarchyPaths: readonly any[];
    roles: readonly any[];
    membershipRoles: readonly any[];
    assignedById?: string | null;
  }
) {
  const desiredPlans = buildHierarchyMembershipPlans({
    memberships: args.memberships,
    hierarchyPaths: args.hierarchyPaths,
  });
  const membershipsByGroupAndUser = new Map(
    args.memberships.map(membership => [
      pairKey(membership.group_id, membership.user_id),
      membership,
    ])
  );
  const nextMembershipsById = new Map(
    args.memberships.map(membership => [membership.id, membership])
  );
  const hierarchyOriginsByMembershipId = new Map<string, HierarchyMembershipOriginPlan[]>();
  const affectedGroupIds = new Set<string>();
  const affectedUserIds = new Set<string>();
  const affectedMembershipPairs = new Set<string>();

  for (const membership of args.memberships) {
    if (membership.source !== HIERARCHY_DERIVED_MEMBERSHIP_SOURCE) {
      continue;
    }

    const key = pairKey(membership.group_id, membership.user_id);
    if (desiredPlans.has(key)) {
      continue;
    }

    await tx.mutate.group_membership.delete({ id: membership.id });
    nextMembershipsById.delete(membership.id);
    affectedGroupIds.add(membership.group_id);
    affectedUserIds.add(membership.user_id);
    affectedMembershipPairs.add(key);
  }

  for (const [key, plan] of desiredPlans) {
    const primaryOrigin = plan.origins[0];
    if (!primaryOrigin) {
      continue;
    }

    const existingMembership = membershipsByGroupAndUser.get(key);
    const basePatch = {
      status: 'active',
      visibility: 'public',
      source: HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
      source_group_id: primaryOrigin.baseGroupId,
      origin_kind: 'hierarchy',
      connection_id: primaryOrigin.connectionId,
      membership_rule_id: null,
      part_group_id: primaryOrigin.partGroupId,
      base_group_id: primaryOrigin.baseGroupId,
      is_auto_managed: true,
    };

    if (existingMembership) {
      const patch: Record<string, unknown> = { id: existingMembership.id };
      for (const [field, value] of Object.entries(basePatch)) {
        if (existingMembership[field] !== value) {
          patch[field] = value;
        }
      }

      if (Object.keys(patch).length > 1) {
        await tx.mutate.group_membership.update(patch);
      }

      const nextMembership = { ...existingMembership, ...basePatch };
      nextMembershipsById.set(existingMembership.id, nextMembership);
      hierarchyOriginsByMembershipId.set(existingMembership.id, plan.origins);
      await ensureMemberRoleLink(tx, {
        membershipId: existingMembership.id,
        groupId: plan.groupId,
        roles: args.roles,
        membershipRoles: args.membershipRoles,
        assignedById: args.assignedById,
      });
    } else {
      const membershipId = crypto.randomUUID();
      const now = Date.now();
      const insertedMembership = {
        id: membershipId,
        group_id: plan.groupId,
        user_id: plan.userId,
        ...basePatch,
        created_at: now,
      };

      await tx.mutate.group_membership.insert(insertedMembership);
      membershipsByGroupAndUser.set(key, insertedMembership);
      nextMembershipsById.set(membershipId, insertedMembership);
      hierarchyOriginsByMembershipId.set(membershipId, plan.origins);
      await ensureMemberRoleLink(tx, {
        membershipId,
        groupId: plan.groupId,
        roles: args.roles,
        membershipRoles: args.membershipRoles,
        assignedById: args.assignedById,
      });
    }

    affectedGroupIds.add(plan.groupId);
    affectedUserIds.add(plan.userId);
    affectedMembershipPairs.add(key);
  }

  return {
    memberships: [...nextMembershipsById.values()],
    hierarchyOriginsByMembershipId,
    affectedGroupIds,
    affectedUserIds,
    affectedMembershipPairs,
  };
}

async function reconcileMembershipProjection(
  tx: ReconcileTx,
  args: {
    memberships: readonly any[];
    hierarchyPaths: readonly any[];
    rules: readonly any[];
    hierarchyOriginsByMembershipId?: ReadonlyMap<string, readonly HierarchyMembershipOriginPlan[]>;
  }
) {
  const activeDirectMemberships = args.memberships.filter(
    membership => membership.source === 'direct' && isActiveGroupStatus(membership.status)
  );
  const directMembershipByUserAndGroup = new Map(
    activeDirectMemberships.map(membership => [
      `${membership.user_id}:${membership.group_id}`,
      membership,
    ])
  );
  const existingOrigins = await tx.run(zql.group_membership_origin);
  await clearTable(tx, 'group_membership_origin', existingOrigins);
  const now = Date.now();

  for (const membership of args.memberships) {
    const hierarchyOrigins = args.hierarchyOriginsByMembershipId?.get(membership.id);
    const projection = resolveMembershipProjection({
      membership,
      hierarchyPaths: args.hierarchyPaths,
      directMembershipByUserAndGroup,
      rules: args.rules,
    });
    const patch: Record<string, unknown> = { id: membership.id };
    for (const key of [
      'origin_kind',
      'connection_id',
      'membership_rule_id',
      'part_group_id',
      'base_group_id',
      'is_auto_managed',
    ] as const) {
      if (membership[key] !== projection[key]) {
        patch[key] = projection[key];
      }
    }
    if (Object.keys(patch).length > 1) {
      await tx.mutate.group_membership.update(patch);
    }

    const originsToInsert =
      hierarchyOrigins && hierarchyOrigins.length > 0
        ? hierarchyOrigins.map(origin => ({
            origin_kind: 'hierarchy',
            source_group_id: origin.sourceGroupId,
            source_membership_id: origin.sourceMembershipId,
            connection_id: origin.connectionId,
            membership_rule_id: null,
            source_role_id: null,
            part_group_id: origin.partGroupId,
            base_group_id: origin.baseGroupId,
            depth: origin.depth,
            path_group_ids: origin.pathGroupIds,
          }))
        : [
            {
              origin_kind: projection.origin_kind,
              source_group_id:
                membership.source_group_id ?? projection.base_group_id ?? membership.group_id,
              source_membership_id: projection.source_membership_id,
              connection_id: projection.connection_id,
              membership_rule_id: projection.membership_rule_id,
              source_role_id: projection.source_role_id,
              part_group_id: projection.part_group_id,
              base_group_id: projection.base_group_id,
              depth: projection.depth,
              path_group_ids: projection.path_group_ids,
            },
          ];

    for (const origin of originsToInsert) {
      await tx.mutate.group_membership_origin.insert({
        id: crypto.randomUUID(),
        group_membership_id: membership.id,
        ...origin,
        created_at: now,
      });
    }
  }
}

async function reconcileMembershipLocks(
  tx: ReconcileTx,
  args: {
    memberships: readonly any[];
    hierarchyPaths: readonly any[];
  }
) {
  const [existingExclusivityLocks, existingSiblingLocks] = await Promise.all([
    tx.run(zql.group_membership_exclusivity_lock),
    tx.run(zql.group_sibling_source_lock),
  ]);
  await clearTable(tx, 'group_membership_exclusivity_lock', existingExclusivityLocks);
  await clearTable(tx, 'group_sibling_source_lock', existingSiblingLocks);
  const now = Date.now();
  const exclusivityKeys = new Set<string>();
  const siblingKeys = new Set<string>();

  for (const membership of args.memberships) {
    if (!isActiveGroupStatus(membership.status)) {
      continue;
    }

    const baseGroupId =
      membership.base_group_id ?? membership.source_group_id ?? membership.group_id;
    for (const path of args.hierarchyPaths) {
      if (path.base_group_id !== baseGroupId) {
        continue;
      }
      const key = `${membership.user_id}:${path.ancestor_group_id}`;
      if (exclusivityKeys.has(key)) {
        continue;
      }
      exclusivityKeys.add(key);
      await tx.mutate.group_membership_exclusivity_lock.insert({
        id: crypto.randomUUID(),
        user_id: membership.user_id,
        hierarchy_group_id: path.ancestor_group_id,
        source_group_id: baseGroupId,
        group_membership_id: membership.id,
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    }

    if (SIBLING_SOURCE_TO_ORIGIN_KIND.has(membership.source) && membership.source_group_id) {
      const key = `${membership.user_id}:${membership.group_id}`;
      if (!siblingKeys.has(key)) {
        siblingKeys.add(key);
        await tx.mutate.group_sibling_source_lock.insert({
          id: crypto.randomUUID(),
          user_id: membership.user_id,
          sibling_group_id: membership.group_id,
          source_group_id: membership.source_group_id,
          group_membership_id: membership.id,
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      }
    }
  }
}

async function reconcileEventProjections(
  tx: ReconcileTx,
  args: {
    events: readonly any[];
    hierarchyPaths: readonly any[];
    delegateAllocations: readonly any[];
    existingScopes: readonly any[];
    existingAssignments: readonly any[];
  }
) {
  const now = Date.now();
  const activeScopesByEventId = new Map<string, any[]>();
  for (const scope of args.existingScopes) {
    if (scope.status !== 'active') {
      continue;
    }
    const entries = activeScopesByEventId.get(scope.event_id) ?? [];
    entries.push(scope);
    activeScopesByEventId.set(scope.event_id, entries);
  }

  for (const event of args.events) {
    if (!event.group_id || activeScopesByEventId.has(event.id)) {
      continue;
    }

    const sourceGroupIds =
      uniqueStrings(
        args.hierarchyPaths
          .filter(path => path.ancestor_group_id === event.group_id)
          .map(path => path.base_group_id)
      ) || [];
    const scopedSourceGroupIds = sourceGroupIds.length > 0 ? sourceGroupIds : [event.group_id];
    const isDelegateAssembly = event.event_type === 'delegate_assembly';

    for (const sourceGroupId of scopedSourceGroupIds) {
      await tx.mutate.event_assembly_scope.insert({
        id: crypto.randomUUID(),
        event_id: event.id,
        host_group_id: event.group_id,
        source_group_id: sourceGroupId,
        scope_kind: isDelegateAssembly ? 'delegate_source' : 'general_member_source',
        participant_mode: isDelegateAssembly ? 'delegates' : 'all_members',
        required_role_id: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    }
  }

  const assignmentsByTargetAndSource = new Map(
    args.existingAssignments.map(assignment => [
      `${assignment.target_event_id}:${assignment.source_group_id}`,
      assignment,
    ])
  );

  for (const allocation of args.delegateAllocations) {
    const event = args.events.find(candidate => candidate.id === allocation.event_id);
    if (!event || event.event_type !== 'delegate_assembly' || !allocation.group_id) {
      continue;
    }
    const key = `${allocation.event_id}:${allocation.group_id}`;
    const existing = assignmentsByTargetAndSource.get(key);
    const patch = {
      target_event_id: allocation.event_id,
      source_group_id: allocation.group_id,
      allocation_id: allocation.id,
      required_seats: allocation.allocated_seats ?? 0,
      confirmed_seats: allocation.confirmed_delegate_count ?? 0,
      linked_event_id: existing?.linked_event_id ?? null,
      status: existing?.status ?? 'open',
      updated_at: now,
    };

    if (existing) {
      await tx.mutate.delegate_election_assignment.update({ id: existing.id, ...patch });
    } else {
      await tx.mutate.delegate_election_assignment.insert({
        id: crypto.randomUUID(),
        ...patch,
        created_at: now,
      });
    }
  }
}

export async function reconcileGroupGraph(tx: ReconcileTx, changeSet: GroupGraphChangeSet = {}) {
  const [
    groups,
    connections,
    grants,
    membershipRules,
    memberships,
    events,
    delegateAllocations,
    existingScopes,
    existingAssignments,
    roles,
    membershipRoles,
  ] = await Promise.all([
    tx.run(zql.group),
    tx.run(zql.group_connection),
    tx.run(zql.group_right_grant),
    tx.run(zql.group_membership_rule),
    tx.run(zql.group_membership),
    tx.run(zql.event),
    tx.run(zql.group_delegate_allocation),
    tx.run(zql.event_assembly_scope),
    tx.run(zql.delegate_election_assignment),
    tx.run(zql.role),
    tx.run(zql.group_membership_role),
  ]);
  const groupsById = new Map<string, any>(groups.map((group: any) => [group.id, group]));
  const hierarchyPaths = buildHierarchyPaths(connections);

  await reconcileConnections(tx, connections, groupsById);
  await reconcileGroupMeta(tx, {
    groups,
    connections,
    rules: membershipRules,
  });
  await reconcileHierarchyPaths(tx, hierarchyPaths);
  await reconcileEffectiveRights(tx, grants);
  const hierarchyMembershipResult = await reconcileHierarchyMembershipRows(tx, {
    memberships,
    hierarchyPaths,
    roles,
    membershipRoles,
    assignedById: changeSet.assignedById,
  });
  await reconcileMembershipProjection(tx, {
    memberships: hierarchyMembershipResult.memberships,
    hierarchyPaths,
    rules: membershipRules,
    hierarchyOriginsByMembershipId: hierarchyMembershipResult.hierarchyOriginsByMembershipId,
  });
  await reconcileMembershipLocks(tx, {
    memberships: hierarchyMembershipResult.memberships,
    hierarchyPaths,
  });
  await reconcileEventProjections(tx, {
    events,
    hierarchyPaths,
    delegateAllocations,
    existingScopes,
    existingAssignments,
  });

  return {
    affectedGroupIds: hierarchyMembershipResult.affectedGroupIds,
    affectedUserIds: hierarchyMembershipResult.affectedUserIds,
    affectedMembershipPairs: hierarchyMembershipResult.affectedMembershipPairs,
  };
}
