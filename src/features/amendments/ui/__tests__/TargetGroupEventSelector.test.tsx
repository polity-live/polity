// @vitest-environment jsdom

import type { MouseEventHandler, ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TargetGroupEventSelector } from '@/features/amendments/ui/TargetGroupEventSelector';

const amendmentGroups = [
  {
    id: 'group-start',
    name: 'Budget Circle',
    description: 'Start group',
    member_count: 12,
    event_count: 2,
    amendment_count: 1,
  },
  {
    id: 'group-mid',
    name: 'Regional Council',
    description: 'Mid group',
    member_count: 8,
    event_count: 1,
    amendment_count: 0,
  },
  {
    id: 'group-target',
    name: 'Parliament',
    description: 'Target group',
    member_count: 5,
    event_count: 1,
    amendment_count: 0,
  },
];

const amendmentMemberships = [
  {
    id: 'membership-1',
    status: 'active',
    user: { id: 'user-1' },
    group: { id: 'group-start' },
    membership_roles: [],
  },
];

const amendmentRelationships = [
  {
    id: 'rel-start-mid',
    network_link_id: 'link-start-mid',
    network_link_right_id: 'right-start-mid',
    group_id: 'group-start',
    related_group_id: 'group-mid',
    relationship_type: 'child',
    structural_relation: 'parent_child',
    with_right: 'amendmentRight',
    status: 'accepted',
    initiator_group_id: null,
    created_at: Date.now(),
    membership_mode: 'all_members',
    membership_direction: null,
    membership_role_id: null,
    membership_source_group_ids: null,
    relationship_direction: 'forward',
    right_direction: 'forward',
    group: { id: 'group-start', name: 'Budget Circle' },
    related_group: { id: 'group-mid', name: 'Regional Council' },
  },
  {
    id: 'rel-mid-target',
    network_link_id: 'link-mid-target',
    network_link_right_id: 'right-mid-target',
    group_id: 'group-mid',
    related_group_id: 'group-target',
    relationship_type: 'child',
    structural_relation: 'parent_child',
    with_right: 'amendmentRight',
    status: 'accepted',
    initiator_group_id: null,
    created_at: Date.now(),
    membership_mode: 'all_members',
    membership_direction: null,
    membership_role_id: null,
    membership_source_group_ids: null,
    relationship_direction: 'forward',
    right_direction: 'forward',
    group: { id: 'group-mid', name: 'Regional Council' },
    related_group: { id: 'group-target', name: 'Parliament' },
  },
] as never[];

const amendmentWorkflows: Record<string, unknown>[] = [];
const amendmentEvents = [
  {
    id: 'event-start',
    title: 'Budget Assembly',
    start_date: Date.now() + 60 * 60 * 1000,
    end_date: Date.now() + 2 * 60 * 60 * 1000,
    location_name: 'Town Hall',
    participant_count: 25,
    group_id: 'group-start',
    group: { id: 'group-start' },
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
  }),
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: { name: string } }) => <div>{group.name}</div>,
}));

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({ event }: { event: { title: string } }) => <div>{event.title}</div>,
}));

vi.mock('@/features/network/ui/UserNetworkFlow', () => ({
  UserNetworkFlow: ({
    onGroupClick,
  }: {
    onGroupClick?: (groupId: string, groupData: { id: string; name: string }) => void;
  }) => (
    <button
      onClick={() => onGroupClick?.('group-start', { id: 'group-start', name: 'Budget Circle' })}
    >
      Select graph start
    </button>
  ),
}));

vi.mock('@/features/network/ui/GroupNetworkFlow', () => ({
  GroupNetworkFlow: ({
    groupId,
    onGroupClick,
  }: {
    groupId: string;
    onGroupClick?: (groupId: string, groupData: { id: string; name: string }) => void;
  }) => (
    <div>
      <div>{`Rooted graph: ${groupId}`}</div>
      <button
        onClick={() => onGroupClick?.('group-mid', { id: 'group-mid', name: 'Regional Council' })}
      >
        Select graph target mid
      </button>
      <button
        onClick={() => onGroupClick?.('group-target', { id: 'group-target', name: 'Parliament' })}
      >
        Select graph target final
      </button>
    </div>
  ),
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

function hasButtonText(text: string) {
  return screen
    .getAllByRole('button')
    .some(element => element.textContent?.replace(/\s+/g, ' ').includes(text));
}

describe('TargetGroupEventSelector', () => {
  it('keeps the selected start group when choosing a target from dropdown', async () => {
    const onSelect = vi.fn();

    render(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={onSelect}
        allowGroupWithoutEvent
        disablePortal
      />
    );

    const targetSearchInput = await screen.findByPlaceholderText('Zielgruppe suchen...');
    fireEvent.focus(targetSearchInput);
    fireEvent.change(targetSearchInput, { target: { value: 'Region' } });

    await waitFor(() => expect(hasButtonText('Regional Council')).toBe(true));
    fireEvent.keyDown(targetSearchInput, { key: 'Enter' });

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceGroupId: 'group-start',
          groupId: 'group-mid',
        })
      )
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Budget Circle' })).toBeTruthy()
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Regional Council' })).toBeTruthy()
    );
    expect(screen.getByText('Ziel-Event')).toBeTruthy();
  });

  it('shows only amendment-right targets reachable from the selected start group', async () => {
    render(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={vi.fn()}
        allowGroupWithoutEvent
        disablePortal
      />
    );

    const targetSearchInput = await screen.findByPlaceholderText('Zielgruppe suchen...');

    fireEvent.focus(targetSearchInput);
    fireEvent.change(targetSearchInput, { target: { value: 'Region' } });
    await waitFor(() => expect(hasButtonText('Regional Council')).toBe(true));

    fireEvent.change(targetSearchInput, { target: { value: 'Parlia' } });
    await waitFor(() => expect(hasButtonText('Parliament')).toBe(true));

    fireEvent.change(targetSearchInput, { target: { value: 'Budget' } });
    await waitFor(() => expect(hasButtonText('Budget Circle')).toBe(false));
  });

  it('can include the selected start group as a target when enabled', async () => {
    const onSelect = vi.fn();

    render(
      <TargetGroupEventSelector
        userId="user-1"
        onSelect={onSelect}
        allowGroupWithoutEvent
        allowSourceGroupAsTarget
        disablePortal
      />
    );

    const targetSearchInput = await screen.findByPlaceholderText('Zielgruppe suchen...');

    fireEvent.focus(targetSearchInput);
    fireEvent.change(targetSearchInput, { target: { value: 'Budget' } });

    await waitFor(() => expect(hasButtonText('Budget Circle')).toBe(true));
    fireEvent.keyDown(targetSearchInput, { key: 'Enter' });

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceGroupId: 'group-start',
          groupId: 'group-start',
          pathWithEvents: [
            expect.objectContaining({
              groupId: 'group-start',
            }),
          ],
        })
      )
    );
  });

  it('selects the start group from the graph, reroots, and keeps the target typeahead in sync', async () => {
    const onSelect = vi.fn();
    amendmentMemberships.push({
      id: 'membership-2',
      status: 'active',
      user: { id: 'user-1' },
      group: { id: 'group-mid' },
      membership_roles: [],
    });

    try {
      render(
        <TargetGroupEventSelector
          userId="user-1"
          onSelect={onSelect}
          allowGroupWithoutEvent
          disablePortal
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Select graph start' }));

      await waitFor(() => expect(screen.getByText('Rooted graph: group-start')).toBeTruthy());

      fireEvent.click(screen.getByRole('button', { name: 'Select graph target mid' }));

      await waitFor(() =>
        expect(onSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceGroupId: 'group-start',
            groupId: 'group-mid',
          })
        )
      );

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Remove Regional Council' })).toBeTruthy()
      );
      expect(screen.getByText('Rooted graph: group-start')).toBeTruthy();
    } finally {
      amendmentMemberships.pop();
    }
  });

  it('derives the final target group from the selected workflow instead of asking for a manual target', async () => {
    amendmentWorkflows.push({
      id: 'workflow-reading',
      group_id: 'group-target',
      start_group_id: 'group-mid',
      status: 'active',
      name: 'Reading Workflow',
      group: { id: 'group-target', name: 'Parliament' },
      steps: [
        {
          id: 'workflow-step-final',
          group_id: 'group-target',
          label: '2. Lesung',
          order_index: 0,
          step_kind: 'group_vote',
          selection_mode: 'default_target_workflow',
          merge_strategy: null,
          event_rule: null,
          auto_task_on_missing_event: true,
          target_workflow_id: null,
          group: { id: 'group-target', name: 'Parliament' },
        },
      ],
    });

    try {
      const onSelect = vi.fn();

      render(
        <TargetGroupEventSelector
          userId="user-1"
          onSelect={onSelect}
          allowGroupWithoutEvent
          disablePortal
          selectedPathMode="workflow"
          selectedWorkflowId="workflow-reading"
        />
      );

      await waitFor(() => expect(screen.queryByPlaceholderText('Zielgruppe suchen...')).toBeNull());
      await waitFor(() => expect(screen.getByText('Abgeleitete Zielgruppe')).toBeTruthy());
      await waitFor(() =>
        expect(onSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 'group-target',
            pathMode: 'workflow',
            workflowId: 'workflow-reading',
          })
        )
      );
    } finally {
      amendmentWorkflows.length = 0;
    }
  });
});
