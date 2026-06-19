import { describe, expect, it } from 'vitest';
import {
  buildDelegateElectionAssignments,
  buildOpenAssignments,
  buildRoleRenewalAssignments,
} from '../openAssignments';
import { buildDelegateElectionDescription } from '@/features/elections/logic/electionAssignmentMetadata';

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
});
