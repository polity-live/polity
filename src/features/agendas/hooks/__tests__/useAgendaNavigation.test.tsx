/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reportTutorialAction: vi.fn(),
  tutorialIsActive: vi.fn(() => true),
  serverConfirmed: vi.fn(async (_result: unknown) => undefined),
  trackServerFinalization: vi.fn(),
  updateAgendaItem: vi.fn((args: unknown) => ({ kind: 'agenda', args })),
  updateEvent: vi.fn((args: unknown) => ({ kind: 'event', args })),
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ updateAgendaItem: mocks.updateAgendaItem }),
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ updateEvent: mocks.updateEvent }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useEventWithAgendaAndParticipants: () => ({
    event: {
      id: 'event-1',
      current_agenda_item_id: null,
      // Regression coverage: reporting must not depend on this field being
      // present in a temporarily hydrating event query.
      tutorial_run_id: null,
      agenda_items: [
        {
          id: 'agenda-1',
          title: 'First item',
          type: 'amendment',
          status: 'pending',
          order_index: 1,
          activated_at: null,
          completed_at: null,
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: () => true }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (result: unknown) => mocks.serverConfirmed(result),
  trackServerFinalization: (result: unknown, options: unknown) =>
    mocks.trackServerFinalization(result, options),
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  isAppTutorialActiveInDocument: () => mocks.tutorialIsActive(),
  reportAppTutorialAction: (detail: unknown) => mocks.reportTutorialAction(detail),
}));

import { useAgendaNavigation } from '../useAgendaNavigation';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAgendaNavigation', () => {
  it('reports a successful event start even while tutorial metadata is absent', async () => {
    const { result } = renderHook(() => useAgendaNavigation('event-1'));

    await act(async () => {
      await result.current.startFirstPendingItem();
    });

    expect(mocks.updateEvent).toHaveBeenCalledWith({
      id: 'event-1',
      current_agenda_item_id: 'agenda-1',
      status: 'active',
    });
    expect(mocks.serverConfirmed).not.toHaveBeenCalled();
    expect(mocks.trackServerFinalization).toHaveBeenCalledTimes(2);
    expect(mocks.reportTutorialAction).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'event.started',
    });
  });
});
