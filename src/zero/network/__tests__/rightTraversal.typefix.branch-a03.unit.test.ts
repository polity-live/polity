import { describe, expect, it } from 'vitest';

import { findReachableGroupsByRight, findRightPaths } from '../rightTraversal';

function withFirstQueueReadEmpty<T>(operation: () => T) {
  const originalShift = Array.prototype.shift;
  let intercepted = false;

  Array.prototype.shift = function <T>(this: T[]) {
    const value = originalShift.call(this) as T | undefined;
    if (
      !intercepted &&
      value &&
      typeof value === 'object' &&
      'groupPath' in value &&
      'grantIds' in value
    ) {
      intercepted = true;
      return undefined;
    }
    return value;
  };

  try {
    return operation();
  } finally {
    Array.prototype.shift = originalShift;
  }
}

describe('right traversal typefix guards', () => {
  it('tolerates a consumed reachable-groups queue entry', () => {
    expect(
      withFirstQueueReadEmpty(() =>
        findReachableGroupsByRight({
          startGroupId: 'group-1',
          rightKey: 'amendmentRight',
          grants: [],
        })
      )
    ).toEqual([]);
  });

  it('tolerates a consumed right-path queue entry', () => {
    expect(
      withFirstQueueReadEmpty(() =>
        findRightPaths({
          startGroupId: 'group-1',
          targetGroupId: 'group-2',
          rightKey: 'amendmentRight',
          grants: [],
        })
      )
    ).toEqual([]);
  });
});
