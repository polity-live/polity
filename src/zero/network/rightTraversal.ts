import type { GroupRightKey } from './request-types';
import { isActiveNetworkStatus, type GroupRightGrantRowLike } from './derived';

export interface ReachableRightPath {
  targetGroupId: string;
  depth: number;
  groupPath: string[];
  grantIds: string[];
}

export function findReachableGroupsByRight(args: {
  startGroupId: string;
  rightKey: GroupRightKey;
  grants: readonly GroupRightGrantRowLike[];
  maxDepth?: number;
}): ReachableRightPath[] {
  const maxDepth = Math.max(1, args.maxDepth ?? args.grants.length + 1);
  const activeGrantsByHolder = new Map<string, GroupRightGrantRowLike[]>();

  for (const grant of args.grants) {
    if (grant.right_key !== args.rightKey || !isActiveNetworkStatus(grant.status)) {
      continue;
    }
    const holderGrants = activeGrantsByHolder.get(grant.holder_group_id) ?? [];
    holderGrants.push(grant);
    activeGrantsByHolder.set(grant.holder_group_id, holderGrants);
  }

  const queue: { groupPath: string[]; grantIds: string[] }[] = [
    { groupPath: [args.startGroupId], grantIds: [] },
  ];
  const bestByTarget = new Map<string, ReachableRightPath>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const holderGroupId = current.groupPath[current.groupPath.length - 1];
    if (!holderGroupId || current.grantIds.length >= maxDepth) {
      continue;
    }

    for (const grant of activeGrantsByHolder.get(holderGroupId) ?? []) {
      if (current.groupPath.includes(grant.scope_group_id)) {
        continue;
      }

      const groupPath = [...current.groupPath, grant.scope_group_id];
      const grantIds = [...current.grantIds, grant.id];
      const candidate: ReachableRightPath = {
        targetGroupId: grant.scope_group_id,
        depth: grantIds.length,
        groupPath,
        grantIds,
      };
      const existing = bestByTarget.get(candidate.targetGroupId);
      // Breadth-first traversal discovers candidates in nondecreasing depth order.
      // Only an equally short, lexicographically smaller path can improve an existing entry.
      if (
        !existing ||
        (candidate.depth === existing.depth &&
          candidate.groupPath.join('>') < existing.groupPath.join('>'))
      ) {
        bestByTarget.set(candidate.targetGroupId, candidate);
      }
      queue.push({ groupPath, grantIds });
    }
  }

  return [...bestByTarget.values()].sort(
    (left, right) =>
      left.depth - right.depth || left.targetGroupId.localeCompare(right.targetGroupId)
  );
}

export function findRightPaths(args: {
  startGroupId: string;
  targetGroupId: string;
  rightKey: GroupRightKey;
  grants: readonly GroupRightGrantRowLike[];
  maxPaths?: number;
  maxDepth?: number;
}) {
  const maxPaths = Math.max(1, args.maxPaths ?? 8);
  const maxDepth = Math.max(1, args.maxDepth ?? args.grants.length + 1);
  const activeGrantsByHolder = new Map<string, GroupRightGrantRowLike[]>();

  for (const grant of args.grants) {
    if (grant.right_key !== args.rightKey || !isActiveNetworkStatus(grant.status)) {
      continue;
    }
    const holderGrants = activeGrantsByHolder.get(grant.holder_group_id) ?? [];
    holderGrants.push(grant);
    activeGrantsByHolder.set(grant.holder_group_id, holderGrants);
  }

  const queue: { groupPath: string[]; grantIds: string[] }[] = [
    { groupPath: [args.startGroupId], grantIds: [] },
  ];
  const results: ReachableRightPath[] = [];

  while (queue.length > 0 && results.length < maxPaths) {
    const current = queue.shift();
    if (!current) continue;
    const holderGroupId = current.groupPath[current.groupPath.length - 1];
    if (!holderGroupId || current.grantIds.length >= maxDepth) {
      continue;
    }

    for (const grant of activeGrantsByHolder.get(holderGroupId) ?? []) {
      if (current.groupPath.includes(grant.scope_group_id)) {
        continue;
      }
      const groupPath = [...current.groupPath, grant.scope_group_id];
      const grantIds = [...current.grantIds, grant.id];
      if (grant.scope_group_id === args.targetGroupId) {
        results.push({
          targetGroupId: grant.scope_group_id,
          depth: grantIds.length,
          groupPath,
          grantIds,
        });
        if (results.length >= maxPaths) {
          break;
        }
      } else {
        queue.push({ groupPath, grantIds });
      }
    }
  }

  return results;
}
