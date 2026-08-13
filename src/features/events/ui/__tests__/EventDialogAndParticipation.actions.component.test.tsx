/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CancelEventDialogView, type CancelEventDialogViewProps } from '../CancelEventDialogView';
import { EventParticipationButton } from '../EventParticipationButton';
import { EventSubscribeButtonView } from '../EventSubscribeButtonView';

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/form', async () => {
  const { createContext, useContext } = await import('react');
  const SelectContext = createContext<(value: string) => void>(() => undefined);
  return {
    FormControlCheckbox: ({
      checked,
      onCheckedChange,
      ...props
    }: {
      checked?: boolean;
      onCheckedChange: () => void;
      'data-action-id'?: string;
      'aria-label'?: string;
    }) => <input type="checkbox" checked={checked} onChange={onCheckedChange} {...props} />,
    FormControlLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    FormControlSelect: ({
      children,
      onValueChange,
      ...props
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
      'data-action-id'?: string;
    }) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
      'data-action-id'?: string;
    }) => {
      const onValueChange = useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: ({ placeholder }: { placeholder: ReactNode }) => <>{placeholder}</>,
    FormControlTextarea: (props: Record<string, unknown>) => <textarea {...props} />,
  };
});

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

const t = (key: string) => key;

function cancelProps(
  overrides: Partial<CancelEventDialogViewProps> = {}
): CancelEventDialogViewProps {
  return {
    agendaItems: [{ id: 'item-1', title: 'Budget' }],
    availableEvents: [{ id: 'event-2', start_date: null, title: 'Next meeting' }],
    cancelEvent: vi.fn(),
    eventId: 'event-1',
    groupId: 'group-1',
    handleCancel: vi.fn(),
    handleItemToggle: vi.fn(),
    handleSelectAll: vi.fn(),
    isLoading: false,
    onOpenChange: vi.fn(),
    open: true,
    reason: 'Cancelled for a reason',
    selectedItems: ['item-1'],
    setReason: vi.fn(),
    setSelectedItems: vi.fn(),
    setTargetEventId: vi.fn(),
    t,
    targetEventId: '',
    ...overrides,
  };
}

describe('event cancellation and participation action contracts', () => {
  it('selects reassignment items and target before cancelling through stable actions', () => {
    const props = cancelProps();
    const { container } = render(<CancelEventDialogView {...props} />);

    fireEvent.click(container.querySelector('[data-action-id="events.cancel.select-all-items"]')!);
    expect(props.handleSelectAll).toHaveBeenCalledOnce();
    fireEvent.click(container.querySelector('[data-action-id="events.cancel.toggle-item"]')!);
    expect(props.handleItemToggle).toHaveBeenCalledWith('item-1');
    expect(
      container.querySelector('[data-action-id="events.cancel.target.select"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-action-id="events.cancel.target.open"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-action-id="events.cancel.target.choose"]')!);
    expect(props.setTargetEventId).toHaveBeenCalledWith('event-2');

    fireEvent.click(container.querySelector('[data-action-id="events.cancel.close"]')!);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(container.querySelector('[data-action-id="events.cancel.confirm"]')!);
    expect(props.handleCancel).toHaveBeenCalledOnce();
  });

  it('renders the empty, invalid cancellation form without reassignment controls', () => {
    const setReason = vi.fn();
    const { container } = render(
      <CancelEventDialogView
        {...cancelProps({ agendaItems: [], reason: '   ', selectedItems: [], setReason })}
      />
    );

    const textarea = container.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'new reason' } });
    expect(setReason).toHaveBeenCalledWith('new reason');
    expect(container.querySelector('[data-action-id="events.cancel.select-all-items"]')).toBeNull();
    expect(container.querySelector('[data-action-id="events.cancel.target.select"]')).toBeNull();
    expect(
      (container.querySelector('[data-action-id="events.cancel.confirm"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('describes amendment and election items, target dates, and loading state', () => {
    const props = cancelProps({
      agendaItems: [
        { amendment: { title: 'Amendment A' }, id: 'amendment', title: 'Amendment' },
        { election: { role: { name: 'Chair' } }, id: 'election', title: 'Election' },
        { election: {}, id: 'election-no-role', title: 'Election without role' },
      ],
      availableEvents: [
        { id: 'event-2', start_date: '2026-08-12T12:00:00Z', title: 'Next meeting' },
      ],
      isLoading: true,
      selectedItems: ['amendment'],
      targetEventId: 'event-2',
    });
    const { container, rerender } = render(<CancelEventDialogView {...props} />);

    expect(container.textContent).toContain('features.events.cancel.reassign.amendment');
    expect(container.textContent).toContain('Amendment A');
    expect(container.textContent).toContain('features.events.cancel.reassign.election');
    expect(container.textContent).toContain('Chair');
    expect(container.textContent).toContain('Next meeting');
    expect(container.textContent).toContain('common.selectAll');
    expect(container.textContent).toContain('common.loading.general');
    expect(
      (container.querySelector('[data-action-id="events.cancel.confirm"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);

    rerender(
      <CancelEventDialogView
        {...props}
        availableEvents={[]}
        isLoading={false}
        targetEventId="missing-event"
      />
    );
    expect(container.textContent).toContain('features.events.cancel.reassign.noEvents');
  });

  it('maps invitation, request, active membership and join states to explicit handlers', () => {
    const onAcceptInvitation = vi.fn();
    const onLeave = vi.fn();
    const onRequestParticipation = vi.fn();
    const common = { isLoading: false, onAcceptInvitation, onLeave, onRequestParticipation };
    const view = render(
      <EventParticipationButton
        {...common}
        hasRequested={false}
        isInvited
        isParticipant={false}
        status="invited"
      />
    );

    let action = view.container.querySelector('[data-action-id]') as HTMLButtonElement;
    expect(action.getAttribute('data-action-id')).toBe('events.participation.accept-invitation');
    fireEvent.click(action);
    expect(onAcceptInvitation).toHaveBeenCalledOnce();

    view.rerender(
      <EventParticipationButton
        {...common}
        hasRequested
        isInvited={false}
        isParticipant={false}
        status="requested"
      />
    );
    action = view.container.querySelector('[data-action-id]') as HTMLButtonElement;
    expect(action.getAttribute('data-action-id')).toBe('events.participation.cancel-request');
    fireEvent.click(action);

    view.rerender(
      <EventParticipationButton
        {...common}
        hasRequested={false}
        isInvited={false}
        isParticipant
        status="member"
      />
    );
    action = view.container.querySelector('[data-action-id]') as HTMLButtonElement;
    expect(action.getAttribute('data-action-id')).toBe('events.participation.leave');
    fireEvent.click(action);

    view.rerender(
      <EventParticipationButton
        {...common}
        hasRequested={false}
        isInvited={false}
        isParticipant={false}
        status={null}
      />
    );
    action = view.container.querySelector('[data-action-id]') as HTMLButtonElement;
    expect(action.getAttribute('data-action-id')).toBe('events.participation.request');
    fireEvent.click(action);
    expect(onLeave).toHaveBeenCalledTimes(2);
    expect(onRequestParticipation).toHaveBeenCalledOnce();
  });

  it('toggles event subscription and blocks repeated loading clicks', () => {
    const handleClick = vi.fn();
    const view = render(
      <EventSubscribeButtonView
        eventId="event-1"
        handleClick={handleClick}
        isLoading={false}
        isSubscribed={false}
        onSubscribeChange={vi.fn()}
        toggleSubscribe={vi.fn()}
      />
    );
    const action = view.container.querySelector('[data-action-id]') as HTMLButtonElement;
    expect(action.getAttribute('data-action-id')).toBe('events.subscribe.toggle');
    fireEvent.click(action);
    expect(handleClick).toHaveBeenCalledOnce();
    view.rerender(
      <EventSubscribeButtonView
        eventId="event-1"
        handleClick={handleClick}
        isLoading
        isSubscribed
        onSubscribeChange={vi.fn()}
        toggleSubscribe={vi.fn()}
      />
    );
    expect((view.container.querySelector('[data-action-id]') as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
