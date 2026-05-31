// @vitest-environment jsdom

import type { MouseEventHandler, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TargetGroupEventSelector } from '@/features/amendments/ui/TargetGroupEventSelector';

const amendmentGroups = [
  {
    id: 'group-1',
    name: 'Budget Circle',
    description: 'Handles budget questions',
    member_count: 12,
    event_count: 3,
    amendment_count: 1,
  },
];

const amendmentMemberships = [
  {
    id: 'membership-1',
    status: 'active',
    user: { id: 'user-1' },
    group: { id: 'group-1' },
  },
];

const amendmentRelationships: never[] = [];
const amendmentWorkflows: never[] = [];

const amendmentEvents = [
  {
    id: 'event-1',
    title: 'Planning Assembly',
    description: 'Next planning event',
    start_date: Date.now() + 60 * 60 * 1000,
    location_name: 'Town Hall',
    participant_count: 25,
    group_id: 'group-1',
    group: { id: 'group-1' },
  },
];

vi.mock('@/zero/network/useWorkflowState', () => ({
  useWorkflowState: () => ({
    allWorkflows: amendmentWorkflows,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    allGroups: amendmentGroups,
    allGroupRelationships: amendmentRelationships,
    allGroupMemberships: amendmentMemberships,
    allEvents: amendmentEvents,
    eventsByGroup: amendmentEvents,
  }),
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: { name: string } }) => <div>{group.name}</div>,
}));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ event }: { event: { title: string } }) => <div>{event.title}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    className?: string;
  }) => (
    <a href="#" onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('TargetGroupEventSelector', () => {
  it('keeps the selected group when the parent rerenders with a new group change callback', async () => {
    const firstOnGroupSelectionChange = vi.fn();
    const secondOnGroupSelectionChange = vi.fn();
    const { rerender } = render(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={vi.fn()}
        onGroupSelectionChange={firstOnGroupSelectionChange}
        disablePortal
      />
    );

    const groupSearchInput = screen.getByPlaceholderText('Search for a group...');
    fireEvent.focus(groupSearchInput);
    fireEvent.change(groupSearchInput, { target: { value: 'Budget' } });
    fireEvent.click(await screen.findByRole('button', { name: /Budget Circle/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Budget Circle' })).toBeTruthy()
    );
    expect(screen.getByPlaceholderText('Search for an event...')).toBeTruthy();
    expect(firstOnGroupSelectionChange).toHaveBeenCalledWith('group-1');

    rerender(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={vi.fn()}
        onGroupSelectionChange={secondOnGroupSelectionChange}
        disablePortal
      />
    );

    expect(screen.getByRole('button', { name: 'Remove Budget Circle' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search for an event...')).toBeTruthy();
    expect(secondOnGroupSelectionChange).not.toHaveBeenCalledWith(null);
  });

  it('keeps the selected group in place when the event is cleared, and fully clears on group removal', async () => {
    const onSelect = vi.fn();
    const onGroupSelectionChange = vi.fn();

    render(
      <TargetGroupEventSelector
        userId="user-1"
        selectedGroupId="group-1"
        selectedEventId="event-1"
        onSelect={onSelect}
        onGroupSelectionChange={onGroupSelectionChange}
        disablePortal
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Budget Circle' })).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Remove Planning Assembly' }).length
      ).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove Planning Assembly' })[0]);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
    expect(screen.getByRole('button', { name: 'Remove Budget Circle' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search for an event...')).toBeTruthy();
    expect(onGroupSelectionChange).not.toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Budget Circle' }));

    await waitFor(() => expect(onGroupSelectionChange).toHaveBeenCalledWith(null));
    expect(screen.getByPlaceholderText('Search for a group...')).toBeTruthy();
  });
});
