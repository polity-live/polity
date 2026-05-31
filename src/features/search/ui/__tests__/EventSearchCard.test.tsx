// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventSearchCard } from '../EventSearchCard';

vi.mock('@/features/timeline/ui/cards/EventTimelineCard', () => ({
  EventTimelineCard: ({
    event,
  }: {
    event: { title: string; electionsCount?: number; amendmentsCount?: number };
  }) => (
    <div>
      <span>{event.title}</span>
      <span>{String(event.electionsCount ?? 0)}</span>
      <span>{String(event.amendmentsCount ?? 0)}</span>
    </div>
  ),
}));

describe('EventSearchCard', () => {
  it('maps event rows into timeline card props', () => {
    render(
      <EventSearchCard
        event={
          {
            id: 'event-1',
            title: 'DelegiertenV1',
            description: 'Delegate election target',
            start_date: 1717200000000,
            end_date: 1717203600000,
            location_name: 'Town Hall',
            participants: [{ id: 'p-1' }],
            agenda_items: [
              { election: [{ id: 'e-1' }] },
              { amendment: { id: 'a-1' } },
              { amendment: { id: 'a-2' } },
            ],
            event_hashtags: [{ hashtag: { tag: 'delegates' } }],
            creator: {
              id: 'u-1',
              first_name: 'Alex',
              last_name: 'Organizer',
              email: 'alex@example.com',
            },
            group: { id: 'g-1', name: 'City Circle' },
          } as never
        }
      />
    );

    expect(screen.getByText('DelegiertenV1')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
