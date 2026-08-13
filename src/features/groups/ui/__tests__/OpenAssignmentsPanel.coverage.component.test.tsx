/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let viewProps: any;
vi.mock('../OpenAssignmentsPanelView', () => ({
  OpenAssignmentsPanelView: (props: any) => {
    viewProps = props;
    return <div data-testid="captured-view" />;
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search, ...props }: any) => (
    <a {...props} href={`/create/event?${new URLSearchParams(search)}`}>
      {children}
    </a>
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import {
  OpenAssignmentsPanel,
  openAssignmentsPanelInternals as internals,
} from '../OpenAssignmentsPanel';

const event = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Event ${id}`,
  ...extra,
});
const assignment = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'task-1',
    kind: 'process_task',
    status: 'open',
    title: 'Task',
    description: 'Description',
    processTaskId: 'process-1',
    processTaskType: 'schedule_event',
    linkedEvent: null,
    ...extra,
  }) as any;

afterEach(cleanup);
beforeEach(() => {
  viewProps = undefined;
  vi.clearAllMocks();
});

describe('OpenAssignmentsPanel uncovered controller paths', () => {
  it('covers pure selection, filter, source, formatting, link, and badge variants', () => {
    const t = ((key: string) => key) as any;
    const events = [event('first'), event('selected'), event('linked'), event('target')];
    expect(internals.getDefaultEventId(assignment(), events, { 'task-1': 'selected' })).toBe(
      'selected'
    );
    expect(
      internals.getDefaultEventId(assignment({ linkedEvent: event('linked') }), events, {})
    ).toBe('linked');
    expect(
      internals.getDefaultEventId(assignment({ targetEvent: event('target') }), events, {})
    ).toBe('target');
    expect(internals.getDefaultEventId(assignment(), [], {})).toBe('');

    expect(
      internals.buildProcessTaskScheduleSource(assignment({ kind: 'role_renewal' }), 'g')
    ).toBeNull();
    expect(
      internals.buildProcessTaskScheduleSource(assignment({ processTaskId: '' }), 'g')
    ).toBeNull();
    expect(
      internals.buildProcessTaskScheduleSource(
        assignment({ processRunId: undefined, stepRunId: undefined, dueAt: undefined }),
        'g'
      )
    ).toMatchObject({ process_run_id: null, step_run_id: null, due_at: null });
    expect(
      internals.buildProcessTaskScheduleSource(
        assignment({ processRunId: 'run', stepRunId: 'step', dueAt: 1 }),
        'g'
      )
    ).toMatchObject({ process_run_id: 'run', step_run_id: 'step', due_at: 1 });

    expect(internals.formatDateTime(null, 'en')).toBeNull();
    expect(internals.formatDateTime(1, 'en')).toBeTruthy();
    expect(internals.getAssignmentSearchFlow(assignment({ kind: 'role_renewal' }))).toBe(
      'role-renewal-assignment-search'
    );
    expect(internals.getAssignmentSearchFlow(assignment())).toBe('delegate-assignment-search');
    expect(internals.matchesAssignmentDecisionFilter(assignment(), 'all')).toBe(true);
    expect(
      internals.matchesAssignmentDecisionFilter(
        assignment({ kind: 'delegate_election' }),
        'elections'
      )
    ).toBe(true);
    expect(
      internals.matchesAssignmentDecisionFilter(assignment({ kind: 'role_renewal' }), 'elections')
    ).toBe(true);
    expect(internals.matchesAssignmentDecisionFilter(assignment(), 'elections')).toBe(false);
    expect(internals.matchesAssignmentDecisionFilter(assignment(), 'votes')).toBe(true);
    expect(
      internals.matchesAssignmentDecisionFilter(assignment({ processTaskType: 'other' }), 'votes')
    ).toBe(false);
    expect(
      internals.buildCreateEventSearchForAssignment(assignment({ kind: 'unknown' }), 'g')
    ).toEqual({ groupId: 'g' });

    const badgeKinds = [
      assignment({ kind: 'delegate_election' }),
      assignment({ kind: 'role_renewal' }),
      assignment({ processTaskType: 'implementation_evaluation' }),
      assignment({ processTaskType: 'support_confirmation' }),
      assignment(),
      assignment({ kind: 'unknown' }),
    ];
    const statuses = ['completed', 'scheduled', 'open'].map(status => assignment({ status }));
    render(
      <>
        {badgeKinds.map((item, index) => (
          <span key={index}>{internals.getAssignmentTypeBadge(t, item)}</span>
        ))}
        {statuses.map((item, index) => (
          <span key={`s${index}`}>{internals.getStatusBadge(t, item)}</span>
        ))}
      </>
    );
    expect(document.body.textContent).toContain('implementationEvaluation');
    expect(document.body.textContent).toContain('supportConfirmation');

    cleanup();
    render(
      <>
        <internals.EventTagLink
          event={{ id: 'e', title: null }}
          label="Event"
          data-action-id="event"
        />
        <internals.GroupInlineLink group={undefined} fallback="Fallback" data-action-id="group" />
        <internals.GroupInlineLink
          group={{ id: 'g', name: '' }}
          fallback="Named fallback"
          data-action-id="group"
        />
        <internals.DelegateAssignmentDescription
          assignment={assignment({
            kind: 'delegate_election',
            sourceGroup: undefined,
            targetGroup: undefined,
            seatCount: undefined,
          })}
        />
      </>
    );
    expect(document.body.textContent).toContain('generated.inline.0102');
    expect(screen.getByText('Fallback')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Named fallback' })).toBeTruthy();
  });

  it('exercises captured controller guards, dialog branches, filters, and every column cell', async () => {
    const onRole = vi.fn().mockResolvedValue(undefined);
    const onDelegate = vi.fn().mockResolvedValue(undefined);
    const onProcess = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    const items = [
      assignment(),
      assignment({ id: 'role', kind: 'role_renewal', status: 'open', processTaskId: undefined }),
      assignment({
        id: 'delegate',
        kind: 'delegate_election',
        seatCount: undefined,
        completedSeatCount: undefined,
        scheduledSeatCount: undefined,
        remainingSeatCount: 1,
        sourceGroup: undefined,
        targetGroup: undefined,
        targetEvent: {
          ...event('target'),
          start_date: now + 7_200_000,
          delegate_election_mode: 'list',
        },
      }),
      assignment({
        id: 'implementation',
        processTaskType: 'implementation_evaluation',
        dueAt: now + 86_400_000,
      }),
      assignment({ id: 'confirmation', processTaskType: 'support_confirmation' }),
      assignment({ id: 'agenda', amendment: { id: 'amendment', title: 'Amendment' } }),
      assignment({
        id: 'agenda-blocked',
        dueAt: now - 1,
        amendment: { id: 'blocked-amendment', title: 'Blocked' },
      }),
      assignment({ id: 'unknown', kind: 'unknown', status: 'open', processTaskId: undefined }),
    ];
    render(
      <OpenAssignmentsPanel
        groupId="g"
        groupName={null}
        assignments={items}
        availableEvents={[
          event('e', { title: null, start_date: now + 3_600_000 }),
          event('matching', { title: 'Matching Event', start_date: now + 4_000_000 }),
        ]}
        onScheduleRoleRenewal={onRole}
        onScheduleDelegateElection={onDelegate}
        onScheduleProcessTask={onProcess}
      />
    );

    await act(() => viewProps.handleCreateAssignmentElection());
    viewProps.closeEventDialog(true);

    const filters = render(<>{viewProps.assignmentFilters}</>);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'features.groups.memberships.openAssignments.status.completed',
      })
    );
    filters.unmount();

    const columns = viewProps.assignmentColumns;
    for (const item of items) {
      for (const column of columns) {
        if (column.cell) {
          const node = column.cell({
            row: {
              original: { assignment: item, remainingSeatCount: item.remainingSeatCount ?? 0 },
            },
          });
          const rendered = render(<>{node}</>);
          if (column.id === 'action' && item.id === 'task-1') {
            fireEvent.click(
              rendered.container.querySelector(
                '[data-action-id="groups.assignments.process-task.schedule"]'
              )!
            );
          }
          if (column.id === 'action' && (item.id === 'agenda' || item.id === 'agenda-blocked')) {
            fireEvent.click(
              rendered.container.querySelector(
                '[data-action-id="groups.assignments.agenda-preview.open"]'
              )!
            );
          }
          rendered.unmount();
        }
      }
    }

    act(() => viewProps.openEventDialog(items[2]));
    expect(viewProps.eventDialogEventId).toBe('e');
    act(() => viewProps.setEventDialogSearchQuery('matching'));
    expect(viewProps.filteredEventDialogEvents).toHaveLength(1);
    act(() => viewProps.setEventDialogSearchQuery(''));
    await act(() => viewProps.handleCreateAssignmentElection());
    expect(onDelegate).toHaveBeenCalled();

    expect(onRole).not.toHaveBeenCalled();

    cleanup();
    render(
      <OpenAssignmentsPanel
        groupId="g"
        groupName={null}
        assignments={[assignment()]}
        availableEvents={[]}
        onScheduleRoleRenewal={onRole}
        onScheduleDelegateElection={onDelegate}
        onScheduleProcessTask={onProcess}
      />
    );
    const actionColumn = viewProps.assignmentColumns.find((column: any) => column.id === 'action');
    render(
      <>
        {actionColumn.cell({
          row: { original: { assignment: assignment(), remainingSeatCount: 0 } },
        })}
      </>
    );
    expect(document.body.textContent).toContain('There is currently no upcoming');
  });
});
