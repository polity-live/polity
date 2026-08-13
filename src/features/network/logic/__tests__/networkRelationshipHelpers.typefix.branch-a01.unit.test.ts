import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedGroupRelationship } from '../../types/network.types';
import {
  buildIndirectRelationships,
  buildMixedRelationshipGraph,
} from '../networkRelationshipHelpers';

const group = (id: string) => ({ id, name: id });

function hierarchyRelationship(
  id: string,
  parentGroupId: string,
  childGroupId: string
): NormalizedGroupRelationship {
  return {
    id,
    connection_id: `connection:${id}`,
    grant_id: `grant:${id}`,
    membership_request_id: null,
    request_item_kind: 'right',
    group_id: parentGroupId,
    related_group_id: childGroupId,
    relationship_type: 'child',
    connection_type: 'hierarchy',
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    with_right: 'informationRight',
    status: 'active',
    initiator_group_id: parentGroupId,
    created_at: 0,
    member_source_group_id: null,
    member_target_group_id: null,
    membership_mode: 'none',
    required_source_role_id: null,
    eligible_origin_group_ids: [],
    group: group(parentGroupId),
    related_group: group(childGroupId),
  } as NormalizedGroupRelationship;
}

function siblingRelationship(
  id: string,
  firstGroupId: string,
  secondGroupId: string
): NormalizedGroupRelationship {
  return {
    ...hierarchyRelationship(id, firstGroupId, secondGroupId),
    relationship_type: 'sibling',
    connection_type: 'peer',
    parent_group_id: null,
    child_group_id: null,
  };
}

describe('network relationship defensive collection guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a sibling placement whose root anchor is empty', () => {
    expect(() =>
      buildMixedRelationshipGraph([siblingRelationship('empty-anchor', '', 'sibling')], '')
    ).toThrow('Sibling traversal placement requires an anchor and non-root branch.');
  });

  it('stops indirect traversal safely if a just-created parent or child entry is unavailable', () => {
    const nativeGet = Map.prototype.get;
    vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown
    ) {
      const value = Reflect.apply(nativeGet, this, [key]) as unknown;
      if (key === 'grandparent-entry' || key === 'grandchild-entry') {
        return undefined;
      }
      return value;
    } as typeof Map.prototype.get);

    const result = buildIndirectRelationships(
      [
        hierarchyRelationship('direct-parent', 'parent-entry', 'root'),
        hierarchyRelationship('indirect-parent', 'grandparent-entry', 'parent-entry'),
        hierarchyRelationship('direct-child', 'root', 'child-entry'),
        hierarchyRelationship('indirect-child', 'child-entry', 'grandchild-entry'),
      ],
      'root'
    );

    expect(result.parents.map(entry => entry.group.id)).toContain('grandparent-entry');
    expect(result.children.map(entry => entry.group.id)).toContain('grandchild-entry');
  });

  it('skips duplicate placement merging if its hierarchy or sibling entry disappears', () => {
    const nativeGet = Map.prototype.get;
    vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown
    ) {
      const value = Reflect.apply(nativeGet, this, [key]) as unknown;
      const isTarget = key === 'merge-parent-entry' || key === 'merge-sibling-entry';
      const isRelationshipEntry = typeof value === 'object' && value !== null && 'group' in value;
      return isTarget && isRelationshipEntry ? undefined : value;
    } as typeof Map.prototype.get);

    const parent = hierarchyRelationship('parent', 'merge-parent-entry', 'root');
    const sibling = siblingRelationship('sibling', 'root', 'merge-sibling-entry');
    const graph = buildMixedRelationshipGraph(
      [
        parent,
        { ...parent, id: 'parent-duplicate' },
        sibling,
        { ...sibling, id: 'sibling-duplicate' },
      ],
      'root'
    );

    expect(graph.parents.map(entry => entry.group.id)).toEqual(['merge-parent-entry']);
    expect(graph.siblingAttachments.map(entry => entry.group.id)).toEqual(['merge-sibling-entry']);
  });

  it('ignores an empty dequeue result even while the queue previously had an item', () => {
    const nativeShift = Array.prototype.shift;
    Array.prototype.shift = function <T>(this: T[]) {
      const first = this[0] as { groupId?: string } | undefined;
      if (first?.groupId === 'empty-dequeue-root') {
        this.length = 0;
        return undefined;
      }
      return nativeShift.call(this) as T | undefined;
    };

    try {
      expect(buildMixedRelationshipGraph([], 'empty-dequeue-root')).toEqual({
        parents: [],
        children: [],
        siblingAttachments: [],
      });
    } finally {
      Array.prototype.shift = nativeShift;
    }
  });
});
