import { describe, expect, it } from 'vitest';

import { getGroupTypeFlags } from '../groupTypeFlags';

describe('getGroupTypeFlags', () => {
  it('defaults missing groups to an unconnected base group', () => {
    expect(getGroupTypeFlags(undefined)).toEqual({
      isBase: true,
      isHierarchical: false,
      isSibling: false,
      isMixed: false,
    });
  });

  it('derives hierarchy and sibling flags from connection metadata', () => {
    expect(
      getGroupTypeFlags({
        group_type: 'base',
        has_hierarchy_children: true,
        has_sibling_connections: true,
      })
    ).toEqual({
      isBase: false,
      isHierarchical: true,
      isSibling: true,
      isMixed: true,
    });
  });

  it('recognizes explicit hierarchy and sibling group types', () => {
    expect(getGroupTypeFlags({ group_type: 'hierarchical' }).isHierarchical).toBe(true);
    expect(getGroupTypeFlags({ group_type: 'sibling' }).isSibling).toBe(true);
  });
});
