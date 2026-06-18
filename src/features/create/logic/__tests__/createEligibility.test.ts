import { describe, expect, it } from 'vitest';
import {
  getCreateSelectableEventIds,
  getElectionEventId,
  getParticipatingEventIds,
  isCreateSelectableElection,
} from '../createEligibility';

describe('create eligibility helpers', () => {
  it('collects only active user event participations', () => {
    const eventIds = getParticipatingEventIds([
      { event_id: 'event-active', status: 'active' },
      { event: { id: 'event-confirmed' }, status: 'confirmed' },
      { event_id: 'event-invited', status: 'invited' },
    ]);

    expect([...eventIds].sort()).toEqual(['event-active', 'event-confirmed']);
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
  });
});
