/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNavigationCommandDialogController } from '../useNavigationCommandDialogController';
import type { NavigationItem } from '../../types/navigation.types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setNavigationType: vi.fn(),
  keyboardConfig: null as null | {
    onNavigate: (navId: string) => void;
    onThemeToggle: () => void;
    onKeyboardShortcutsOpen: () => void;
    onClose: () => void;
  },
  getUserSecondaryNavItems: vi.fn(() => [] as NavigationItem[]),
  currentUserMembershipsWithGroups: [] as unknown[],
  userEventParticipations: [] as unknown[],
  openNavigationAmendments: [] as unknown[],
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/navigation/nav-keyboard/use-navigation-keyboard.tsx', () => ({
  useCommandDialogShortcut: vi.fn(),
  useNavigationKeyboard: vi.fn((config: NonNullable<typeof mocks.keyboardConfig>) => {
    mocks.keyboardConfig = config;
  }),
}));

vi.mock('@/features/navigation/nav-items/nav-items-authenticated.tsx', () => ({
  navItemsAuthenticated: vi.fn(() => ({
    getUserSecondaryNavItems: mocks.getUserSecondaryNavItems,
  })),
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
  useGroupState: ({
    includeCurrentUserMembershipsWithGroups,
  }: {
    includeCurrentUserMembershipsWithGroups?: boolean;
  }) => ({
    currentUserMembershipsWithGroups: includeCurrentUserMembershipsWithGroups
      ? mocks.currentUserMembershipsWithGroups
      : [],
    isLoading: false,
  }),
}));

vi.mock('@/zero/events/useEventState.ts', () => ({
  useUserEventParticipations: (userId?: string) => ({
    participations: userId ? mocks.userEventParticipations : [],
    isLoading: false,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentState.ts', () => ({
  useCurrentUserOpenNavigationAmendments: (userId?: string) => ({
    amendments: userId ? mocks.openNavigationAmendments : [],
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
  mocks.keyboardConfig = null;
  mocks.getUserSecondaryNavItems.mockClear();
  mocks.currentUserMembershipsWithGroups = [];
  mocks.userEventParticipations = [];
  mocks.openNavigationAmendments = [];
});

describe('useNavigationCommandDialogController', () => {
  it('exposes the same active groups and future events as the user menu builders', () => {
    mocks.currentUserMembershipsWithGroups = [
      {
        status: 'active',
        group: { id: 'group-active', name: 'Working Circle' },
        membership_roles: [
          {
            role: {
              id: 'member-role',
              action_rights: [{ group_id: 'group-active', resource: 'groups', action: 'view' }],
            },
          },
        ],
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

    expect(result.current.groupItems).toEqual([]);
    expect(result.current.eventItems).toEqual([]);

    act(() => result.current.setOpen(true));

    expect(result.current.groupItems.map(group => group.id)).toEqual(['group-active']);
    expect(result.current.eventItems.map(event => event.id)).toEqual(['event-future']);
  });

  it('exposes personal open amendments from the shared navigation entities hook', () => {
    mocks.openNavigationAmendments = [
      {
        id: 'amendment-open',
        title: 'Open Motion',
        group_id: 'group-active',
        group: { id: 'group-active', name: 'Working Circle' },
        current_process_run: null,
        group_decisions: [],
      },
      {
        id: 'amendment-accepted',
        title: 'Accepted Motion',
        group_id: 'group-active',
        group: { id: 'group-active', name: 'Working Circle' },
        current_process_run: null,
        group_decisions: [{ group_id: 'group-active', status: 'accepted' }],
      },
    ];

    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    expect(result.current.amendmentItems).toEqual([]);
    act(() => result.current.setOpen(true));

    expect(result.current.amendmentItems.map(amendment => amendment.id)).toEqual([
      'amendment-open',
    ]);
  });

  it('navigates to a selected group and closes the dialog', () => {
    mocks.currentUserMembershipsWithGroups = [
      {
        status: 'active',
        group: { id: 'group-active', name: 'Working Circle' },
        membership_roles: [
          {
            role: {
              id: 'member-role',
              action_rights: [{ group_id: 'group-active', resource: 'groups', action: 'view' }],
            },
          },
        ],
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

  it('navigates to a selected amendment and closes the dialog', () => {
    mocks.openNavigationAmendments = [
      {
        id: 'amendment-open',
        title: 'Open Motion',
        group_id: 'group-active',
        group: { id: 'group-active', name: 'Working Circle' },
        current_process_run: null,
        group_decisions: [],
      },
    ];

    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    act(() => result.current.setOpen(true));
    act(() => result.current.onSelectAmendmentItem(result.current.amendmentItems[0]));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/amendment/$id',
      params: { id: 'amendment-open' },
    });
    expect(result.current.open).toBe(false);
  });

  it('selects primary items through click, href, and fallback routes', () => {
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems: [
          { id: 'action', label: 'Action', icon: 'Home', onClick },
          { id: 'linked', label: 'Linked', icon: 'Home', href: '/linked' },
          { id: 'home', label: 'Home', icon: 'Home' },
          { id: 'settings', label: 'Settings', icon: 'Home' },
        ],
        secondaryNavItems: null,
      })
    );

    act(() =>
      result.current.onSelectPrimaryItem(
        result.current.userNavItems[0] ?? {
          id: 'action',
          label: 'Action',
          icon: 'Home',
          onClick,
        }
      )
    );
    act(() =>
      result.current.onSelectPrimaryItem({
        id: 'linked',
        label: 'Linked',
        icon: 'Home',
        href: '/linked',
      })
    );
    act(() => result.current.onSelectPrimaryItem({ id: 'home', label: 'Home', icon: 'Home' }));
    act(() =>
      result.current.onSelectPrimaryItem({
        id: 'settings',
        label: 'Settings',
        icon: 'Home',
      })
    );

    expect(onClick).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenNthCalledWith(1, { to: '/linked' });
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, { to: '/' });
    expect(mocks.navigate).toHaveBeenNthCalledWith(3, { to: '/settings' });
  });

  it('classifies keyboard navigation without changing ambiguous items', () => {
    const shared = { id: 'shared', label: 'Shared', icon: 'Home' } as NavigationItem;
    renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems: [primaryNavItems[0], shared],
        secondaryNavItems: [{ id: 'secondary', label: 'Secondary', icon: 'Home' }, shared],
      })
    );

    act(() => mocks.keyboardConfig!.onNavigate('missing'));
    act(() => mocks.keyboardConfig!.onNavigate('home'));
    act(() => mocks.keyboardConfig!.onNavigate('secondary'));
    act(() => mocks.keyboardConfig!.onNavigate('shared'));

    expect(mocks.navigate).toHaveBeenCalledTimes(3);
    expect(mocks.setNavigationType.mock.calls).toEqual([['primary'], ['secondary']]);
  });

  it('handles keyboard close commands and builds authenticated user navigation while open', () => {
    mocks.getUserSecondaryNavItems.mockReturnValue([
      { id: 'profile', label: 'Profile', icon: 'Home' },
    ]);
    const { result } = renderHook(() =>
      useNavigationCommandDialogController({
        primaryNavItems,
        secondaryNavItems: null,
      })
    );

    act(() => mocks.keyboardConfig!.onNavigate('home'));
    act(() => result.current.setOpen(true));
    expect(result.current.userNavItems).toHaveLength(1);
    expect(mocks.getUserSecondaryNavItems).toHaveBeenCalledWith('user-1', true);

    act(() => mocks.keyboardConfig!.onThemeToggle());
    act(() => result.current.setOpen(true));
    act(() => mocks.keyboardConfig!.onKeyboardShortcutsOpen());
    act(() => result.current.setOpen(true));
    act(() => mocks.keyboardConfig!.onClose());

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
    participant_roles: [
      {
        role: {
          id: `${id}-role`,
          scope: 'event',
          event_id: id,
          action_rights: [{ event_id: id, resource: 'events', action: 'view' }],
        },
      },
    ],
  };
}
