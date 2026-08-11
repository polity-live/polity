/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserMenuController } from '../useUserMenuController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  currentUserMembershipsWithGroups: [] as unknown[],
  userEventParticipations: [] as unknown[],
  openNavigationAmendments: [] as unknown[],
  authUser: { id: 'user-1', email: 'ada@example.com' } as any,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/providers/auth-provider.tsx', () => ({
  useAuth: () => ({
    user: mocks.authUser,
    signOut: mocks.signOut,
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
  }),
}));

vi.mock('@/zero/events/useEventState.ts', () => ({
  useUserEventParticipations: (userId?: string) => ({
    participations: userId ? mocks.userEventParticipations : [],
  }),
}));

vi.mock('@/zero/amendments/useAmendmentState.ts', () => ({
  useCurrentUserOpenNavigationAmendments: (userId?: string) => ({
    amendments: userId ? mocks.openNavigationAmendments : [],
  }),
}));

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.signOut.mockReset();
  mocks.currentUserMembershipsWithGroups = [];
  mocks.userEventParticipations = [];
  mocks.openNavigationAmendments = [];
  mocks.authUser = { id: 'user-1', email: 'ada@example.com' };
});

describe('useUserMenuController', () => {
  it('does not expose relationship entities until navigation loading is enabled', () => {
    mocks.userEventParticipations = [buildParticipation('event-alpha', 'Alpha Assembly')];

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useUserMenuController({
          user: null,
          navigationEnabled: enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(result.current?.events).toEqual([]);

    rerender({ enabled: true });
    expect(result.current?.events.map(event => event.id)).toEqual(['event-alpha']);
  });

  it('shows searchable events alphabetically and filters them by title', () => {
    mocks.userEventParticipations = [
      buildParticipation('event-zeta', 'Zeta Assembly'),
      buildParticipation('event-alpha', 'Alpha Assembly'),
      buildParticipation('event-beta', 'Beta Assembly'),
      buildParticipation('event-gamma', 'Gamma Assembly'),
      buildParticipation('event-delta', 'Delta Assembly'),
      buildParticipation('event-omega', 'Omega Assembly'),
    ];

    const { result } = renderHook(() => useUserMenuController({ user: null }));

    expect(result.current?.showEventSearch).toBe(true);
    expect(result.current?.events.map(event => event.title)).toEqual([
      'Alpha Assembly',
      'Beta Assembly',
      'Delta Assembly',
      'Gamma Assembly',
      'Omega Assembly',
      'Zeta Assembly',
    ]);

    act(() => {
      result.current?.onEventSearchChange('ta');
    });

    expect(result.current?.events.map(event => event.title)).toEqual([
      'Beta Assembly',
      'Delta Assembly',
      'Zeta Assembly',
    ]);
  });

  it('shows searchable open amendments alphabetically and filters them by title, code, and context', () => {
    mocks.openNavigationAmendments = [
      buildAmendment('amendment-zeta', 'Zeta Motion', {
        code: 'Z-1',
        targetGroupName: 'Target Group',
        groupName: 'Source Group',
        eventTitle: 'Future Assembly',
      }),
      buildAmendment('amendment-alpha', 'Alpha Motion', {
        code: 'A-1',
        targetGroupName: 'Policy Board',
      }),
      buildAmendment('amendment-beta', 'Beta Motion', {
        code: 'B-1',
        targetGroupName: 'Working Group',
      }),
      buildAmendment('amendment-gamma', 'Gamma Motion'),
      buildAmendment('amendment-delta', 'Delta Motion'),
      buildAmendment('amendment-omega', 'Omega Motion'),
    ];

    const { result } = renderHook(() => useUserMenuController({ user: null }));

    expect(result.current?.showAmendmentSearch).toBe(true);
    expect(result.current?.amendments.map(amendment => amendment.title)).toEqual([
      'Alpha Motion',
      'Beta Motion',
      'Delta Motion',
      'Gamma Motion',
      'Omega Motion',
      'Zeta Motion',
    ]);

    act(() => {
      result.current?.onAmendmentSearchChange('policy');
    });

    expect(result.current?.amendments.map(amendment => amendment.id)).toEqual(['amendment-alpha']);

    act(() => {
      result.current?.onAmendmentSearchChange('Z-1');
    });

    expect(result.current?.amendments.map(amendment => amendment.id)).toEqual(['amendment-zeta']);
  });

  it('hides amendment search for five open amendments', () => {
    mocks.openNavigationAmendments = [
      buildAmendment('amendment-alpha', 'Alpha Motion'),
      buildAmendment('amendment-beta', 'Beta Motion'),
      buildAmendment('amendment-gamma', 'Gamma Motion'),
      buildAmendment('amendment-delta', 'Delta Motion'),
      buildAmendment('amendment-omega', 'Omega Motion'),
    ];

    const { result } = renderHook(() => useUserMenuController({ user: null }));

    expect(result.current?.showAmendmentSearch).toBe(false);
  });

  it('filters groups and covers absent auth and profile fallbacks', () => {
    mocks.currentUserMembershipsWithGroups = [
      {
        group: { id: 'alpha', name: 'Alpha Group', image_url: null },
        role: { id: 'role-alpha' },
        status: 'active',
      },
      {
        group: { id: 'beta', name: 'Beta Group', image_url: null },
        role: { id: 'role-beta' },
        status: 'active',
      },
    ];
    const view = renderHook(({ user }) => useUserMenuController({ user }), {
      initialProps: { user: { first_name: null, last_name: null, avatar: null } as any },
    });
    act(() => view.result.current?.onGroupSearchChange('beta'));
    expect(view.result.current?.groups.map(group => group.id)).toEqual(['beta']);

    mocks.authUser = { id: 'user-1', email: null };
    view.rerender({ user: { first_name: null, last_name: null, avatar: null } });
    expect(view.result.current?.displayName).toBe('User');
    expect(view.result.current?.displayEmail).toBe('');
    expect(view.result.current?.userInitials).toBe('U');
    mocks.authUser = null;
    view.rerender({ user: null });
    expect(view.result.current).toBeNull();
  });

  it('clears searches, focuses their inputs, and handles logout success and failure', async () => {
    const view = renderHook(() => useUserMenuController({ user: null }));
    const groupFocus = vi.fn();
    const eventFocus = vi.fn();
    const amendmentFocus = vi.fn();
    view.result.current!.groupSearchInputRef.current = { focus: groupFocus } as any;
    view.result.current!.eventSearchInputRef.current = { focus: eventFocus } as any;
    view.result.current!.amendmentSearchInputRef.current = { focus: amendmentFocus } as any;
    act(() => {
      view.result.current!.onGroupSearchChange('g');
      view.result.current!.onEventSearchChange('e');
      view.result.current!.onAmendmentSearchChange('a');
      view.result.current!.onClearGroupSearch();
      view.result.current!.onClearEventSearch();
      view.result.current!.onClearAmendmentSearch();
    });
    expect(groupFocus).toHaveBeenCalled();
    expect(eventFocus).toHaveBeenCalled();
    expect(amendmentFocus).toHaveBeenCalled();
    await act(async () => view.result.current!.onLogout());
    expect(mocks.navigate).toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalled();

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.navigate.mockRejectedValueOnce(new Error('navigation failed'));
    await act(async () => view.result.current!.onLogout());
    expect(error).toHaveBeenCalled();
  });
});

function buildParticipation(id: string, title: string) {
  return {
    id: `${id}-participation`,
    status: 'confirmed',
    event: {
      id,
      title,
      status: 'published',
      start_date: new Date('2030-01-01T10:00:00Z').getTime(),
      end_date: new Date('2030-01-01T12:00:00Z').getTime(),
      group: null,
    },
    participant_roles: [{ role: { id: `${id}-role` } }],
  };
}

function buildAmendment(
  id: string,
  title: string,
  options: {
    code?: string;
    groupName?: string;
    targetGroupName?: string;
    eventTitle?: string;
  } = {}
) {
  return {
    id,
    title,
    code: options.code,
    group: options.groupName ? { id: `${id}-group`, name: options.groupName } : null,
    event: options.eventTitle ? { id: `${id}-event`, title: options.eventTitle } : null,
    current_process_run: options.targetGroupName
      ? {
          status: 'scheduled',
          selected_target_group_id: `${id}-target-group`,
          selected_target_group: {
            id: `${id}-target-group`,
            name: options.targetGroupName,
          },
        }
      : null,
    group_decisions: [],
  };
}
