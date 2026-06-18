import { describe, expect, it } from 'vitest';
import { buildDelegateElectionDescription } from '@/features/elections/logic/electionAssignmentMetadata';
import {
  buildDelegateAssemblyCompositionRows,
  buildDelegateAssemblyCompositionSections,
} from '../delegateAssemblyComposition';

const REFERENCE_TIME = new Date('2026-06-17T10:00:00Z').getTime();

function delegateElectionDescription(
  overrides: Partial<{
    targetEventId: string;
    targetGroupId: string;
    sourceGroupId: string;
    seatRoleIds: string[];
    allSeatRoleIds: string[];
  }> = {}
) {
  return buildDelegateElectionDescription({
    meta: {
      kind: 'delegate_election',
      targetEventId: overrides.targetEventId ?? 'target-event',
      targetGroupId: overrides.targetGroupId ?? 'target-group',
      sourceGroupId: overrides.sourceGroupId ?? 'subgroup-a',
      seatRoleIds: overrides.seatRoleIds ?? ['seat-1'],
      allSeatRoleIds: overrides.allSeatRoleIds ?? ['seat-1'],
      mode: 'single',
    },
  });
}

describe('buildDelegateAssemblyCompositionRows', () => {
  it('uses planned seats from group delegate allocations', () => {
    const rows = buildDelegateAssemblyCompositionRows({
      targetEventId: 'target-event',
      metric: 'planned',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 3,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-b',
          allocated_seats: 1,
          group: { id: 'subgroup-b', name: 'Subgroup B' },
        },
      ],
      delegates: [],
      scheduledElections: [],
    });

    expect(rows).toMatchObject([
      {
        groupId: 'subgroup-a',
        label: 'Subgroup A',
        plannedSeatCount: 3,
        value: 3,
        percentage: 75,
      },
      {
        groupId: 'subgroup-b',
        label: 'Subgroup B',
        plannedSeatCount: 1,
        value: 1,
        percentage: 25,
      },
    ]);
  });

  it('deduplicates scheduled delegate seat IDs from delegate-election metadata', () => {
    const rows = buildDelegateAssemblyCompositionRows({
      targetEventId: 'target-event',
      metric: 'scheduled',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 3,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      delegates: [],
      scheduledElections: [
        {
          description: delegateElectionDescription({
            allSeatRoleIds: ['seat-1', 'seat-2'],
          }),
          agenda_item: {
            event: {
              id: 'subgroup-election-1',
              status: 'planned',
              start_date: REFERENCE_TIME + 1_000,
            },
          },
        },
        {
          description: delegateElectionDescription({
            seatRoleIds: ['seat-2'],
            allSeatRoleIds: ['seat-2', 'seat-3'],
          }),
          agenda_item: {
            event: {
              id: 'subgroup-election-2',
              status: 'planned',
              start_date: REFERENCE_TIME + 2_000,
            },
          },
        },
        {
          description: delegateElectionDescription({
            targetEventId: 'other-event',
            allSeatRoleIds: ['seat-4'],
          }),
          agenda_item: {
            event: {
              id: 'other-election',
              status: 'planned',
              start_date: REFERENCE_TIME + 3_000,
            },
          },
        },
        {
          description: delegateElectionDescription({
            allSeatRoleIds: ['seat-5'],
          }),
          agenda_item: {
            event: {
              id: 'cancelled-election',
              status: 'cancelled',
              start_date: REFERENCE_TIME + 4_000,
            },
          },
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groupId: 'subgroup-a',
      scheduledSeatCount: 3,
      value: 3,
      percentage: 100,
    });
  });

  it('sums confirmed delegate seats by subgroup', () => {
    const rows = buildDelegateAssemblyCompositionRows({
      targetEventId: 'target-event',
      metric: 'elected',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 4,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      delegates: [
        {
          group_id: 'subgroup-a',
          status: 'confirmed',
          seat_count: 2,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-a',
          status: 'confirmed',
          seat_count: null,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-a',
          status: 'pending',
          seat_count: 9,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      scheduledElections: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groupId: 'subgroup-a',
      electedSeatCount: 3,
      value: 3,
      percentage: 100,
    });
  });
});

describe('buildDelegateAssemblyCompositionSections', () => {
  it('builds planned chart rows from allocated subgroup seats only', () => {
    const sections = buildDelegateAssemblyCompositionSections({
      targetEventId: 'target-event',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 3,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-b',
          allocated_seats: 1,
          group: { id: 'subgroup-b', name: 'Subgroup B' },
        },
      ],
      delegates: [
        {
          group_id: 'subgroup-c',
          status: 'confirmed',
          seat_count: 1,
          group: { id: 'subgroup-c', name: 'Subgroup C' },
        },
      ],
      scheduledElections: [],
    });

    const planned = sections.find(section => section.id === 'planned');

    expect(planned?.total).toBe(4);
    expect(planned?.rows).toMatchObject([
      { kind: 'group', groupId: 'subgroup-a', label: 'Subgroup A', value: 3, share: 75 },
      { kind: 'group', groupId: 'subgroup-b', label: 'Subgroup B', value: 1, share: 25 },
    ]);
    expect(planned?.rows.some(row => row.kind === 'remainder')).toBe(false);
  });

  it('deduplicates scheduled seats and adds an unscheduled remainder', () => {
    const sections = buildDelegateAssemblyCompositionSections({
      targetEventId: 'target-event',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 4,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      delegates: [],
      scheduledElections: [
        {
          description: delegateElectionDescription({
            allSeatRoleIds: ['seat-1', 'seat-2'],
          }),
          agenda_item: {
            event: {
              id: 'subgroup-election-1',
              status: 'planned',
              start_date: REFERENCE_TIME + 1_000,
            },
          },
        },
        {
          description: delegateElectionDescription({
            allSeatRoleIds: ['seat-2', 'seat-3'],
          }),
          agenda_item: {
            event: {
              id: 'subgroup-election-2',
              status: 'planned',
              start_date: REFERENCE_TIME + 2_000,
            },
          },
        },
      ],
    });

    const scheduled = sections.find(section => section.id === 'scheduled');

    expect(scheduled?.total).toBe(4);
    expect(scheduled?.rows).toMatchObject([
      { kind: 'group', groupId: 'subgroup-a', value: 3, share: 75 },
      { kind: 'remainder', key: 'unscheduled', value: 1, share: 25 },
    ]);
  });

  it('sums confirmed delegate seats and adds a not-yet-elected remainder', () => {
    const sections = buildDelegateAssemblyCompositionSections({
      targetEventId: 'target-event',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 4,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      delegates: [
        {
          group_id: 'subgroup-a',
          status: 'confirmed',
          seat_count: 2,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-a',
          status: 'confirmed',
          seat_count: null,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
        {
          group_id: 'subgroup-a',
          status: 'pending',
          seat_count: 9,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      scheduledElections: [],
    });

    const elected = sections.find(section => section.id === 'elected');

    expect(elected?.total).toBe(4);
    expect(elected?.rows).toMatchObject([
      { kind: 'group', groupId: 'subgroup-a', value: 3, share: 75 },
      { kind: 'remainder', key: 'not-yet-elected', value: 1, share: 25 },
    ]);
  });

  it('clamps scheduled and elected remainders to zero when counts exceed planned seats', () => {
    const sections = buildDelegateAssemblyCompositionSections({
      targetEventId: 'target-event',
      referenceTime: REFERENCE_TIME,
      allocations: [
        {
          group_id: 'subgroup-a',
          allocated_seats: 2,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      delegates: [
        {
          group_id: 'subgroup-a',
          status: 'confirmed',
          seat_count: 3,
          group: { id: 'subgroup-a', name: 'Subgroup A' },
        },
      ],
      scheduledElections: [
        {
          description: delegateElectionDescription({
            allSeatRoleIds: ['seat-1', 'seat-2', 'seat-3'],
          }),
          agenda_item: {
            event: {
              id: 'subgroup-election-1',
              status: 'planned',
              start_date: REFERENCE_TIME + 1_000,
            },
          },
        },
      ],
    });

    const scheduled = sections.find(section => section.id === 'scheduled');
    const elected = sections.find(section => section.id === 'elected');

    expect(scheduled?.total).toBe(3);
    expect(scheduled?.rows.find(row => row.key === 'unscheduled')).toMatchObject({
      value: 0,
      share: 0,
    });
    expect(elected?.total).toBe(3);
    expect(elected?.rows.find(row => row.key === 'not-yet-elected')).toMatchObject({
      value: 0,
      share: 0,
    });
  });
});
