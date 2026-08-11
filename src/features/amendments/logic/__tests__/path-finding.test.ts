import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  findAllPaths,
  findShortestPath,
  pathToStorageFormat,
  type GroupNode,
  type GroupRelationship,
} from '../path-finding';

const group = (id: string): GroupNode => ({ id, name: `Group ${id}` });
const groups = new Map(['a', 'b', 'c', 'd', 'e'].map(id => [id, group(id)]));
const getGroup = (id: string) => {
  const value = groups.get(id);
  if (!value) throw new Error(`Missing test group ${id}`);
  return value;
};
const relationship = (
  id: string,
  parentId: string,
  childId: string,
  right = 'submit'
): GroupRelationship => ({
  id,
  parentGroup: getGroup(parentId),
  childGroup: getGroup(childId),
  withRight: right,
});

const network = [
  relationship('ab', 'b', 'a', 'up'),
  relationship('bc', 'b', 'c', 'down'),
  relationship('ad', 'a', 'd', 'branch'),
  relationship('dc', 'd', 'c', 'merge'),
  relationship('ce', 'c', 'e', 'leaf'),
];

describe('path-finding', () => {
  afterEach(() => vi.useRealTimers());

  it('finds the shortest bidirectional network path with relationship metadata', () => {
    const path = findShortestPath(['missing', 'a'], 'c', network, groups);

    expect(path?.map(segment => segment.group.id)).toEqual(['a', 'b', 'c']);
    expect(path?.map(segment => segment.distance)).toEqual([0, 1, 2]);
    expect(path?.map(segment => segment.relationship)).toEqual([
      { type: 'member' },
      { type: 'parent', right: 'up' },
      { type: 'child', right: 'down' },
    ]);
  });

  it('returns the member segment when the direct group is already the target', () => {
    expect(findShortestPath(['a'], 'a', network, groups)).toEqual([
      { group: groups.get('a'), relationship: { type: 'member' }, distance: 0 },
    ]);
  });

  it('returns null for absent starts, disconnected targets and missing mapped neighbours', () => {
    expect(findShortestPath(['missing'], 'a', network, groups)).toBeNull();
    expect(findShortestPath(['a'], 'unknown', network, groups)).toBeNull();

    const incompleteGroups = new Map(groups);
    incompleteGroups.delete('b');
    incompleteGroups.delete('d');
    expect(findShortestPath(['a'], 'c', network, incompleteGroups)).toBeNull();
  });

  it('enumerates simple alternatives shortest-first without revisiting cycles', () => {
    const paths = findAllPaths(['missing', 'a'], 'c', network, groups);
    expect(paths.map(path => path.map(segment => segment.group.id))).toEqual([
      ['a', 'b', 'c'],
      ['a', 'd', 'c'],
    ]);
    expect(paths[1]?.[1]).toMatchObject({
      group: groups.get('d'),
      relationship: { type: 'child', right: 'branch' },
      distance: 1,
    });
  });

  it('honours max depth and skips neighbours absent from the map', () => {
    expect(findAllPaths(['a'], 'c', network, groups, 2)).toEqual([]);
    const incompleteGroups = new Map(groups);
    incompleteGroups.delete('b');
    incompleteGroups.delete('d');
    expect(findAllPaths(['a'], 'c', network, incompleteGroups)).toEqual([]);
  });

  it('maps each group to its nearest future event without mutating source order', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00.000Z'));
    const path = findShortestPath(['a'], 'c', network, groups);
    if (!path) throw new Error('Expected a path for the test network');
    const events = [
      {
        id: 'late',
        title: 'Late',
        startDate: '2026-08-03T10:00:00.000Z',
        group: { id: 'a' },
      },
      {
        id: 'past',
        title: 'Past',
        startDate: '2026-07-31T10:00:00.000Z',
        group: { id: 'a' },
      },
      {
        id: 'near',
        title: 'Near',
        startDate: '2026-08-02T10:00:00.000Z',
        group: { id: 'a' },
      },
      { id: 'unrelated', title: 'Other', startDate: 1_786_356_000_000, group: { id: 'e' } },
    ];

    expect(pathToStorageFormat(path, events)).toEqual([
      { groupId: 'a', groupName: 'Group a', eventId: 'near', eventTitle: 'Near' },
      { groupId: 'b', groupName: 'Group b', eventId: undefined, eventTitle: undefined },
      { groupId: 'c', groupName: 'Group c', eventId: undefined, eventTitle: undefined },
    ]);
    expect(events.map(event => event.id)).toEqual(['late', 'past', 'near', 'unrelated']);
    expect(pathToStorageFormat(path)).toHaveLength(3);
  });
});
