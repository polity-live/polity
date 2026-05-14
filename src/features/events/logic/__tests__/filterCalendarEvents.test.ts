import { describe, expect, it } from 'vitest';

import { filterCalendarEvents, type FilterableCalendarEvent } from '../filterCalendarEvents';

const events: FilterableCalendarEvent[] = [
  {
    start_date: new Date('2026-05-14T10:00:00').getTime(),
    title: 'Today planning meeting',
    groupName: 'Alpha Group',
    group_id: 'group-alpha',
    location: 'Berlin',
    hashtags: [{ tag: 'planning' }],
  },
  {
    start_date: new Date('2026-05-16T10:00:00').getTime(),
    title: 'Future workshop',
    groupName: 'Beta Group',
    group_id: 'group-beta',
    location: 'Hamburg',
    hashtags: [{ tag: 'workshop' }],
  },
  {
    start_date: new Date('2026-05-16T18:00:00').getTime(),
    title: 'Ungrouped event',
    location: 'Munich',
  },
];

describe('filterCalendarEvents', () => {
  it('returns all events when no filters are active', () => {
    expect(
      filterCalendarEvents(events, {
        searchQuery: '',
        dateFilter: '',
      })
    ).toEqual(events);
  });

  it('filters by selected group id', () => {
    expect(
      filterCalendarEvents(events, {
        searchQuery: '',
        dateFilter: '',
        selectedGroupId: 'group-beta',
      })
    ).toEqual([events[1]]);
  });

  it('filters by date and keeps matching events on the same day', () => {
    expect(
      filterCalendarEvents(events, {
        searchQuery: '',
        dateFilter: '2026-05-16',
      })
    ).toEqual([events[1], events[2]]);
  });

  it('filters by query across title, group name, hashtag, and location', () => {
    expect(
      filterCalendarEvents(events, {
        searchQuery: 'alpha',
        dateFilter: '',
      })
    ).toEqual([events[0]]);

    expect(
      filterCalendarEvents(events, {
        searchQuery: 'workshop',
        dateFilter: '',
      })
    ).toEqual([events[1]]);

    expect(
      filterCalendarEvents(events, {
        searchQuery: 'munich',
        dateFilter: '',
      })
    ).toEqual([events[2]]);
  });

  it('combines the group filter with the other filters', () => {
    expect(
      filterCalendarEvents(events, {
        searchQuery: 'future',
        dateFilter: '2026-05-16',
        selectedGroupId: 'group-beta',
      })
    ).toEqual([events[1]]);
  });
});
