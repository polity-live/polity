import { describe, expect, it } from 'vitest';

import { detectDuplicateHierarchyPaths } from '../hierarchy';

describe('hierarchy duplicate paths', () => {
  it('detects when the same base group reaches the same target over two active paths', () => {
    const relationships = [
      {
        id: 'root-mid-a',
        group_id: 'root',
        related_group_id: 'mid-a',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-a-leaf',
        group_id: 'mid-a',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'root-mid-b',
        group_id: 'root',
        related_group_id: 'mid-b',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
      {
        id: 'mid-b-leaf',
        group_id: 'mid-b',
        related_group_id: 'leaf',
        relationship_type: null,
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: null,
        created_at: 0,
      },
    ];

    expect(detectDuplicateHierarchyPaths(relationships)).toEqual([
      {
        baseGroupId: 'leaf',
        targetGroupId: 'root',
        paths: [
          ['leaf', 'mid-a', 'root'],
          ['leaf', 'mid-b', 'root'],
        ],
      },
    ]);
  });
});
