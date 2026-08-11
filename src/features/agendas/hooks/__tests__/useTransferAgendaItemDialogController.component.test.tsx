/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTransferAgendaItemDialogController } from '../useTransferAgendaItemDialogController';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as any,
  participations: undefined as any,
  handleTransfer: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({ participations: mocks.participations, isLoading: false }),
}));
vi.mock('../useAgendaItemMutations', () => ({
  useAgendaItemMutations: () => ({ handleTransfer: mocks.handleTransfer, transferLoading: false }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.participations = undefined;
  mocks.handleTransfer.mockResolvedValue(undefined);
});

describe('useTransferAgendaItemDialogController', () => {
  it('has no transfer destinations while participations are unavailable', () => {
    const { result } = renderHook(() =>
      useTransferAgendaItemDialogController({
        agendaItemId: 'agenda-1',
        agendaItemTitle: 'Agenda',
        currentEventId: 'event-current',
        currentEventTitle: 'Current',
      })
    );

    expect(result.current.eventsWithPermission).toEqual([]);
  });

  it('supports internal state and filters duplicate, missing, and current events', async () => {
    mocks.participations = [
      { event: null },
      { event: { id: 'event-current', title: 'Current' } },
      { event: { id: 'event-2', title: '', start_date: 1 } },
      { event: { id: 'event-2', title: 'Duplicate' } },
      { event: { id: 'event-3', title: 'Third' } },
    ];
    const onTransferComplete = vi.fn();
    const { result } = renderHook(() =>
      useTransferAgendaItemDialogController({
        agendaItemId: 'agenda-1',
        agendaItemTitle: 'Agenda',
        currentEventId: 'event-current',
        currentEventTitle: 'Current',
        onTransferComplete,
      })
    );
    expect(result.current.eventsWithPermission.map(event => event.id)).toEqual([
      'event-2',
      'event-3',
    ]);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    await act(async () => result.current.handleConfirmTransfer());
    expect(mocks.handleTransfer).not.toHaveBeenCalled();
    act(() => result.current.setSelectedEventId('event-2'));
    await act(async () => result.current.handleConfirmTransfer());
    expect(mocks.handleTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ targetEventId: 'event-2' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(onTransferComplete).toHaveBeenCalled();
  });

  it('uses controlled open state, optional callback absence, and reports failures', async () => {
    mocks.participations = [{ event: { id: 'event-2', title: 'Second' } }];
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useTransferAgendaItemDialogController({
        agendaItemId: 'agenda-1',
        agendaItemTitle: 'Agenda',
        currentEventId: 'event-1',
        currentEventTitle: 'First',
        open: true,
        onOpenChange,
      })
    );
    expect(result.current.open).toBe(true);
    act(() => result.current.setSelectedEventId('event-2'));
    mocks.handleTransfer.mockRejectedValueOnce(new Error('failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => result.current.handleConfirmTransfer());
    expect(mocks.toastError).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
