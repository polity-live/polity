import { describe, expect, it } from 'vitest';
import {
  buildDelegateElectionAssignments,
  buildOpenAssignments,
  buildRoleRenewalAssignments,
  getNextRoleElectionEvent,
  getRemainingSeatCount,
} from '../openAssignments';
import { buildDelegateElectionDescription } from '@/features/elections/logic/electionAssignmentMetadata';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

const REFERENCE_TIME = new Date('2026-05-28T10:00:00Z').getTime();

function eventSummary(
  id: string,
  overrides: Partial<{
    title: string;
    event_type: string;
    start_date: number;
    end_date: number;
    status: string;
    delegate_seat_allocation_type: string;
    main_group_delegate_allocation_mode: string;
    group: { id: string; name: string };
  }> = {}
) {
  return {
    id,
    title: overrides.title ?? id,
    event_type: overrides.event_type ?? 'delegate_assembly',
    start_date: overrides.start_date ?? REFERENCE_TIME + 1000 * 60 * 60,
    end_date: overrides.end_date ?? REFERENCE_TIME + 1000 * 60 * 120,
    status: overrides.status ?? 'planned',
    delegate_seat_allocation_type:
      overrides.delegate_seat_allocation_type ?? 'members_per_delegate',
    main_group_delegate_allocation_mode: overrides.main_group_delegate_allocation_mode ?? '50',
    group: overrides.group ?? { id: 'target-group', name: 'Target Group' },
  };
}

function allocation(
  id: string,
  overrides: Partial<{
    allocated_seats: number;
    group: { id: string; name: string };
    event: ReturnType<typeof eventSummary> & {
      delegates?: readonly {
        user_id?: string | null;
        group_id?: string | null;
        seat_count?: number | null;
        status?: string | null;
      }[];
    };
  }> = {}
) {
  return {
    id,
    allocated_seats: overrides.allocated_seats ?? 3,
    group: overrides.group ?? { id: 'local-group', name: 'Local Group' },
    event: overrides.event ?? eventSummary('delegate-assembly'),
  };
}

function role(
  id: string,
  overrides: Partial<{
    title: string;
    scope: string;
    assignment_mode: string;
    is_recurring: boolean;
    recurrence_pattern: string;
    recurrence_interval: number;
    scheduled_revote_date: number | null;
    elections: {
      id: string;
      status?: string | null;
      description?: string | null;
      agenda_item?: { event?: ReturnType<typeof eventSummary> | null } | null;
    }[];
  }> = {}
) {
  return {
    id,
    title: overrides.title ?? id,
    scope: overrides.scope ?? 'group',
    assignment_mode: overrides.assignment_mode ?? 'elected',
    is_recurring: overrides.is_recurring ?? false,
    recurrence_pattern: overrides.recurrence_pattern ?? null,
    recurrence_interval: overrides.recurrence_interval ?? null,
    scheduled_revote_date: overrides.scheduled_revote_date ?? null,
    elections: overrides.elections ?? [],
  };
}

describe('open assignments', () => {
  it('normalizes remaining seats and future/ongoing role-election candidates', () => {
    expect(getRemainingSeatCount({ remainingSeatCount: -2, seatCount: 5 })).toBe(0);
    expect(getRemainingSeatCount({ remainingSeatCount: undefined, seatCount: 3 })).toBe(3);
    expect(getRemainingSeatCount({})).toBe(0);

    const ongoingWithoutStart = {
      ...eventSummary('ongoing-without-start'),
      start_date: null,
      end_date: REFERENCE_TIME + 10,
    };
    const secondWithoutStart = {
      ...eventSummary('second-without-start'),
      start_date: null,
      end_date: REFERENCE_TIME + 20,
    };
    const next = getNextRoleElectionEvent(
      {
        elections: [
          { id: 'missing-agenda', agenda_item: null },
          { id: 'missing-event', agenda_item: {} },
          { id: 'missing-id', agenda_item: { event: { id: '' } } },
          {
            id: 'cancelled',
            agenda_item: { event: eventSummary('cancelled', { status: 'cancelled' }) },
          },
          {
            id: 'past',
            agenda_item: {
              event: eventSummary('past', {
                start_date: REFERENCE_TIME - 20,
                end_date: REFERENCE_TIME - 10,
              }),
            },
          },
          { id: 'ongoing', agenda_item: { event: ongoingWithoutStart } },
          { id: 'second', agenda_item: { event: secondWithoutStart } },
          {
            id: 'start-only',
            agenda_item: {
              event: {
                ...eventSummary('start-only'),
                end_date: null,
                start_date: REFERENCE_TIME + 30,
              },
            },
          },
          {
            id: 'no-dates',
            agenda_item: {
              event: { ...eventSummary('no-dates'), end_date: null, start_date: null },
            },
          },
        ],
      },
      REFERENCE_TIME
    );

    expect(next?.id).toBe('start-only');
    expect(getNextRoleElectionEvent({ elections: null }, REFERENCE_TIME)).toBeNull();
    expect(getNextRoleElectionEvent({ elections: [] })).toBeNull();
  });

  it('keeps delegate allocations open until a subgroup event is actually linked', () => {
    const [assignment] = buildDelegateElectionAssignments({
      currentGroupId: 'local-group',
      allocations: [allocation('allocation-1')],
      roles: [],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment.status).toBe('open');
    expect(assignment.remainingSeatCount).toBe(3);
    expect(assignment.linkedEvent).toBeNull();
  });

  it('exposes generated delegate allocations as open delegate-election assignments', () => {
    const assignments = buildOpenAssignments({
      currentGroupId: 'local-group',
      allocations: [allocation('allocation-1')],
      roles: [],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments).toMatchObject([
      {
        id: 'delegate:allocation-1',
        kind: 'delegate_election',
        status: 'open',
        seatCount: 3,
        scheduledSeatCount: 0,
        completedSeatCount: 0,
        remainingSeatCount: 3,
      },
    ]);
  });

  it('keeps delegate ratio metadata on delegate-election target events', () => {
    const [assignment] = buildDelegateElectionAssignments({
      currentGroupId: 'local-group',
      allocations: [
        allocation('allocation-1', {
          group: { id: 'source-group', name: 'B1' },
          event: eventSummary('delegate-assembly', {
            delegate_seat_allocation_type: 'members_per_delegate',
            main_group_delegate_allocation_mode: '1',
            group: { id: 'target-group', name: 'H2' },
          }),
        }),
      ],
      roles: [],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment.targetEvent).toMatchObject({
      event_type: 'delegate_assembly',
      delegate_seat_allocation_type: 'members_per_delegate',
      main_group_delegate_allocation_mode: '1',
    });
    expect(assignment.sourceGroup).toMatchObject({ id: 'source-group', name: 'B1' });
    expect(assignment.targetGroup).toMatchObject({ id: 'target-group', name: 'H2' });
  });

  it('marks delegate allocations as scheduled when a future subgroup election is linked', () => {
    const targetEvent = eventSummary('delegate-assembly');
    const subgroupEvent = eventSummary('local-assembly', {
      group: { id: 'local-group', name: 'Local Group' },
    });

    const [assignment] = buildDelegateElectionAssignments({
      currentGroupId: 'local-group',
      allocations: [allocation('allocation-1', { event: targetEvent })],
      roles: [
        role('seat-role-1', {
          elections: [
            {
              id: 'election-1',
              status: 'pending',
              description: buildDelegateElectionDescription({
                meta: {
                  kind: 'delegate_election',
                  targetEventId: 'delegate-assembly',
                  targetGroupId: 'target-group',
                  sourceGroupId: 'local-group',
                  seatRoleIds: ['seat-role-1'],
                  allSeatRoleIds: ['seat-role-1', 'seat-role-2'],
                  mode: 'single',
                },
              }),
              agenda_item: { event: subgroupEvent },
            },
          ],
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment.status).toBe('scheduled');
    expect(assignment.scheduledSeatCount).toBe(2);
    expect(assignment.remainingSeatCount).toBe(1);
    expect(assignment.linkedEvent?.id).toBe('local-assembly');
  });

  it('deduplicates scheduled seats, chooses the earliest linked event, and counts delegates', () => {
    const metadata = buildDelegateElectionDescription({
      meta: {
        kind: 'delegate_election',
        targetEventId: 'target-event',
        targetGroupId: 'target-group',
        sourceGroupId: 'local-group',
        seatRoleIds: ['seat-1'],
        allSeatRoleIds: ['seat-1', 'seat-2'],
        mode: 'single',
      },
    });
    const earlier = eventSummary('earlier', { start_date: REFERENCE_TIME + 10 });
    const later = eventSummary('later', { start_date: REFERENCE_TIME + 20 });
    const target = {
      ...eventSummary('target-event', { title: '' }),
      group: null,
      delegates: [
        { group_id: 'local-group', status: 'confirmed', seat_count: null },
        { group_id: 'local-group', status: 'confirmed', seat_count: 0 },
        { group_id: 'local-group', status: 'pending', seat_count: 5 },
        { group_id: 'other-group', status: 'confirmed', seat_count: 5 },
      ],
    };
    const [assignment] = buildDelegateElectionAssignments({
      currentGroupId: 'local-group',
      allocations: [
        {
          ...allocation('completed', { allocated_seats: 2, event: target as any }),
          group: null,
        } as any,
      ],
      roles: [
        role('no-elections', { elections: [] }),
        role('mixed', {
          elections: [
            { id: 'invalid', description: 'not metadata', agenda_item: { event: earlier } },
            {
              id: 'other-source',
              description: buildDelegateElectionDescription({
                meta: {
                  kind: 'delegate_election',
                  targetEventId: 'target-event',
                  targetGroupId: 'target-group',
                  sourceGroupId: 'other-group',
                  seatRoleIds: ['seat-1'],
                  allSeatRoleIds: ['seat-1'],
                  mode: 'single',
                },
              }),
              agenda_item: { event: earlier },
            },
            {
              id: 'cancelled',
              description: metadata,
              agenda_item: { event: eventSummary('c', { status: 'cancelled' }) },
            },
            { id: 'later', description: metadata, agenda_item: { event: later } },
            { id: 'earlier', description: metadata, agenda_item: { event: earlier } },
            { id: 'later-again', description: metadata, agenda_item: { event: later } },
          ],
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment).toMatchObject({
      status: 'completed',
      completedSeatCount: 2,
      scheduledSeatCount: 2,
      remainingSeatCount: 0,
      linkedEvent: { id: 'earlier' },
      sourceGroup: null,
      targetGroup: null,
    });
    expect(assignment.title).toContain('Ziel-Event');
    expect(assignment.description).toContain('Diese Untergruppe');
  });

  it('filters empty allocations and sorts open, scheduled, and completed assignments', () => {
    const scheduledMetadata = buildDelegateElectionDescription({
      meta: {
        kind: 'delegate_election',
        targetEventId: 'scheduled-target',
        targetGroupId: 'target-group',
        sourceGroupId: 'local-group',
        seatRoleIds: ['seat'],
        allSeatRoleIds: ['seat'],
        mode: 'single',
      },
    });
    const assignments = buildDelegateElectionAssignments({
      currentGroupId: 'local-group',
      allocations: [
        { id: 'zero', allocated_seats: 0, event: eventSummary('zero') },
        { id: 'null-seats', allocated_seats: null as any, event: eventSummary('null-seats') },
        { id: 'missing-event', allocated_seats: 1, event: null },
        allocation('open-early', {
          event: eventSummary('open-early', { start_date: REFERENCE_TIME + 20 }),
        }),
        allocation('open-late', {
          event: { ...eventSummary('open-late'), start_date: null as any },
        }),
        allocation('scheduled', { event: eventSummary('scheduled-target') }),
        allocation('completed', {
          allocated_seats: 1,
          event: {
            ...eventSummary('completed-target'),
            delegates: [{ group_id: 'local-group', status: 'confirmed', seat_count: 1 }],
          },
        }),
      ],
      roles: [
        { ...role('null-elections'), elections: null },
        role('seat', {
          elections: [
            {
              id: 'valid-metadata-without-event',
              description: scheduledMetadata,
              agenda_item: null,
            },
            {
              id: 'scheduled-election',
              description: scheduledMetadata,
              agenda_item: { event: eventSummary('linked') },
            },
          ],
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments.map(item => item.id)).toEqual([
      'delegate:open-early',
      'delegate:open-late',
      'delegate:scheduled',
      'delegate:completed',
    ]);

    expect(
      buildDelegateElectionAssignments({
        currentGroupId: 'local-group',
        allocations: [
          allocation('open-without-date', {
            event: { ...eventSummary('open-without-date'), start_date: null as any },
          }),
          allocation('open-with-date', {
            event: eventSummary('open-with-date', { start_date: REFERENCE_TIME + 10 }),
          }),
        ],
        roles: [],
        referenceTime: REFERENCE_TIME,
      }).map(item => item.id)
    ).toEqual(['delegate:open-with-date', 'delegate:open-without-date']);
  });

  it('exposes the next linked renewal event for recurring roles', () => {
    const linkedEvent = eventSummary('renewal-event');

    const [assignment] = buildRoleRenewalAssignments({
      roles: [
        role('chairperson', {
          title: 'Chairperson',
          is_recurring: true,
          recurrence_pattern: 'yearly',
          recurrence_interval: 4,
          elections: [
            {
              id: 'renewal-election',
              status: 'pending',
              agenda_item: { event: linkedEvent },
            },
          ],
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment.status).toBe('scheduled');
    expect(assignment.linkedEvent?.id).toBe('renewal-event');
  });

  it('exposes elected group roles without recurrence as open role-renewal assignments', () => {
    const [assignment] = buildRoleRenewalAssignments({
      roles: [
        role('chairperson', {
          title: 'Chairperson',
          is_recurring: false,
          scheduled_revote_date: null,
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignment).toMatchObject({
      id: 'role:chairperson',
      kind: 'role_renewal',
      status: 'open',
      roleId: 'chairperson',
      linkedEvent: null,
    });
  });

  it('does not create separate role-renewal assignments for delegate seat roles', () => {
    const assignments = buildRoleRenewalAssignments({
      roles: [
        role('seat-role-1', {
          title: 'Delegate seat 1',
          elections: [
            {
              id: 'delegate-election',
              status: 'pending',
              description: buildDelegateElectionDescription({
                meta: {
                  kind: 'delegate_election',
                  targetEventId: 'delegate-assembly',
                  targetGroupId: 'target-group',
                  sourceGroupId: 'local-group',
                  seatRoleIds: ['seat-role-1'],
                  allSeatRoleIds: ['seat-role-1', 'seat-role-2'],
                  mode: 'single',
                },
              }),
              agenda_item: { event: eventSummary('local-assembly') },
            },
          ],
        }),
        role('seat-role-2', { title: 'Delegate seat 2' }),
        role('chairperson', { title: 'Chairperson' }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments.map(assignment => assignment.id)).toEqual(['role:chairperson']);
  });

  it('filters ineligible roles and covers due-date, title, language, and event sorting fallbacks', () => {
    const previousLanguage = useLanguageStore.getState().language;
    const metadata = buildDelegateElectionDescription({
      meta: {
        kind: 'delegate_election',
        targetEventId: 'target',
        targetGroupId: 'target-group',
        sourceGroupId: 'local-group',
        seatRoleIds: ['seat-role'],
        allSeatRoleIds: ['seat-role', 'seat-role-extra'],
        mode: 'single',
      },
    });

    try {
      useLanguageStore.getState().setLanguage('de');
      const german = buildRoleRenewalAssignments({
        roles: [
          { ...role('wrong-scope', { scope: 'event' }), elections: null },
          role('wrong-mode', { assignment_mode: 'assigned' }),
          role('seat-role', { elections: [{ id: 'seat-election', description: metadata }] }),
          role('named', {
            title: '' as never,
            scheduled_revote_date: REFERENCE_TIME + 1000,
            elections: [
              { id: 'missing', agenda_item: null },
              {
                id: 'no-start-a',
                agenda_item: {
                  event: {
                    ...eventSummary('no-start-a'),
                    start_date: null as any,
                    end_date: REFERENCE_TIME + 5000,
                  },
                },
              },
              {
                id: 'no-start-b',
                agenda_item: {
                  event: {
                    ...eventSummary('no-start-b'),
                    start_date: null as any,
                    end_date: REFERENCE_TIME + 6000,
                  },
                },
              },
            ],
          }),
          { ...role('fallback-title', { title: '' as never }), name: null },
        ],
        referenceTime: REFERENCE_TIME,
      });

      expect(german.map(item => item.id)).toEqual(['role:fallback-title', 'role:named']);
      expect(german[0]?.title).toBeTruthy();
      expect(german[1]?.description).toContain('2026');

      useLanguageStore.getState().setLanguage('en');
      const english = buildRoleRenewalAssignments({
        roles: [role('english', { scheduled_revote_date: REFERENCE_TIME + 1000 })],
        referenceTime: REFERENCE_TIME,
      });
      expect(english[0]?.description).toContain('2026');

      const sortedScheduled = buildRoleRenewalAssignments({
        roles: [
          role('scheduled-no-date-a', {
            elections: [
              {
                id: 'a',
                agenda_item: {
                  event: {
                    ...eventSummary('a'),
                    start_date: null as any,
                    end_date: REFERENCE_TIME + 100,
                  },
                },
              },
            ],
          }),
          role('scheduled-date', {
            elections: [
              {
                id: 'dated',
                agenda_item: {
                  event: eventSummary('dated', { start_date: REFERENCE_TIME + 10 }),
                },
              },
            ],
          }),
          role('scheduled-no-date-b', {
            elections: [
              {
                id: 'b',
                agenda_item: {
                  event: {
                    ...eventSummary('b'),
                    start_date: null as any,
                    end_date: REFERENCE_TIME + 200,
                  },
                },
              },
            ],
          }),
        ],
        referenceTime: REFERENCE_TIME,
      });
      expect(sortedScheduled[0]?.id).toBe('role:scheduled-date');
    } finally {
      useLanguageStore.getState().setLanguage(previousLanguage);
    }
  });

  it('combines delegate and role-renewal assignments into one sorted list', () => {
    const assignments = buildOpenAssignments({
      currentGroupId: 'local-group',
      allocations: [allocation('allocation-1')],
      roles: [
        role('chairperson', {
          title: 'Chairperson',
          is_recurring: true,
          recurrence_pattern: 'yearly',
          recurrence_interval: 4,
        }),
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments).toHaveLength(2);
    expect(assignments.map(assignment => assignment.kind).sort()).toEqual([
      'delegate_election',
      'role_renewal',
    ]);

    expect(
      buildOpenAssignments({
        currentGroupId: 'local-group',
        allocations: [],
        roles: [role('open-a'), role('open-b')],
      }).map(item => item.id)
    ).toEqual(['role:open-a', 'role:open-b']);
  });

  it('keeps completed schedule-event process tasks visible as completed assignments', () => {
    const assignments = buildOpenAssignments({
      currentGroupId: 'local-group',
      allocations: [],
      roles: [],
      processTasks: [
        {
          id: 'task-1',
          task_type: 'schedule_event',
          status: 'completed',
          title: 'Schedule amendment vote',
          description: 'Attach the vote request to an event.',
          group_id: 'local-group',
          process_run_id: 'run-1',
          step_run_id: 'step-1',
          due_at: REFERENCE_TIME,
          event: eventSummary('vote-event', {
            title: 'Local vote event',
            event_type: 'general_assembly',
          }),
          process_run: {
            amendment: {
              id: 'amendment-1',
              title: 'Street safety amendment',
            },
          },
        },
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments).toMatchObject([
      {
        id: 'process-task:task-1',
        kind: 'process_task',
        status: 'completed',
        title: 'Schedule amendment vote',
        linkedEvent: {
          id: 'vote-event',
          title: 'Local vote event',
        },
        amendment: {
          id: 'amendment-1',
          title: 'Street safety amendment',
        },
      },
    ]);
  });

  it('builds generated process-task titles, descriptions, statuses, metadata, and fallbacks', () => {
    const assignments = buildOpenAssignments({
      currentGroupId: 'local-group',
      allocations: [],
      roles: [],
      processTasks: [
        {
          id: 'implementation',
          task_type: 'implementation_evaluation',
          status: 'open',
          title: ' ',
          description: '',
          process_run_id: null,
          step_run_id: null,
          due_at: REFERENCE_TIME + 30,
          metadata: { source: 'test' },
          target_group: null,
          support_confirmation: {
            id: 'confirmation',
            amendment: { id: 'amendment-support', title: null },
          },
        },
        {
          id: 'support',
          task_type: 'support_confirmation',
          status: 'open',
          title: null,
          description: null,
          agenda_item: { id: 'agenda-item' },
          target_group: { id: 'target', name: 'Target Group' },
          process_run: { amendment: { id: 'amendment-process', title: 'Process amendment' } },
        },
        {
          id: 'default-step-event',
          task_type: 'schedule_event',
          status: 'open',
          title: null,
          description: null,
          step_run: { event: eventSummary('step-event') },
          target_group: { id: 'step-target', name: 'Step Target' },
          process_run: { amendment: { id: '', title: '' } },
        },
        {
          id: 'default-open',
          task_type: null,
          status: null,
          title: null,
          description: null,
          due_at: null,
          process_run: null,
          support_confirmation: null,
        },
      ],
      referenceTime: REFERENCE_TIME,
    });

    expect(assignments.map(item => item.id)).toEqual([
      'process-task:implementation',
      'process-task:default-open',
      'process-task:default-step-event',
      'process-task:support',
    ]);
    expect(assignments[1]).toMatchObject({
      status: 'open',
      processTaskType: null,
      processRunId: null,
      stepRunId: null,
      amendment: null,
      amendmentId: null,
      dueAt: null,
    });
    expect(assignments[0]).toMatchObject({
      title: expect.stringContaining('Änderungsantrag'),
      description: expect.stringContaining('zustandige Gruppe'),
      amendment: { id: 'amendment-support', title: 'Änderungsantrag' },
      processTaskMetadata: { source: 'test' },
    });
    expect(assignments[3]).toMatchObject({
      status: 'scheduled',
      title: expect.stringContaining('Process amendment'),
      description: expect.stringContaining('erneut'),
    });
    expect(assignments[2]).toMatchObject({
      status: 'scheduled',
      linkedEvent: { id: 'step-event' },
      description: expect.stringContaining('Step Target'),
      amendment: null,
      amendmentId: '',
    });
  });
});
