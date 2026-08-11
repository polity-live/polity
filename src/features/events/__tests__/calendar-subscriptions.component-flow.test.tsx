/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { EventSubscribeButtonView } from '../ui/EventSubscribeButtonView';
import { CalendarSearchFilter } from '../ui/calendar/CalendarSearchFilter';

afterEach(cleanup);

const events = [
  { id: 'assembly', calendar: 'Governance', title: 'General Assembly' },
  { id: 'social', calendar: 'Community', title: 'Community Picnic' },
];

function CalendarSubscriptionFlow() {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [calendar, setCalendar] = useState('all');
  const [subscribed, setSubscribed] = useState(false);
  const visible = useMemo(
    () =>
      events.filter(
        event =>
          (calendar === 'all' || event.calendar === calendar) &&
          event.title.toLowerCase().includes(query.toLowerCase())
      ),
    [calendar, query]
  );
  return (
    <div>
      <CalendarSearchFilter
        searchQuery={query}
        onSearchChange={setQuery}
        dateFilter={date}
        onDateFilterChange={setDate}
        searchPlaceholder="Search calendar"
        middleFilter={
          <label>
            Calendar
            <select value={calendar} onChange={event => setCalendar(event.target.value)}>
              <option value="all">All</option>
              <option value="Governance">Governance</option>
              <option value="Community">Community</option>
            </select>
          </label>
        }
      />
      <ul>
        {visible.map(event => (
          <li key={event.id}>{event.title}</li>
        ))}
      </ul>
      <output aria-label="subscription-state">{subscribed ? 'subscribed' : 'unsubscribed'}</output>
      <EventSubscribeButtonView
        eventId="assembly"
        isSubscribed={subscribed}
        isLoading={false}
        onSubscribeChange={vi.fn()}
        toggleSubscribe={vi.fn()}
        handleClick={() => setSubscribed(value => !value)}
      />
    </div>
  );
}

describe('calendar subscription component flow', () => {
  it('combines calendar and text filters before rendering matching events', () => {
    render(<CalendarSubscriptionFlow />);
    fireEvent.change(screen.getByLabelText('Calendar'), { target: { value: 'Governance' } });
    fireEvent.change(screen.getByPlaceholderText('Search calendar'), {
      target: { value: 'assembly' },
    });
    expect(screen.getByText('General Assembly')).toBeTruthy();
    expect(screen.queryByText('Community Picnic')).toBeNull();
  });

  it('toggles the subscription state and updates the action on the same rendered flow', () => {
    render(<CalendarSubscriptionFlow />);
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));
    expect(screen.getByLabelText('subscription-state').textContent).toBe('subscribed');
    expect(screen.getByRole('button', { name: /unsubscribe/i })).toBeTruthy();
  });
});
