/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  groups: undefined as unknown[] | undefined,
  isLoading: false,
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

vi.mock('@/zero/groups/useGroupState.ts', () => ({
  usePublicGroups: () => ({ groups: state.groups, isLoading: state.isLoading }),
}));

vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatLocation: (group: { locationText?: string }) => group.locationText ?? '',
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (description: unknown) =>
    typeof description === 'string' ? description : '',
}));

import type { Group } from '../../hooks/useOnboarding';
import { useGroupSearchStepController } from '../useGroupSearchStepController';

const publicGroup = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  description: `${id} description`,
  member_count: 1,
  visibility: 'public',
  latitude: 1,
  longitude: 2,
  group_hashtags: [],
  locationText: `${id} location`,
  ...overrides,
});

const selectedGroup = (id: string, overrides: Partial<Group> = {}): Group => ({
  id,
  name: id,
  member_count: 0,
  visibility: 'public',
  ...overrides,
});

function setup(overrides: Partial<Parameters<typeof useGroupSearchStepController>[0]> = {}) {
  const callbacks = {
    onToggleGroup: vi.fn(),
    onActiveGroupChange: vi.fn(),
    onClearSelectedGroups: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
  };
  const props = {
    selectedGroups: [] as Group[],
    interestTags: [] as string[],
    activeGroupId: null as string | null,
    ...callbacks,
    ...overrides,
  };
  return { callbacks, props, hook: renderHook(() => useGroupSearchStepController(props)) };
}

describe('useGroupSearchStepController', () => {
  beforeEach(() => {
    state.groups = undefined;
    state.isLoading = false;
  });

  it('handles missing public data and every active-group fallback', () => {
    const first = selectedGroup('first');
    const second = selectedGroup('second');
    const { hook } = setup({ selectedGroups: [first, second], activeGroupId: 'second' });
    expect(hook.result.current).toMatchObject({
      groupsData: undefined,
      filteredGroups: [],
      activeGroup: second,
      hasSelectedGroups: true,
      unmappableGroupCount: 0,
    });

    const missing = setup({ selectedGroups: [first], activeGroupId: 'missing' });
    expect(missing.hook.result.current.activeGroup).toBe(first);

    const empty = setup({ selectedGroups: [], activeGroupId: 'missing' });
    expect(empty.hook.result.current.activeGroup).toBeNull();
    expect(empty.hook.result.current.hasSelectedGroups).toBe(false);
  });

  it('normalizes optional group fields, hashtags, and coordinate boundaries', () => {
    state.isLoading = true;
    state.groups = [
      publicGroup('nullish', {
        name: null,
        description: null,
        member_count: null,
        visibility: null,
        latitude: null,
        longitude: undefined,
        group_hashtags: undefined,
        locationText: '',
      }),
      publicGroup('tagged', {
        group_hashtags: [
          { hashtag: { tag: 'Policy' } },
          { hashtag: { tag: null } },
          { hashtag: null },
        ],
        latitude: Number.POSITIVE_INFINITY,
        longitude: Number.NaN,
      }),
      publicGroup('mappable', {
        group_hashtags: [{ hashtag: { tag: 'CIVIC' } }],
        latitude: 0,
        longitude: -0,
      }),
    ];

    const { hook } = setup({ interestTags: ['policy', 'civic'], activeGroupId: 'mappable' });
    expect(hook.result.current.groupsLoading).toBe(true);
    expect(hook.result.current.filteredGroups[0]).toMatchObject({
      id: 'tagged',
      hashtags: ['Policy'],
      matchingInterestTags: ['Policy'],
    });
    expect(hook.result.current.filteredGroups.find(group => group.id === 'nullish')).toMatchObject({
      name: '',
      description: undefined,
      member_count: 0,
      location: undefined,
      visibility: 'public',
      latitude: null,
      longitude: null,
      hashtags: [],
    });
    expect(hook.result.current.mappableGroups.map(group => group.id)).toEqual(['mappable']);
    expect(hook.result.current.unmappableGroupCount).toBe(2);
    expect(hook.result.current.activeGroup?.id).toBe('mappable');
  });

  it('sorts blank searches by interest matches then member count and limits them to ten', () => {
    state.groups = Array.from({ length: 12 }, (_, index) =>
      publicGroup(`group-${index}`, {
        member_count: index === 0 ? null : index,
        group_hashtags: index === 3 || index === 4 ? [{ hashtag: { tag: 'Priority' } }] : [],
      })
    );
    const { hook } = setup({ interestTags: ['PRIORITY'] });

    expect(hook.result.current.filteredGroups).toHaveLength(10);
    expect(hook.result.current.filteredGroups.slice(0, 2).map(group => group.id)).toEqual([
      'group-4',
      'group-3',
    ]);
  });

  it('matches search terms across name, description, location, and hashtags', () => {
    state.groups = [
      publicGroup('name-match', { name: 'Alpha council', description: null, locationText: '' }),
      publicGroup('description-match', {
        name: 'Other',
        description: 'Alpha description',
        locationText: '',
      }),
      publicGroup('location-match', {
        name: 'Other',
        description: null,
        locationText: 'Alpha city',
      }),
      publicGroup('hashtag-match', {
        name: 'Other',
        description: null,
        locationText: '',
        group_hashtags: [{ hashtag: { tag: 'AlphaTag' } }],
      }),
      publicGroup('no-match', { name: null, description: null, locationText: '' }),
    ];
    const { hook } = setup();

    act(() => hook.result.current.setSearchTerm('ALPHA'));
    expect(hook.result.current.filteredGroups.map(group => group.id)).toEqual([
      'name-match',
      'description-match',
      'location-match',
      'hashtag-match',
    ]);
  });

  it('forwards selection, activation, navigation, and skip actions', () => {
    state.groups = [publicGroup('group')];
    const { hook, callbacks } = setup({ isLoading: true });
    const group = hook.result.current.filteredGroups[0];

    act(() => hook.result.current.handleSelectGroup(group));
    act(() => hook.result.current.handleActivateGroup(null));
    act(() => hook.result.current.onBack());
    act(() => hook.result.current.onNext());
    act(() => hook.result.current.onClearSelectedGroups());
    act(() => hook.result.current.handleSkip());

    expect(callbacks.onActiveGroupChange.mock.calls).toEqual([['group'], [null]]);
    expect(callbacks.onToggleGroup).toHaveBeenCalledWith(group);
    expect(callbacks.onBack).toHaveBeenCalledOnce();
    expect(callbacks.onClearSelectedGroups).toHaveBeenCalledTimes(2);
    expect(callbacks.onNext).toHaveBeenCalledTimes(2);
    expect(hook.result.current.isLoading).toBe(true);
    expect(hook.result.current.t('key')).toBe('t:key');
  });
});
