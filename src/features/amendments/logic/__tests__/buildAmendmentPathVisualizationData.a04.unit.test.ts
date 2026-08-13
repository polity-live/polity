import { describe, expect, it, vi } from 'vitest';
import {
  buildAmendmentPathGroupTypeById,
  buildAmendmentPathVisualizationData,
  findLikelyActiveAmendmentStep,
  getFirstUnresolvedAmendmentStepId,
  isLikelyActiveAmendmentStep,
  normalizePathStepStatus,
} from '../buildAmendmentPathVisualizationData';

describe('buildAmendmentPathVisualizationData A04 branch accountability', () => {
  it.each([
    [null, 'pending'],
    ['', 'pending'],
    ['approved', 'approved'],
    ['accepted', 'approved'],
    ['supported', 'approved'],
    ['merged', 'approved'],
    ['completed', 'approved'],
    ['rejected', 'rejected'],
    ['withdrawn', 'rejected'],
    ['forward_confirmed', 'active'],
    ['scheduled', 'active'],
    ['in_vote', 'active'],
    ['unknown', 'pending'],
  ])('normalizes status %s', (status, expected) => {
    expect(normalizePathStepStatus(status)).toBe(expected);
  });

  it.each([
    [{ decision_status: 'forward_confirmed', status: null }, true],
    [{ decision_status: 'scheduled', status: null }, true],
    [{ decision_status: 'in_vote', status: null }, true],
    [{ decision_status: 'pending_event', status: null }, true],
    [{ decision_status: 'other', status: 'scheduled' }, true],
    [{ decision_status: 'other', status: 'in_vote' }, true],
    [{ decision_status: 'other', status: 'pending_event' }, true],
    [{ decision_status: 'other', status: 'other' }, false],
    [{ decision_status: null, status: null }, false],
  ])('detects likely active state %#', (step, expected) => {
    expect(isLikelyActiveAmendmentStep(step)).toBe(expected);
  });

  it('finds active, unresolved, and absent steps', () => {
    const active = [
      { id: 'resolved', status: 'approved', decision_status: null, order_index: 0 },
      { id: 'active', status: 'scheduled', decision_status: null, order_index: 1 },
    ];
    expect(findLikelyActiveAmendmentStep(active)?.id).toBe('active');

    const unresolved = [
      { id: 'resolved', status: 'approved', decision_status: null, order_index: 1 },
      { id: 'pending', status: null, decision_status: null, order_index: null },
    ];
    expect(findLikelyActiveAmendmentStep(unresolved)?.id).toBe('pending');
    expect(
      findLikelyActiveAmendmentStep([
        { id: 'done', status: 'approved', decision_status: null, order_index: 0 },
      ])
    ).toBeNull();
  });

  it('sorts and resolves the first non-terminal step id', () => {
    expect(
      getFirstUnresolvedAmendmentStepId([
        { id: 'late', status: 'pending', decision_status: null, order_index: 4 },
        { id: 'approved', status: 'approved', decision_status: null, order_index: null },
        { id: 'rejected', status: null, decision_status: 'rejected', order_index: 1 },
        { id: 'first', status: null, decision_status: null, order_index: 2 },
      ])
    ).toBe('first');
    expect(getFirstUnresolvedAmendmentStepId([])).toBeNull();
  });

  it('builds a group type map and filters absent target ids', () => {
    expect(
      buildAmendmentPathGroupTypeById([
        { target_group_id: 'one' },
        { target_group_id: null },
        { target_group_id: '' },
      ])
    ).toEqual(new Map([['one', null]]));
  });

  it('maps populated and fallback visualization fields and option callbacks', () => {
    const isPending = vi.fn((step: any) => step.id === 'full');
    const result = buildAmendmentPathVisualizationData(
      [
        {
          id: 'full',
          target_group_id: 'group',
          target_group: { name: 'Group' },
          workflow_step: { label: 'Workflow label' },
          event_id: 'event',
          event: { title: 'Event', start_date: 10 },
          starts_at: 11,
          agenda_item_id: 'agenda',
          vote_id: 'vote',
          decision_status: 'approved',
          status: 'scheduled',
          order_index: 2,
        },
        {
          id: 'workflow',
          target_group_id: null,
          target_group: null,
          workflow_step: { label: 'Workflow label' },
          event_id: null,
          event: { title: null, start_date: null },
          starts_at: 12,
          agenda_item_id: null,
          vote_id: null,
          decision_status: null,
          status: 'pending',
          order_index: null,
        },
        { id: 'empty', target_group: null, workflow_step: null, event: null },
      ],
      { activeStepId: 'full', isEventRequestPending: isPending }
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        groupName: 'Group',
        eventTitle: 'Event',
        eventStartDate: 10,
        forwardingStatus: 'approved',
        isActiveStep: true,
        eventRequestPending: true,
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        groupName: 'Workflow label',
        eventTitle: 'Pending event',
        eventStartDate: 12,
        forwardingStatus: 'pending',
        isActiveStep: false,
      })
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        groupName: 'Unknown group',
        eventStartDate: null,
        forwardingStatus: 'previous_decision_outstanding',
      })
    );
    expect(isPending).toHaveBeenCalledTimes(3);

    const withoutOptions = buildAmendmentPathVisualizationData([{ id: 'empty' }]);
    expect(withoutOptions[0]?.isActiveStep).toBe(false);
    expect(withoutOptions[0]?.eventRequestPending).toBe(false);
  });
});
