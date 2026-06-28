/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventParticipants } from '../EventParticipants';

const mocks = vi.hoisted(() => ({
  useEventData: vi.fn(),
  useEventParticipants: vi.fn(),
  useEventMutations: vi.fn(),
  useEventAccessRoles: vi.fn(),
  useEventOfflineParticipants: vi.fn(),
  useEventParticipantsComposition: vi.fn(),
  useEventActions: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../hooks/useEventData', () => ({
  useEventData: (...args: unknown[]) => mocks.useEventData(...args),
  useEventParticipants: (...args: unknown[]) => mocks.useEventParticipants(...args),
}));

vi.mock('../../hooks/useEventMutations', () => ({
  useEventMutations: (...args: unknown[]) => mocks.useEventMutations(...args),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventAccessRoles: (...args: unknown[]) => mocks.useEventAccessRoles(...args),
  useEventOfflineParticipants: (...args: unknown[]) => mocks.useEventOfflineParticipants(...args),
}));

vi.mock('../../hooks/useDelegateAssemblyParticipantsComposition', () => ({
  useEventParticipantsComposition: (...args: unknown[]) =>
    mocks.useEventParticipantsComposition(...args),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: (...args: unknown[]) => mocks.useEventActions(...args),
}));

beforeEach(() => {
  mocks.useEventData.mockReturnValue({ event: null, isLoading: true, error: null });
  mocks.useEventParticipants.mockReturnValue({ participants: [] });
  mocks.useEventAccessRoles.mockReturnValue({ roles: [] });
  mocks.useEventOfflineParticipants.mockReturnValue({ offlineParticipants: [] });
  mocks.useEventParticipantsComposition.mockReturnValue({
    showComposition: false,
    participantsWithProvenance: [],
    isLoading: false,
    isDelegateAssembly: false,
  });
  mocks.useEventMutations.mockReturnValue({
    inviteParticipants: vi.fn(),
    approveParticipation: vi.fn(),
    rejectParticipation: vi.fn(),
    removeParticipant: vi.fn(),
    changeParticipantRoles: vi.fn(),
  });
  mocks.useEventActions.mockReturnValue({
    createOfflineParticipant: vi.fn(),
    updateOfflineParticipant: vi.fn(),
    deleteOfflineParticipant: vi.fn(),
    importOfflineParticipants: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EventParticipants loading state', () => {
  it('renders a page skeleton instead of loading text', () => {
    render(<EventParticipants eventId="event-1" />);

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(
      screen.queryByText('generated.inline.0491_loading_event_participants_4216bb13')
    ).toBeNull();
  });
});
