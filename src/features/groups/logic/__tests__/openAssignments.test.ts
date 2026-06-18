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
    start_date: number;
    end_date: number;
    status: string;
    group: { id: string; name: string };
  }> = {}
) {
  return {
    id,
    title: overrides.title ?? id,
    start_date: overrides.start_date ?? REFERENCE_TIME + 1000 * 60 * 60,
    end_date: overrides.end_date ?? REFERENCE_TIME + 1000 * 60 * 120,
    status: overrides.status ?? 'planned',
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
});
