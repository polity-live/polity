import type { GroupConnectionRowLike } from './derived';

export interface GroupConnectionShape {
  id: string;
  group_a_id: string;
  group_b_id: string;
  connection_type: 'hierarchy' | 'peer';
  parent_group_id: string | null;
  child_group_id: string | null;
}

export function canonicalGroupPair(firstGroupId: string, secondGroupId: string) {
  if (firstGroupId === secondGroupId) {
    throw new Error('A group cannot be connected to itself.');
  }
  return firstGroupId < secondGroupId
    ? { group_a_id: firstGroupId, group_b_id: secondGroupId }
    : { group_a_id: secondGroupId, group_b_id: firstGroupId };
}

export function assertConnectionEndpoints(args: {
  connection: GroupConnectionShape;
  grants?: readonly { holder_group_id: string; scope_group_id: string }[];
  membershipRule?: {
    member_source_group_id: string;
    member_target_group_id: string;
    membership_mode: string;
    required_source_role_id?: string | null;
    eligible_origin_group_ids?: readonly string[];
  } | null;
}) {
  const { connection } = args;
  const pair = canonicalGroupPair(connection.group_a_id, connection.group_b_id);
  if (pair.group_a_id !== connection.group_a_id || pair.group_b_id !== connection.group_b_id) {
    throw new Error('Group connection endpoints must use canonical group_a/group_b ordering.');
  }
  const endpointSet = new Set([connection.group_a_id, connection.group_b_id]);

  if (connection.connection_type === 'hierarchy') {
    if (
      !connection.parent_group_id ||
      !connection.child_group_id ||
      !endpointSet.has(connection.parent_group_id) ||
      !endpointSet.has(connection.child_group_id) ||
      connection.parent_group_id === connection.child_group_id
    ) {
      throw new Error('Hierarchy connections require explicit parent and child endpoints.');
    }
  } else if (connection.parent_group_id || connection.child_group_id) {
    throw new Error('Peer connections cannot contain parent or child endpoints.');
  }

  for (const grant of args.grants ?? []) {
    if (
      grant.holder_group_id === grant.scope_group_id ||
      !endpointSet.has(grant.holder_group_id) ||
      !endpointSet.has(grant.scope_group_id)
    ) {
      throw new Error('Every right grant must connect the two groups in its connection.');
    }
  }

  const rule = args.membershipRule;
  if (rule) {
    if (
      rule.member_source_group_id === rule.member_target_group_id ||
      !endpointSet.has(rule.member_source_group_id) ||
      !endpointSet.has(rule.member_target_group_id)
    ) {
      throw new Error('Membership source and target must be the connection endpoints.');
    }
    if (rule.membership_mode === 'role_members' && !rule.required_source_role_id) {
      throw new Error('Role-member rules require a source-group role.');
    }
    if (
      rule.membership_mode === 'selected_source_groups' &&
      !rule.eligible_origin_group_ids?.length
    ) {
      throw new Error('Selected-source rules require at least one eligible origin group.');
    }
  }
}

export function assertHierarchyGraphIsUnambiguous(connections: readonly GroupConnectionRowLike[]) {
  const hierarchy = connections.filter(
    connection =>
      connection.connection_type === 'hierarchy' &&
      connection.parent_group_id &&
      connection.child_group_id &&
      connection.status === 'active'
  );
  const parentIdsByChildId = new Map<string, string[]>();
  for (const connection of hierarchy) {
    const child = connection.child_group_id as string;
    const parents = parentIdsByChildId.get(child) ?? [];
    parents.push(connection.parent_group_id as string);
    parentIdsByChildId.set(child, parents);
  }

  const allNodes = new Set(
    hierarchy.flatMap(connection => [
      connection.parent_group_id as string,
      connection.child_group_id as string,
    ])
  );

  for (const start of allNodes) {
    const pathCounts = new Map<string, number>();
    const walk = (current: string, path: Set<string>) => {
      for (const parent of parentIdsByChildId.get(current) ?? []) {
        if (path.has(parent)) {
          throw new Error('Hierarchy connections must not create a cycle.');
        }
        const count = (pathCounts.get(parent) ?? 0) + 1;
        pathCounts.set(parent, count);
        if (count > 1) {
          throw new Error('Hierarchy connections must not create duplicate ancestor paths.');
        }
        walk(parent, new Set([...path, parent]));
      }
    };
    walk(start, new Set([start]));
  }
}
