/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  typeahead: vi.fn((_props: unknown) => <div data-testid="typeahead" />),
}));

vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: (props: unknown) => mocks.typeahead(props),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TransferAgendaItemDialogView } from '../TransferAgendaItemDialogView';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const controller = (overrides: Record<string, unknown> = {}) =>
  ({
    open: true,
    setOpen: vi.fn(),
    selectedEventId: '',
    setSelectedEventId: vi.fn(),
    selectedEvent: null,
    eventsWithPermission: [] as any[],
    participationsLoading: false,
    transferLoading: false,
    handleConfirmTransfer: vi.fn(),
    ...overrides,
  }) as any;

describe('TransferAgendaItemDialogView', () => {
  it('uses the default trigger and a loading destination state', () => {
    render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Current event"
        controller={controller({ participationsLoading: true })}
      />
    );
    expect(document.querySelector('[data-action-id="agendas.transfer.dialog.open"]')).toBeTruthy();
    expect(mocks.typeahead).not.toHaveBeenCalled();
  });

  it('renders the empty destination state', () => {
    render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Current event"
        controller={controller()}
      />
    );
    expect(screen.getByText('features.events.agenda.noEventsWithPermission')).toBeTruthy();
  });

  it('maps destinations and handles selecting and clearing an event', () => {
    const setSelectedEventId = vi.fn();
    const viewController = controller({
      setSelectedEventId,
      eventsWithPermission: [
        { id: 'event-2', title: 'Second', group: { name: 'Group' } },
        { id: 'event-3', title: 'Third', group: null },
      ],
    });
    render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Current event"
        trigger={<button type="button">Custom trigger</button>}
        controller={viewController}
      />
    );
    expect(screen.getByText('Custom trigger')).toBeTruthy();
    const props = mocks.typeahead.mock.lastCall?.[0] as any;
    expect(props.items).toHaveLength(2);
    props.onChange({ id: 'event-2' });
    props.onChange(null);
    expect(setSelectedEventId).toHaveBeenNthCalledWith(1, 'event-2');
    expect(setSelectedEventId).toHaveBeenNthCalledWith(2, '');
  });

  it('shows the transfer warning and dispatches cancel and confirmation', () => {
    const setOpen = vi.fn();
    const handleConfirmTransfer = vi.fn();
    const viewController = controller({
      setOpen,
      selectedEventId: 'event-2',
      selectedEvent: { id: 'event-2', title: 'Second' },
      eventsWithPermission: [{ id: 'event-2', title: 'Second', group: null }],
      handleConfirmTransfer,
    });
    render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Current event"
        controller={viewController}
      />
    );
    expect(screen.getByText('features.events.agenda.transferWarning')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="agendas.transfer.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="agendas.transfer.confirm"]')!);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(handleConfirmTransfer).toHaveBeenCalled();
  });

  it('shows transfer progress and disables both footer actions', () => {
    const viewController = controller({
      selectedEventId: 'event-2',
      eventsWithPermission: [{ id: 'event-2', title: 'Second', group: null }],
      transferLoading: true,
    });
    render(
      <TransferAgendaItemDialogView
        agendaItemTitle="Budget"
        currentEventTitle="Current event"
        controller={viewController}
      />
    );
    expect(screen.getByText('features.events.agenda.transferring')).toBeTruthy();
    expect(document.querySelectorAll('button:disabled')).toHaveLength(2);
  });
});
