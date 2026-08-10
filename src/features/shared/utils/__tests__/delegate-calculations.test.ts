import { describe, expect, it } from 'vitest';

import {
  calculateDelegateAllocations,
  calculateTotalDelegates,
  finalizeDelegateSelection,
  getDirectSubgroups,
  getLeafSubgroups,
  isEligibleForDelegateAssembly,
} from '../delegate-calculations';

const relationships = [
  {
    id: 'root-branch',
    parentGroup: { id: 'root' },
    childGroup: { id: 'branch', name: 'Branch', memberCount: 10 },
  },
  {
    id: 'root-leaf',
    parentGroup: { id: 'root' },
    childGroup: { id: 'leaf-a', name: 'Leaf A', memberCount: 5 },
  },
  {
    id: 'branch-leaf',
    parentGroup: { id: 'branch' },
    childGroup: { id: 'leaf-b', name: 'Leaf B', memberCount: 7 },
  },
];

describe('delegate calculations', () => {
  it('ignores empty groups and handles an empty allocation', () => {
    expect(
      calculateDelegateAllocations(
        [
          { id: 'zero', memberCount: 0 },
          { id: 'negative', memberCount: -1 },
        ],
        3
      )
    ).toEqual([]);
  });

  it('uses largest remainders and preserves input order', () => {
    expect(
      calculateDelegateAllocations(
        [
          { id: 'large', memberCount: 5 },
          { id: 'small', memberCount: 3 },
          { id: 'ignored', memberCount: 0 },
          { id: 'medium', memberCount: 4 },
        ],
        5
      )
    ).toEqual([
      { groupId: 'large', memberCount: 5, allocatedDelegates: 2 },
      { groupId: 'small', memberCount: 3, allocatedDelegates: 1 },
      { groupId: 'medium', memberCount: 4, allocatedDelegates: 2 },
    ]);

    expect(calculateDelegateAllocations([{ id: 'only', memberCount: 2 }], 0)).toEqual([
      { groupId: 'only', memberCount: 2, allocatedDelegates: 0 },
    ]);
  });

  it('finds direct children and leaf descendants', () => {
    expect(getDirectSubgroups('missing', relationships)).toEqual([]);
    expect(getDirectSubgroups('root', relationships)).toEqual([
      { id: 'branch', name: 'Branch', memberCount: 10, allocatedDelegates: 0 },
      { id: 'leaf-a', name: 'Leaf A', memberCount: 5, allocatedDelegates: 0 },
    ]);
    expect(getLeafSubgroups('root', relationships)).toEqual([
      { id: 'leaf-b', name: 'Leaf B', memberCount: 7, allocatedDelegates: 0 },
      { id: 'leaf-a', name: 'Leaf A', memberCount: 5, allocatedDelegates: 0 },
    ]);
  });

  it('confirms nominated delegates by priority and puts the remainder on standby', () => {
    expect(
      finalizeDelegateSelection(
        [
          { id: 'late', groupId: 'a', userId: 'u2', priority: 2, status: 'nominated' },
          { id: 'early', groupId: 'a', userId: 'u1', priority: 1, status: 'nominated' },
          { id: 'other', groupId: 'b', userId: 'u3', priority: 1, status: 'nominated' },
          { id: 'done', groupId: 'a', userId: 'u4', priority: 0, status: 'confirmed' },
        ],
        [
          { groupId: 'a', allocatedDelegates: 1, memberCount: 2 },
          { groupId: 'empty', allocatedDelegates: 1, memberCount: 0 },
        ]
      )
    ).toEqual([
      { id: 'early', status: 'confirmed' },
      { id: 'late', status: 'standby' },
    ]);
  });

  it('calculates delegate totals and assembly eligibility', () => {
    expect(calculateTotalDelegates(0)).toBe(0);
    expect(calculateTotalDelegates(20)).toBe(1);
    expect(calculateTotalDelegates(120, 40)).toBe(3);
    expect(isEligibleForDelegateAssembly('root', relationships)).toBe(true);
    expect(isEligibleForDelegateAssembly('missing', relationships)).toBe(false);
  });
});
