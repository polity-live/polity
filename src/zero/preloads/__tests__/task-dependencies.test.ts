import { describe, expect, it, vi } from 'vitest';
import { createGroupPreloadTasks } from '../route-manifests';
import { withWikiTaskDependencies } from '../task-dependencies';

describe('wiki preload dependencies', () => {
  it('loads membership queries for a connected group in the second phase', async () => {
    const run = vi.fn().mockResolvedValue({ connected_group_id: 'group-2' });
    const baseTask = createGroupPreloadTasks('group-1', 'viewer-1')[0];
    const task = withWikiTaskDependencies(baseTask, { run }, 'viewer-1');

    const entries = await task.resolveAfterComplete?.();

    expect(run).toHaveBeenCalledOnce();
    expect(entries?.map(entry => entry.key).join('|')).toContain(
      'queries.groups.userMembershipInGroup'
    );
    expect(entries?.map(entry => entry.key).join('|')).toContain('"groupId":"group-2"');
  });

  it('does not add a second phase when the group has no connected group', async () => {
    const task = withWikiTaskDependencies(
      createGroupPreloadTasks('group-1', 'viewer-1')[0],
      { run: vi.fn().mockResolvedValue({ connected_group_id: null }) },
      'viewer-1'
    );

    await expect(task.resolveAfterComplete?.()).resolves.toEqual([]);
  });
});
