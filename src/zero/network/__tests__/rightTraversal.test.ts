import { describe, expect, it } from 'vitest';

import { findReachableGroupsByRight, findRightPaths } from '../rightTraversal';

const grants = [
  {
    id: 'grant-b1-h1',
    connection_id: 'connection-b1-h1',
    right_key: 'amendmentRight',
    holder_group_id: 'B1',
    scope_group_id: 'H1',
    status: 'active',
  },
  {
    id: 'grant-h1-k1',
    connection_id: 'connection-h1-k1',
    right_key: 'amendmentRight',
    holder_group_id: 'H1',
    scope_group_id: 'K1',
    status: 'active',
  },
  {
    id: 'grant-k1-l1',
    connection_id: 'connection-k1-l1',
    right_key: 'amendmentRight',
    holder_group_id: 'K1',
    scope_group_id: 'L1',
    status: 'suspended',
  },
  {
    id: 'grant-h1-b1',
    connection_id: 'connection-b1-h1',
    right_key: 'informationRight',
    holder_group_id: 'H1',
    scope_group_id: 'B1',
    status: 'active',
  },
  {
    id: 'grant-k1-b1-cycle',
    connection_id: 'connection-k1-b1',
    right_key: 'amendmentRight',
    holder_group_id: 'K1',
    scope_group_id: 'B1',
    status: 'active',
  },
];

describe('right traversal', () => {
  it('walks active holder-to-scope grants of the same right', () => {
    expect(
      findReachableGroupsByRight({
        startGroupId: 'B1',
        rightKey: 'amendmentRight',
        grants,
      })
    ).toEqual([
      {
        targetGroupId: 'H1',
        depth: 1,
        groupPath: ['B1', 'H1'],
        grantIds: ['grant-b1-h1'],
      },
      {
        targetGroupId: 'K1',
        depth: 2,
        groupPath: ['B1', 'H1', 'K1'],
        grantIds: ['grant-b1-h1', 'grant-h1-k1'],
      },
    ]);
  });

  it('does not traverse the reverse direction or suspended grants', () => {
    expect(
      findReachableGroupsByRight({
        startGroupId: 'K1',
        rightKey: 'amendmentRight',
        grants,
      }).map(path => path.targetGroupId)
    ).toEqual(['B1', 'H1']);

    expect(
      findReachableGroupsByRight({
        startGroupId: 'K1',
        rightKey: 'informationRight',
        grants,
      })
    ).toEqual([]);
  });

  it('returns bounded alternative paths with grant ids', () => {
    const paths = findRightPaths({
      startGroupId: 'B1',
      targetGroupId: 'K1',
      rightKey: 'amendmentRight',
      grants: [
        ...grants,
        {
          id: 'grant-b1-x1',
          connection_id: 'connection-b1-x1',
          right_key: 'amendmentRight',
          holder_group_id: 'B1',
          scope_group_id: 'X1',
          status: 'active',
        },
        {
          id: 'grant-x1-k1',
          connection_id: 'connection-x1-k1',
          right_key: 'amendmentRight',
          holder_group_id: 'X1',
          scope_group_id: 'K1',
          status: 'active',
        },
      ],
      maxPaths: 2,
    });

    expect(paths).toEqual([
      {
        targetGroupId: 'K1',
        depth: 2,
        groupPath: ['B1', 'H1', 'K1'],
        grantIds: ['grant-b1-h1', 'grant-h1-k1'],
      },
      {
        targetGroupId: 'K1',
        depth: 2,
        groupPath: ['B1', 'X1', 'K1'],
        grantIds: ['grant-b1-x1', 'grant-x1-k1'],
      },
    ]);
  });
});
