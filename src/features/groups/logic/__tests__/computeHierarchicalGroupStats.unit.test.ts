import { describe, expect, it } from 'vitest';

import { computeHierarchicalGroupStats } from '../computeHierarchicalGroupStats';

const pvr = ['passive_voting_right'];

describe('computeHierarchicalGroupStats', () => {
  it('collects direct and nested children in both materialized directions', () => {
    const result = computeHierarchicalGroupStats(
      'root',
      [
        { group_id: 'root', related_group_id: 'a', direction: 'parent_to_child', rights: pvr },
        {
          group_id: 'b',
          related_group_id: 'root',
          direction: 'child_to_parent',
          rights: 'member,passive_voting_right',
        },
        { group_id: 'a', related_group_id: 'nested', direction: 'parent_to_child', rights: pvr },
        { group_id: 'b', related_group_id: 'nested', direction: 'parent_to_child', rights: pvr },
        { group_id: 'nested-2', related_group_id: 'b', direction: 'child_to_parent', rights: pvr },
        { group_id: 'nested', related_group_id: 'root', direction: 'parent_to_child', rights: pvr },
        { group_id: 'root', related_group_id: 'nested', direction: 'child_to_parent', rights: pvr },
        {
          group_id: 'a',
          related_group_id: 'ignored',
          direction: 'parent_to_child',
          rights: ['member'],
        },
        { group_id: 'root', related_group_id: 'ignored-2', direction: 'other', rights: pvr },
        { group_id: 'ignored-3', related_group_id: 'root', direction: 'other', rights: pvr },
        {
          group_id: 'root',
          related_group_id: 'ignored-4',
          direction: 'parent_to_child',
          rights: null,
        },
      ],
      [
        { id: 'a', name: 'Alpha', member_count: 4 },
        { id: 'b', name: null, member_count: null },
        { id: 'nested', name: 'Nested', member_count: 2 },
        { id: 'nested-2', name: 'Nested 2', member_count: 3 },
      ]
    );

    expect(result).toEqual({
      totalMembers: 4,
      directSubgroupCount: 2,
      totalSubgroupCount: 4,
      memberDistribution: [
        { id: 'a', name: 'Alpha', memberCount: 4 },
        { id: 'b', name: 'Unknown', memberCount: 0 },
      ],
    });
  });

  it('uses unknown defaults when a direct child is absent from the group lookup', () => {
    expect(
      computeHierarchicalGroupStats(
        'root',
        [
          {
            group_id: 'root',
            related_group_id: 'missing',
            direction: 'parent_to_child',
            rights: 'passive_voting_right',
          },
        ],
        []
      )
    ).toMatchObject({
      totalMembers: 0,
      memberDistribution: [{ id: 'missing', name: 'Unknown', memberCount: 0 }],
    });
  });
});
