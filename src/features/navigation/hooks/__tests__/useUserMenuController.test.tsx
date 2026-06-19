/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserMenuController } from '../useUserMenuController';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  currentUserMembershipsWithGroups: [] as unknown[],
  userEventParticipations: [] as unknown[],
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
  useGroupState: () => ({
    currentUserMembershipsWithGroups: mocks.currentUserMembershipsWithGroups,
  }),
}));

vi.mock('@/zero/events/useEventState.ts', () => ({
  useUserEventParticipations: () => ({
    participations: mocks.userEventParticipations,
  }),
}));

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.signOut.mockReset();
  mocks.currentUserMembershipsWithGroups = [];
  mocks.userEventParticipations = [];
});

describe('useUserMenuController', () => {
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
