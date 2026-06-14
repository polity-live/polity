import { describe, expect, it } from 'vitest';
import {
  deriveSupporterDirectoryItems,
  deriveSupporterMapItems,
} from '@/features/amendments/logic/supporterDirectory';

function createGroup(
  overrides?: Partial<{
    id: string;
    name: string;
    member_count: number;
    city: string;
    region: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  }>
) {
  return {
    id: overrides?.id ?? 'group-1',
    name: overrides?.name ?? 'Alpha Circle',
    member_count: overrides?.member_count ?? 12,
    city: overrides?.city ?? 'Berlin',
    region: overrides?.region ?? 'Berlin',
    country: overrides?.country ?? 'Germany',
    latitude: overrides && 'latitude' in overrides ? (overrides.latitude ?? null) : 52.52,
    longitude: overrides && 'longitude' in overrides ? (overrides.longitude ?? null) : 13.405,
  };
}

describe('deriveSupporterDirectoryItems', () => {
  it('counts accepted and supported workflow decisions as current supporters', () => {
    const items = deriveSupporterDirectoryItems({
      groupDecisions: [
        {
          group_id: 'group-b',
          status: 'accepted',
          group: createGroup({ id: 'group-b', name: 'Beta Forum' }),
        },
        {
          group_id: 'group-a',
          status: 'supported',
          group: createGroup({ id: 'group-a', name: 'Alpha Circle' }),
        },
        {
          group_id: 'group-c',
          status: 'rejected',
          group: createGroup({ id: 'group-c', name: 'Gamma League' }),
        },
      ],
    });

    expect(items.map(item => item.groupId)).toEqual(['group-a', 'group-b']);
    expect(items.map(item => item.name)).toEqual(['Alpha Circle', 'Beta Forum']);
  });

  it('removes a supporter when the latest confirmation declined support', () => {
    const items = deriveSupporterDirectoryItems({
      groupDecisions: [
        { group_id: 'group-a', status: 'accepted', group: createGroup({ id: 'group-a' }) },
      ],
      supportConfirmations: [
        {
          group_id: 'group-a',
          status: 'pending',
          created_at: 1,
          group: createGroup({ id: 'group-a' }),
        },
        {
          group_id: 'group-a',
          status: 'declined',
          created_at: 2,
          group: createGroup({ id: 'group-a' }),
        },
      ],
    });

    expect(items).toEqual([]);
  });

  it('keeps pending confirmations visible and counted', () => {
    const items = deriveSupporterDirectoryItems({
      groupDecisions: [
        {
          group_id: 'group-a',
          status: 'supported',
          group: createGroup({ id: 'group-a', name: 'Alpha Circle' }),
        },
      ],
      supportConfirmations: [
        {
          group_id: 'group-a',
          status: 'pending',
          created_at: 5,
          group: createGroup({ id: 'group-a', name: 'Alpha Circle' }),
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.supportStatus).toBe('pending');
  });

  it('deduplicates duplicate records and totals members once per group', () => {
    const items = deriveSupporterDirectoryItems({
      groupDecisions: [
        {
          group_id: 'group-a',
          status: 'supported',
          group: createGroup({ id: 'group-a', member_count: 15 }),
        },
        {
          group_id: 'group-a',
          status: 'accepted',
          group: createGroup({ id: 'group-a', member_count: 15 }),
        },
        {
          group_id: 'group-b',
          status: 'accepted',
          group: createGroup({ id: 'group-b', name: 'Beta Forum', member_count: 9 }),
        },
      ],
      supportConfirmations: [
        {
          group_id: 'group-a',
          status: 'confirmed',
          created_at: 1,
          group: createGroup({ id: 'group-a', member_count: 15 }),
        },
        {
          group_id: 'group-a',
          status: 'pending',
          created_at: 0,
          group: createGroup({ id: 'group-a', member_count: 15 }),
        },
      ],
    });

    expect(items.map(item => item.groupId)).toEqual(['group-a', 'group-b']);
    expect(items.reduce((sum, item) => sum + item.memberCount, 0)).toBe(24);
  });

  it('keeps groups without coordinates in the list but excludes them from map markers', () => {
    const items = deriveSupporterDirectoryItems({
      groupDecisions: [
        {
          group_id: 'group-a',
          status: 'accepted',
          group: createGroup({ id: 'group-a', name: 'Alpha Circle' }),
        },
        {
          group_id: 'group-b',
          status: 'accepted',
          group: createGroup({
            id: 'group-b',
            name: 'Beta Forum',
            latitude: null,
            longitude: null,
            city: '',
            region: '',
            country: '',
          }),
        },
      ],
    });

    const mapItems = deriveSupporterMapItems(items);

    expect(items.map(item => item.groupId)).toEqual(['group-a', 'group-b']);
    expect(mapItems.map(item => item.groupId)).toEqual(['group-a']);
    expect(items[1]?.locationLabel).toBe('Location not set');
  });
});
