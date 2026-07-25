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
    user: { id: 'user-1', email: 'ada@example.com' },
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
    ];

    const { result } = renderHook(() => useUserMenuController({ user: null }));

    expect(result.current?.showAmendmentSearch).toBe(true);
    expect(result.current?.amendments.map(amendment => amendment.title)).toEqual([
      'Alpha Motion',
      'Beta Motion',
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
