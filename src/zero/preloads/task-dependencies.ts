import { queries } from '@/zero/queries';
import type { PreloadTask } from './preload-coordinator';
import { createPreloadEntry } from './preload-registry';

export interface RunnablePreloadZero {
  run: (
    query: unknown,
    options: { type: 'unknown' | 'complete'; ttl?: 'none' }
  ) => Promise<unknown>;
}

function firstRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const row = value[0];
    return row && typeof row === 'object' ? (row as Record<string, unknown>) : undefined;
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

export function withWikiTaskDependencies(
  task: PreloadTask,
  zero: RunnablePreloadZero,
  viewerId?: string
): PreloadTask {
  const match = task.key.match(/^group:([^:]+):overview$/);
  if (!match || !viewerId) return task;
  const groupId = match[1];
  const existingResolver = task.resolveAfterComplete;

  return {
    ...task,
    resolveAfterComplete: async () => {
      const existingEntries = existingResolver ? await existingResolver() : [];
      const group = firstRow(
        await zero.run(queries.groups.byId({ id: groupId }), {
          type: 'unknown',
          ttl: 'none',
        })
      );
      const connectedGroupId = group?.connected_group_id;
      if (typeof connectedGroupId !== 'string' || !connectedGroupId) return existingEntries;

      return [
        ...existingEntries,
        createPreloadEntry(
          'queries.groups.userMembershipInGroup',
          { userId: viewerId, groupId: connectedGroupId },
          queries.groups.userMembershipInGroup({ userId: viewerId, groupId: connectedGroupId })
        ),
        createPreloadEntry(
          'queries.groups.allMembershipsInGroupWithRole',
          { groupId: connectedGroupId },
          queries.groups.allMembershipsInGroupWithRole({ groupId: connectedGroupId })
        ),
      ];
    },
  };
}
