/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCancelEventDialogController } from '../useCancelEventDialogController';

const mocks = vi.hoisted(() => ({
  cancelEvent: vi.fn(),
  agendaItems: [{ id: 'item-1' }, { id: 'item-2' }] as any[],
  availableEvents: [{ id: 'event-2' }] as any[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../hooks/useCancelEvent', () => ({
  useCancelEvent: () => ({
    isLoading: false,
    agendaItems: mocks.agendaItems,
    cancelEvent: mocks.cancelEvent,
  }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventsByGroup: () => ({ events: mocks.availableEvents }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cancelEvent.mockResolvedValue(undefined);
  mocks.agendaItems = [{ id: 'item-1' }, { id: 'item-2' }];
  mocks.availableEvents = [{ id: 'event-2' }];
});

describe('useCancelEventDialogController coverage', () => {
  it('toggles items, selects and clears all, validates, and emits sparse and complete cancels', async () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ open }) =>
        useCancelEventDialogController({
          eventId: 'event-1',
          open,
          onOpenChange,
          groupId: 'group-1',
        }),
      { initialProps: { open: false } }
    );
    await act(async () => result.current.handleCancel());
    expect(mocks.cancelEvent).not.toHaveBeenCalled();
    act(() => result.current.handleItemToggle('item-1'));
    act(() => result.current.handleItemToggle('item-2'));
    act(() => result.current.handleItemToggle('item-1'));
    expect(result.current.selectedItems).toEqual(['item-2']);
    act(() => result.current.handleSelectAll());
    expect(result.current.selectedItems).toEqual(['item-1', 'item-2']);
    act(() => result.current.handleSelectAll());
    expect(result.current.selectedItems).toEqual([]);

    act(() => result.current.setReason('  Sparse reason  '));
    await act(async () => result.current.handleCancel());
    expect(mocks.cancelEvent).toHaveBeenLastCalledWith({
      eventId: 'event-1',
      reason: 'Sparse reason',
      reassignToEventId: undefined,
      itemsToReassign: undefined,
    });

    act(() => {
      result.current.setReason(' Complete ');
      result.current.setSelectedItems(['item-1']);
      result.current.setTargetEventId('event-2');
    });
    await act(async () => result.current.handleCancel());
    expect(mocks.cancelEvent).toHaveBeenLastCalledWith({
      eventId: 'event-1',
      reason: 'Complete',
      reassignToEventId: 'event-2',
      itemsToReassign: ['item-1'],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender({ open: true });
    expect(result.current).toMatchObject({ reason: '', selectedItems: [], targetEventId: '' });
  });
});
