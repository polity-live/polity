/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNavigationCommandDialogController } from '../useNavigationCommandDialogController';
import type { NavigationItem } from '../../types/navigation.types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setNavigationType: vi.fn(),
  currentUserMembershipsWithGroups: [] as unknown[],
  userEventParticipations: [] as unknown[],
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/navigation/nav-keyboard/use-navigation-keyboard.tsx', () => ({
  useCommandDialogShortcut: vi.fn(),
  useNavigationKeyboard: vi.fn(),
}));

vi.mock('@/features/navigation/state/navigation.store.tsx', () => ({
  useNavigationStore: () => ({
    setNavigationType: mocks.setNavigationType,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));

vi.mock('@/providers/auth-provider.tsx', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ada@example.com' },
  }),
}));

vi.mock('@/zero/groups/useGroupState.ts', () => ({
  useGroupState: () => ({
    currentUserMembershipsWithGroups: mocks.currentUserMembershipsWithGroups,
    isLoading: false,
  }),
}));

vi.mock('@/zero/events/useEventState.ts', () => ({
  useUserEventParticipations: () => ({
    participations: mocks.userEventParticipations,
    isLoading: false,
  }),
}));

const primaryNavItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'Home',
    href: '/home',
  },
];

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.setNavigationType.mockReset();
  mocks.currentUserMembershipsWithGroups = [];
  mocks.userEventParticipations = [];
});

describe('useNavigationCommandDialogController', () => {
  it('exposes the same active groups and future events as the user menu builders', () => {
    mocks.currentUserMembershipsWithGroups = [
      {
        status: 'active',
        group: { id: 'group-active', name: 'Working Circle' },
        membership_roles: [{ role: { id: 'member-role' } }],
      },
      {
        status: 'requested',
        group: { id: 'group-requested', name: 'Requested Group' },
        membership_roles: [{ role: { id: 'requested-role' } }],
      },
      {
        status: 'active',
        group: { id: 'group-no-role', name: 'No Role Group' },
        membership_roles: [],
      },
    ];
    mocks.userEventParticipations = [
      buildParticipation('event-future', 'Future Assembly', {
        startDate: new Date('2030-01-01T10:00:00Z').getTime(),
      }),
      buildParticipation('event-cancelled', 'Cancelled Assembly', {
        eventStatus: 'cancelled',
        startDate: new Date('2030-01-01T10:00:00Z').getTime(),
      }),
      buildParticipation('event-past', 'Past Assembly', {
        startDate: new Date('2000-01-01T10:00:00Z').getTime(),
      }),
    ];

    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    expect(result.current.groupItems.map(group => group.id)).toEqual(['group-active']);
    expect(result.current.eventItems.map(event => event.id)).toEqual(['event-future']);
  });

  it('navigates to a selected group and closes the dialog', () => {
    mocks.currentUserMembershipsWithGroups = [
      {
        status: 'active',
        group: { id: 'group-active', name: 'Working Circle' },
        membership_roles: [{ role: { id: 'member-role' } }],
      },
    ];

    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    act(() => result.current.setOpen(true));
    act(() => result.current.onSelectGroupItem(result.current.groupItems[0]));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/group/$id',
      params: { id: 'group-active' },
    });
    expect(result.current.open).toBe(false);
  });

  it('navigates to a selected event and closes the dialog', () => {
    mocks.userEventParticipations = [
      buildParticipation('event-future', 'Future Assembly', {
        startDate: new Date('2030-01-01T10:00:00Z').getTime(),
      }),
    ];

    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    act(() => result.current.setOpen(true));
    act(() => result.current.onSelectEventItem(result.current.eventItems[0]));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/event/$id',
      params: { id: 'event-future' },
    });
    expect(result.current.open).toBe(false);
  });
});

function buildParticipation(
  id: string,
  title: string,
  options: {
    eventStatus?: string;
    startDate: number;
  }
) {
  return {
    id: `${id}-participation`,
    status: 'confirmed',
    event: {
      id,
      title,
      status: options.eventStatus ?? 'published',
      start_date: options.startDate,
      end_date: options.startDate + 60 * 60 * 1000,
      group: { id: 'group-active', name: 'Working Circle' },
      location_name: 'Berlin',
    },
    participant_roles: [{ role: { id: `${id}-role` } }],
  };
}
