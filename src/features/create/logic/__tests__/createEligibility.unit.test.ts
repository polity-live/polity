import { describe, expect, it } from 'vitest';
import {
  getCreateSelectableEventIds,
  getElectionEventId,
  getParticipatingEventIds,
  isActiveCreateParticipationStatus,
  isCreateSelectableEvent,
  isCreateSelectableElection,
} from '../createEligibility';

describe('create eligibility helpers', () => {
  it('normalizes active and absent participation statuses', () => {
    expect(isActiveCreateParticipationStatus('member')).toBe(true);
    expect(isActiveCreateParticipationStatus(null)).toBe(false);
  });

  it('collects only active user event participations', () => {
    const eventIds = getParticipatingEventIds([
      { event_id: 'event-active', status: 'active' },
      { event: { id: 'event-confirmed' }, status: 'confirmed' },
      { event_id: 'event-invited', status: 'invited' },
    ]);

    expect([...eventIds].sort()).toEqual(['event-active', 'event-confirmed']);
  });

  it('ignores active participations without an event identifier', () => {
    expect([...getParticipatingEventIds([{ status: 'active' }])]).toEqual([]);
  });

  it('rejects missing event ids and supports direct group eligibility', () => {
    expect(isCreateSelectableEvent({}, new Set(['group-1']), new Set())).toBe(false);
    expect(isCreateSelectableEvent({ id: 'event-1' }, new Set(['group-1']), new Set())).toBe(false);
    expect(
      isCreateSelectableEvent(
        { id: 'event-1', group_id: 'group-1' },
        new Set(['group-1']),
        new Set()
      )
    ).toBe(true);
  });

  it('allows events the user participates in or whose group the user belongs to', () => {
    const selectableEventIds = getCreateSelectableEventIds(
      [
        { id: 'participating-event', group_id: 'other-group' },
        { id: 'member-group-event', group_id: 'group-1' },
        { id: 'unrelated-event', group_id: 'other-group' },
      ],
      new Set(['group-1']),
      [{ event_id: 'participating-event', status: 'active' }]
    );

    expect([...selectableEventIds].sort()).toEqual(['member-group-event', 'participating-event']);
  });

  it('resolves election event ids and filters elections by selectable events', () => {
    const directEventElection = { agenda_item: { event_id: 'event-1' } };
    const relatedEventElection = { agenda_item: { event: { id: 'event-2' } } };
    const selectableEventIds = new Set(['event-2']);

    expect(getElectionEventId(directEventElection)).toBe('event-1');
    expect(getElectionEventId(relatedEventElection)).toBe('event-2');
    expect(isCreateSelectableElection(directEventElection, selectableEventIds)).toBe(false);
    expect(isCreateSelectableElection(relatedEventElection, selectableEventIds)).toBe(true);
    expect(getElectionEventId({})).toBeNull();
    expect(isCreateSelectableElection({}, selectableEventIds)).toBe(false);
  });
});
