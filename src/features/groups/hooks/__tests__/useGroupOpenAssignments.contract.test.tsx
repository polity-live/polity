/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  roles: [] as Record<string, any>[],
  rolesLoading: false,
  events: [] as Record<string, any>[] | null,
  allocations: [] as Record<string, any>[] | null,
  processTasks: [] as Record<string, any>[] | null,
  allocationsResult: { type: 'complete' } as Record<string, any>,
  processTasksResult: { type: 'complete' } as Record<string, any>,
  builtAssignments: [] as Record<string, any>[],
  buildOpenAssignments: vi.fn(),
  remainingSeats: vi.fn((assignment: Record<string, any>) => assignment.remainingSeatCount ?? 0),
  normalizeMode: vi.fn(() => 'list'),
  delegateWithinWindow: true,
  processWithinWindow: true,
  amendmentTargetOpen: true,
  delegateSearch: {} as Record<string, any>,
  processSearch: {} as Record<string, any>,
  schedulingLabel: null as string | null,
  attach: vi.fn(async (..._args: any[]) => undefined),
  completeTask: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { kind: string }) =>
    query.kind === 'allocations'
      ? [mocks.allocations, mocks.allocationsResult]
      : [mocks.processTasks, mocks.processTasksResult],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => `t:${key}`,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translate:${key}`,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { info: mocks.toastInfo, success: mocks.toastSuccess },
}));
vi.mock('@/features/elections/logic/electionMode', () => ({
  normalizeDelegateElectionMode: mocks.normalizeMode,
}));
vi.mock('@/features/amendments/logic/attachProcessTaskToEvent', () => ({
  attachProcessTaskToEvent: mocks.attach,
}));
vi.mock('@/features/amendments/logic/processTaskEventScheduling', () => ({
  buildCreateEventSearchFromProcessTask: () => mocks.processSearch,
  getProcessTaskSchedulingWindow: (value: unknown) => value,
  getSchedulingWindowDisplayLabel: () => mocks.schedulingLabel,
  isEventWithinSchedulingWindow: () => mocks.processWithinWindow,
}));
vi.mock('@/features/amendments/logic/amendmentTargetEventEligibility', () => ({
  isAmendmentTargetEventOpen: () => mocks.amendmentTargetOpen,
}));
vi.mock('@/features/groups/logic/delegateElectionScheduling', () => ({
  buildCreateEventSearchFromDelegateElectionAssignment: () => mocks.delegateSearch,
  isEventWithinDelegateElectionSchedulingWindow: () => mocks.delegateWithinWindow,
}));
vi.mock('@/features/groups/logic/openAssignments', () => ({
  buildOpenAssignments: (args: unknown) => {
    mocks.buildOpenAssignments(args);
    return mocks.builtAssignments;
  },
  getRemainingSeatCount: mocks.remainingSeats,
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ completeProcessTaskWithEvent: mocks.completeTask }),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    events: { delegateAllocationsBySourceGroup: () => ({ kind: 'allocations' }) },
    amendments: { processTasksByGroupForAssignments: () => ({ kind: 'process-tasks' }) },
  },
}));
vi.mock('@/zero/events/useEventState', () => ({
  useGroupEventsForCalendar: () => ({ events: mocks.events }),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: (id: string) => ({ group: { id, name: 'Group' } }),
  useGroupRoles: () => ({ roles: mocks.roles, isLoading: mocks.rolesLoading }),
}));

import { useGroupOpenAssignments } from '../useGroupOpenAssignments';

const NOW = 2_000_000;

function event(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    status: 'planned',
    start_date: NOW + 1_000,
    end_date: NOW + 2_000,
    amendment_deadline: NOW + 500,
    group_id: 'group-1',
    ...overrides,
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment-1',
    kind: 'delegate_election',
    status: 'open',
    title: 'Assignment',
    description: 'Description',
    remainingSeatCount: 2,
    seatCount: 3,
    targetEvent: {
      id: 'target-event',
      group: { id: 'target-group' },
      delegate_election_mode: 'single',
    },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  mocks.roles = [];
  mocks.rolesLoading = false;
  mocks.events = [event('event-1')];
  mocks.allocations = [];
  mocks.processTasks = [];
  mocks.allocationsResult = { type: 'complete' };
  mocks.processTasksResult = { type: 'complete' };
  mocks.builtAssignments = [];
  mocks.delegateWithinWindow = true;
  mocks.processWithinWindow = true;
  mocks.amendmentTargetOpen = true;
  mocks.delegateSearch = {};
  mocks.processSearch = {};
  mocks.schedulingLabel = null;
  mocks.attach.mockImplementation(async () => undefined);
});

describe('useGroupOpenAssignments localization and event normalization', () => {
  it('passes normalized query inputs into the assignment builder', () => {
    mocks.allocations = null;
    mocks.processTasks = null;
    const current = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    expect(current.group).toEqual({ id: 'group-1', name: 'Group' });
    expect(mocks.buildOpenAssignments).toHaveBeenCalledWith({
      currentGroupId: 'group-1',
      allocations: [],
      roles: [],
      processTasks: [],
    });
  });

  it('preserves non-process assignments and localizes every generated process-task variant', () => {
    mocks.builtAssignments = [
      assignment(),
      assignment({
        id: 'implementation',
        kind: 'process_task',
        processTaskType: 'implementation_evaluation',
        title: 'Umsetzung evaluieren: Amendment',
        description: 'Plane die Umsetzungsprüfung für Amendment in Council.',
        amendment: { title: 'Amendment' },
        processTaskMetadata: { groupName: 'Council' },
        dueAt: NOW,
      }),
      assignment({
        id: 'support',
        kind: 'process_task',
        processTaskType: 'support_confirmation',
        title: 'Confirm support: Metadata amendment',
        description: 'This group needs to confirm its support for Metadata amendment again.',
        amendment: null,
        processTaskMetadata: { amendmentTitle: 'Metadata amendment', groupName: 'Council' },
        dueAt: Number.NaN,
      }),
      assignment({
        id: 'schedule',
        kind: 'process_task',
        processTaskType: 'schedule_amendment_vote',
        title: 'Event planen: Fallback title',
        description: 'No eligible event is selected yet for Council.',
        amendment: null,
        processTaskMetadata: { groupName: 'Council' },
        dueAt: 0,
      }),
      assignment({
        id: 'empty',
        kind: 'process_task',
        processTaskType: null,
        title: '',
        description: '',
        amendment: null,
        processTaskMetadata: null,
      }),
      assignment({
        id: 'custom',
        kind: 'process_task',
        processTaskType: 'support_confirmation',
        title: 'Keep custom title',
        description: 'Keep custom description',
        processTaskMetadata: [],
      }),
    ];

    const current = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    expect(current.openAssignments[0]).toBe(mocks.builtAssignments[0]);
    expect(current.openAssignments.find(item => item.id === 'implementation')).toMatchObject({
      title:
        't:features.groups.memberships.openAssignments.generated.implementationEvaluationTitle',
      description:
        't:features.groups.memberships.openAssignments.generated.implementationEvaluationDescription',
      dueAt: NOW,
    });
    expect(current.openAssignments.find(item => item.id === 'support')?.title).toContain(
      'supportConfirmationTitle'
    );
    expect(Number.isNaN(current.openAssignments.find(item => item.id === 'support')?.dueAt)).toBe(
      true
    );
    expect(current.openAssignments.find(item => item.id === 'schedule')?.description).toContain(
      'scheduleAmendmentVoteDescription'
    );
    expect(current.openAssignments.find(item => item.id === 'empty')?.title).toContain(
      'scheduleAmendmentVoteTitle'
    );
    expect(current.openAssignments.find(item => item.id === 'custom')).toMatchObject({
      title: 'Keep custom title',
      description: 'Keep custom description',
    });
  });

  it('recognizes both languages for all generated title and description templates', () => {
    mocks.builtAssignments = [
      assignment({
        id: 'implementation-en',
        kind: 'process_task',
        processTaskType: 'implementation_evaluation',
        title: 'Review implementation: Amendment',
        description: 'Plan the implementation review for Amendment in Council.',
        amendment: { title: 'Amendment' },
        processTaskMetadata: { groupName: 'Council' },
      }),
      assignment({
        id: 'support-de',
        kind: 'process_task',
        processTaskType: 'support_confirmation',
        title: 'Unterstützung bestätigen: Amendment',
        description: 'Diese Gruppe muss ihre Unterstützung für Amendment erneut bestätigen.',
        amendment: { title: 'Amendment' },
        processTaskMetadata: { groupName: 'Council' },
      }),
      assignment({
        id: 'schedule-en',
        kind: 'process_task',
        processTaskType: 'schedule_amendment_vote',
        title: 'Schedule amendment vote for Council',
        description: 'Für Amendment fehlt noch ein passendes Event in Council.',
        amendment: { title: 'Amendment' },
        processTaskMetadata: { groupName: 'Council' },
      }),
      assignment({
        id: 'invalid-metadata',
        kind: 'process_task',
        title: 'Custom',
        description: 'Custom',
        amendment: null,
        processTaskMetadata: 'invalid',
      }),
    ];
    const items = renderHook(() => useGroupOpenAssignments('group-1')).result.current
      .openAssignments;
    expect(items.slice(0, 3).every(item => item.title.startsWith('t:'))).toBe(true);
  });

  it('filters cancelled, past, and id-less events and normalizes nullable fields', () => {
    mocks.events = [
      event('', {}),
      event('cancelled', { status: 'cancelled' }),
      event('past-end', { end_date: NOW - 1 }),
      event('past-start', { end_date: null, start_date: NOW - 1 }),
      event('no-dates', { end_date: null, start_date: null }),
      event('future-start', {
        title: undefined,
        status: undefined,
        start_date: NOW + 1,
        end_date: null,
        amendment_deadline: undefined,
        group_id: undefined,
      }),
      event('future-no-start', { start_date: null, end_date: NOW + 10 }),
      event('future-end'),
    ];
    const available = renderHook(() => useGroupOpenAssignments('group-1')).result.current
      .availableEvents;
    expect(available.map(item => item.id)).toEqual([
      'future-start',
      'future-no-start',
      'future-end',
    ]);
    expect(available[0]).toEqual({
      id: 'future-start',
      title: null,
      status: null,
      start_date: NOW + 1,
      end_date: null,
      amendment_deadline: null,
      group_id: null,
    });

    mocks.events = null;
    expect(
      renderHook(() => useGroupOpenAssignments('group-1')).result.current.availableEvents
    ).toEqual([]);
  });
});

describe('useGroupOpenAssignments scheduling actions', () => {
  it('validates role and event existence', async () => {
    const { result } = renderHook(() => useGroupOpenAssignments('group-1'));
    await expect(
      result.current.scheduleRoleRenewal(assignment({ roleId: null }), 'event-1')
    ).rejects.toThrow('Rolle');
    await expect(
      result.current.scheduleRoleRenewal(assignment({ roleId: 'missing' }), 'event-1')
    ).rejects.toThrow('gültige Veranstaltung');

    mocks.roles = [{ id: 'role-1', elections: [] }];
    const missingEvent = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(
      missingEvent.scheduleRoleRenewal(assignment({ roleId: 'role-1' }), 'missing')
    ).rejects.toThrow('gültige Veranstaltung');
  });

  it('detects existing role-election links and otherwise navigates', async () => {
    mocks.roles = [
      {
        id: 'role-1',
        elections: [
          { agenda_item: null },
          { agenda_item: { event: null } },
          { agenda_item: { event: { id: 'event-1' } } },
        ],
      },
    ];
    const linked = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await act(() => linked.scheduleRoleRenewal(assignment({ roleId: 'role-1' }), 'event-1'));
    expect(mocks.toastInfo).toHaveBeenCalledOnce();
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.roles = [{ id: 'role-1', elections: null }];
    const unlinked = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await act(() => unlinked.scheduleRoleRenewal(assignment({ roleId: 'role-1' }), 'event-1'));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/create/agenda-item',
      search: expect.objectContaining({ eventId: 'event-1', assignmentId: 'assignment-1' }),
    });
  });

  it('validates delegate target and local event existence', async () => {
    const current = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(
      current.scheduleDelegateElection(assignment({ targetEvent: null }), 'event-1')
    ).rejects.toThrow('Ziel-Event');
    await expect(
      current.scheduleDelegateElection(
        assignment({ targetEvent: { id: 'target', group: null } }),
        'event-1'
      )
    ).rejects.toThrow('Ziel-Event');
    await expect(current.scheduleDelegateElection(assignment(), 'missing')).rejects.toThrow(
      'gültige Veranstaltung'
    );
  });

  it('reports both delegate scheduling-window error fallbacks', async () => {
    mocks.delegateWithinWindow = false;
    mocks.schedulingLabel = 'Window label';
    mocks.delegateSearch = {
      minStartDate: '2026-01-01',
      minStartTime: '10:00',
      maxStartDate: '2026-01-02',
      maxStartTime: '11:00',
    };
    const labelled = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(labelled.scheduleDelegateElection(assignment(), 'event-1')).rejects.toThrow(
      'Window label'
    );

    mocks.schedulingLabel = null;
    mocks.delegateSearch = {};
    const fallback = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(fallback.scheduleDelegateElection(assignment(), 'event-1')).rejects.toThrow(
      'schedulingOutsideTaskWindow'
    );
  });

  it('skips filled delegate assignments and navigates with explicit or normalized modes', async () => {
    const current = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await act(() =>
      current.scheduleDelegateElection(assignment({ remainingSeatCount: 0 }), 'event-1')
    );
    await act(() =>
      current.scheduleDelegateElection(
        assignment({ remainingSeatCount: 1, seatCount: null }),
        'event-1'
      )
    );
    expect(mocks.toastInfo).toHaveBeenCalledTimes(2);

    await act(() => current.scheduleDelegateElection(assignment(), 'event-1', 'single'));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/create/agenda-item',
      search: expect.objectContaining({ electionMode: 'single', targetEventId: 'target-event' }),
    });

    await act(() => current.scheduleDelegateElection(assignment(), 'event-1'));
    expect(mocks.normalizeMode).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: '/create/agenda-item',
      search: expect.objectContaining({ electionMode: 'list' }),
    });
  });

  it('validates process-task, event, deadline, and scheduling window', async () => {
    const current = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(
      current.scheduleProcessTask(assignment({ processTaskId: null }), 'event-1')
    ).rejects.toThrow('Prozessauftrag');
    await expect(
      current.scheduleProcessTask(assignment({ processTaskId: 'missing' }), 'event-1')
    ).rejects.toThrow('gültige Veranstaltung');

    mocks.processTasks = null;
    const withoutTasks = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(
      withoutTasks.scheduleProcessTask(assignment({ processTaskId: 'missing' }), 'event-1')
    ).rejects.toThrow('gültige Veranstaltung');

    mocks.processTasks = [{ id: 'task-1' }];
    const task = assignment({ processTaskId: 'task-1' });
    const missingEvent = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(missingEvent.scheduleProcessTask(task, 'missing')).rejects.toThrow(
      'gültige Veranstaltung'
    );

    mocks.amendmentTargetOpen = false;
    const closed = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(closed.scheduleProcessTask(task, 'event-1')).rejects.toThrow('abgelaufen');

    mocks.amendmentTargetOpen = true;
    mocks.processWithinWindow = false;
    mocks.schedulingLabel = 'Process window';
    mocks.processSearch = {
      minStartDate: '2026-01-01',
      minStartTime: '10:00',
      maxStartDate: '2026-01-02',
      maxStartTime: '11:00',
    };
    const outside = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(outside.scheduleProcessTask(task, 'event-1')).rejects.toThrow('Process window');

    mocks.schedulingLabel = null;
    mocks.processSearch = {};
    const fallback = renderHook(() => useGroupOpenAssignments('group-1')).result.current;
    await expect(fallback.scheduleProcessTask(task, 'event-1')).rejects.toThrow(
      'außerhalb des erlaubten Zeitfensters'
    );
  });

  it('attaches process tasks with each amendment and description fallback', async () => {
    const variants = [
      {
        task: {
          id: 'process',
          group_id: 'group-1',
          due_at: NOW + 1,
          process_run_id: 'run',
          step_run_id: 'step',
          metadata: {},
          process_run: { amendment: { title: 'Process amendment' } },
        },
        assignment: assignment({
          processTaskId: 'process',
          description: 'Custom description',
        }),
      },
      {
        task: {
          id: 'support',
          group_id: null,
          due_at: null,
          process_run_id: null,
          step_run_id: null,
          metadata: null,
          process_run: null,
          support_confirmation: { amendment: { title: 'Support amendment' } },
        },
        assignment: assignment({ processTaskId: 'support', description: '' }),
      },
      {
        task: { id: 'fallback', support_confirmation: null },
        assignment: assignment({ processTaskId: 'fallback', title: 'Assignment fallback' }),
      },
    ];

    for (const variant of variants) {
      mocks.processTasks = [variant.task];
      const { result } = renderHook(() => useGroupOpenAssignments('group-1'));
      await act(() => result.current.scheduleProcessTask(variant.assignment, 'event-1'));
      expect(result.current.isScheduling).toBe(false);
    }
    expect(mocks.attach).toHaveBeenCalledTimes(3);
    expect(mocks.attach.mock.calls[0]?.[0].description).toBe('Custom description');
    expect(mocks.attach.mock.calls[1]?.[0].description).toContain('eventRequest');
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(3);
  });

  it('always clears process scheduling state after attachment rejects', async () => {
    mocks.processTasks = [{ id: 'task-1' }];
    mocks.attach.mockRejectedValueOnce(new Error('attach failed'));
    const { result } = renderHook(() => useGroupOpenAssignments('group-1'));
    await expect(
      act(() =>
        result.current.scheduleProcessTask(assignment({ processTaskId: 'task-1' }), 'event-1')
      )
    ).rejects.toThrow('attach failed');
    expect(result.current.isScheduling).toBe(false);
  });

  it('reports each loading source', () => {
    mocks.rolesLoading = true;
    expect(renderHook(() => useGroupOpenAssignments('group-1')).result.current.isLoading).toBe(
      true
    );
    mocks.rolesLoading = false;
    mocks.allocationsResult = { type: 'unknown' };
    expect(renderHook(() => useGroupOpenAssignments('group-1')).result.current.isLoading).toBe(
      true
    );
    mocks.allocationsResult = { type: 'complete' };
    mocks.processTasksResult = { type: 'unknown' };
    expect(renderHook(() => useGroupOpenAssignments('group-1')).result.current.isLoading).toBe(
      true
    );
    mocks.processTasksResult = { type: 'complete' };
    expect(renderHook(() => useGroupOpenAssignments('group-1')).result.current.isLoading).toBe(
      false
    );
  });
});
