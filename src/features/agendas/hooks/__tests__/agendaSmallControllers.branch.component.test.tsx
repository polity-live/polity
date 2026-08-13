/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccreditationSectionController } from '../useAccreditationSectionController';
import {
  getCountdownTone,
  useAgendaCountdownPillController,
  useAgendaEndedPillController,
  useAgendaEntityBadgeController,
  useAgendaStatusBadgeController,
  useAgendaTypeBadgeController,
} from '../useAgendaBadgesController';
import { useAgendaItemMutations } from '../useAgendaItemMutations';
import { useAgendaItems } from '../useAgendaItems';
import { useOfflineTallySubmissionProgress } from '../useOfflineTallySubmissionProgress';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as any,
  requestAccreditation: vi.fn(),
  showPasswordToast: vi.fn(),
  navigate: vi.fn(),
  deleteAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
  waitForClientApply: vi.fn(),
  relationItems: [] as any[],
  calculatedItems: [] as any[],
  relationLoading: false,
  calculatedLoading: false,
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/accreditation/useAccreditationState', () => ({
  useAccreditationState: () => ({
    accreditationsByAgendaItem: [],
    isAccredited: false,
    accreditationStatus: null,
    accreditedCount: 0,
    isLoading: false,
  }),
}));
vi.mock('@/zero/accreditation/useAccreditationActions', () => ({
  useAccreditationActions: () => ({
    requestAccreditation: mocks.requestAccreditation,
    approveAccreditation: vi.fn(),
    rejectAccreditation: vi.fn(),
    revokeAccreditation: vi.fn(),
  }),
}));
vi.mock('@/zero/rbac/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/features/notifications/utils/voting-password-error-toast', () => ({
  showVotingPasswordErrorToast: mocks.showPasswordToast,
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (error: any) => (error instanceof Error ? error.message : 'localized'),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    deleteAgendaItem: mocks.deleteAgendaItem,
    updateAgendaItem: mocks.updateAgendaItem,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/zero/events/useEventState', () => ({
  useAgendaItemsByEvent: () => ({
    agendaItems: mocks.relationItems,
    isLoading: mocks.relationLoading,
  }),
}));
vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaState: () => ({
    agendaItems: mocks.calculatedItems,
    isLoading: mocks.calculatedLoading,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.requestAccreditation.mockResolvedValue(undefined);
  mocks.waitForClientApply.mockImplementation(async value => value);
  mocks.relationItems = [];
  mocks.calculatedItems = [];
  mocks.relationLoading = false;
  mocks.calculatedLoading = false;
});

afterEach(() => vi.useRealTimers());

describe('useAccreditationSectionController', () => {
  it('guards anonymous submission and handles success and errors', async () => {
    const { result, rerender } = renderHook(() =>
      useAccreditationSectionController({ eventId: 'event-1', agendaItemId: 'agenda-1' })
    );
    expect(result.current.noVotingPasswordSettingsHref).toContain('/user/user-1/');
    act(() => result.current.handleConfirmClick());
    expect(result.current.showPasswordInput).toBe(true);
    await act(async () => result.current.handlePasswordSubmit('1234'));
    expect(mocks.requestAccreditation).toHaveBeenCalled();
    expect(result.current.showPasswordInput).toBe(false);

    mocks.requestAccreditation.mockRejectedValueOnce(new Error('Invalid PIN'));
    await act(async () => result.current.handlePasswordSubmit('0000'));
    expect(result.current.passwordError).toBe('Invalid PIN');
    expect(mocks.showPasswordToast).toHaveBeenCalled();

    mocks.user = null;
    rerender();
    await act(async () => result.current.handlePasswordSubmit('1111'));
    expect(result.current.noVotingPasswordSettingsHref).toBeUndefined();
  });
});

describe('agenda badge controllers', () => {
  it('maps every status, type, entity, and countdown tone', () => {
    for (const tone of ['start', 'active', 'completed', 'end'] as const)
      expect(getCountdownTone(tone)).toBeTruthy();
    for (const status of ['active', 'in-progress', 'completed', 'pending', 'planned'] as const) {
      const { result, unmount } = renderHook(() => useAgendaStatusBadgeController(status as any));
      expect(result.current.label).toBeTruthy();
      unmount();
    }
    for (const type of ['election', 'vote', 'accreditation', 'speech', 'discussion'] as const) {
      const { result, unmount } = renderHook(() => useAgendaTypeBadgeController(type as any));
      expect(result.current.Icon).toBeTruthy();
      unmount();
    }
    expect(renderHook(() => useAgendaEntityBadgeController('amendment')).result.current.tone).toBe(
      'info'
    );
    expect(renderHook(() => useAgendaEntityBadgeController('role')).result.current.tone).toBe(
      'accent'
    );
  });

  it('tracks invalid, expired, and future countdown timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(
      renderHook(() => useAgendaCountdownPillController('invalid')).result.current.isExpired
    ).toBe(true);
    expect(
      renderHook(() => useAgendaCountdownPillController(new Date(Date.now() - 1))).result.current
        .isExpired
    ).toBe(true);
    const futureAt = new Date(Date.now() + 1_000);
    const future = renderHook(() => useAgendaCountdownPillController(futureAt));
    expect(future.result.current.isExpired).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(future.result.current.isExpired).toBe(true);
    expect(
      renderHook(() => useAgendaEndedPillController('invalid')).result.current.shouldRender
    ).toBe(false);
    expect(
      renderHook(() => useAgendaEndedPillController(new Date(Date.now() - 1))).result.current
        .shouldRender
    ).toBe(true);
    expect(
      renderHook(() => useAgendaEndedPillController(new Date(Date.now() + 1_000))).result.current
        .shouldRender
    ).toBe(false);
  });
});

describe('useAgendaItemMutations', () => {
  it('guards guests and handles delete and transfer variants', async () => {
    const { result, rerender } = renderHook(() => useAgendaItemMutations('agenda-1', 'event-1'));
    await act(async () => result.current.handleDelete());
    expect(mocks.deleteAgendaItem).toHaveBeenCalled();
    await act(async () =>
      result.current.handleTransfer({
        targetEventId: 'event-2',
        agendaItemTitle: 'Agenda',
        sourceEventTitle: 'One',
        targetEventTitle: 'Two',
        newOrder: 4,
      })
    );
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith(expect.objectContaining({ order: 4 }));
    await act(async () =>
      result.current.handleTransfer({
        targetEventId: 'event-3',
        agendaItemTitle: 'Agenda',
        sourceEventTitle: 'One',
        targetEventTitle: 'Three',
      })
    );
    expect(mocks.updateAgendaItem).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ order: expect.anything() })
    );

    mocks.user = null;
    rerender();
    const calls = mocks.deleteAgendaItem.mock.calls.length;
    const transferCalls = mocks.updateAgendaItem.mock.calls.length;
    await act(async () => result.current.handleDelete());
    await act(async () =>
      result.current.handleTransfer({
        targetEventId: 'event-4',
        agendaItemTitle: 'Agenda',
        sourceEventTitle: 'One',
        targetEventTitle: 'Four',
      })
    );
    expect(mocks.deleteAgendaItem).toHaveBeenCalledTimes(calls);
    expect(mocks.updateAgendaItem).toHaveBeenCalledTimes(transferCalls);
  });

  it('rethrows mutation failures and clears loading state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('delete failed'));
    const { result } = renderHook(() => useAgendaItemMutations('agenda-1', 'event-1'));
    await expect(result.current.handleDelete()).rejects.toThrow('delete failed');
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('transfer failed'));
    await expect(
      result.current.handleTransfer({
        targetEventId: 'event-2',
        agendaItemTitle: '',
        sourceEventTitle: '',
        targetEventTitle: '',
      })
    ).rejects.toThrow('transfer failed');
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('useAgendaItems and offline submission progress', () => {
  it('merges calculated times and both loading sources', () => {
    mocks.relationItems = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    mocks.calculatedItems = [{ id: 'a', calculated_start_time: 1, calculated_end_time: 2 }];
    mocks.relationLoading = true;
    const { result, rerender } = renderHook(() => useAgendaItems('event-1'));
    expect(result.current.agendaItems[0]).toMatchObject({
      calculated_start_time: 1,
      calculated_end_time: 2,
    });
    expect(result.current.agendaItems[1].calculated_start_time).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    mocks.relationLoading = false;
    mocks.calculatedLoading = true;
    rerender();
    expect(result.current.isLoading).toBe(true);
  });

  it('advances and resets all submission steps', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ submitting }) => useOfflineTallySubmissionProgress(submitting),
      { initialProps: { submitting: false } }
    );
    expect(result.current.every(step => step.status === 'pending')).toBe(true);
    rerender({ submitting: true });
    expect(result.current[0].status).toBe('active');
    act(() => vi.advanceTimersByTime(700));
    expect(result.current[1].status).toBe('active');
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current[2].status).toBe('active');
    rerender({ submitting: false });
    expect(result.current.every(step => step.status === 'pending')).toBe(true);
    unmount();
  });
});
