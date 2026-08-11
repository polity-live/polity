/* @vitest-environment jsdom */

import { useMemo, useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { filterAndSortContentItems } from '../logic/searchFiltering';

const items = [
  {
    id: 'group-1',
    type: 'group',
    title: 'Climate Council',
    createdAt: new Date('2026-08-10T10:00:00Z'),
    tags: ['climate'],
    stats: { members: 8 },
  },
  {
    id: 'event-1',
    type: 'event',
    title: 'Budget Assembly',
    createdAt: new Date('2026-08-09T10:00:00Z'),
    tags: ['budget'],
    stats: { comments: 3 },
  },
] as any[];

function SearchFlow() {
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<any[]>(['group', 'event']);
  const [topic, setTopic] = useState<string[]>([]);
  const results = useMemo(
    () =>
      filterAndSortContentItems(items, {
        contentTypes: types,
        dateRange: 'all',
        topics: topic,
        engagement: 'all',
        sortBy: 'recent',
      }).filter(item => item.title.toLowerCase().includes(query.toLowerCase())),
    [query, topic, types]
  );
  return (
    <section>
      <label>
        Search
        <input value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <button type="button" onClick={() => setTypes(['group'])}>
        Groups only
      </button>
      <button type="button" onClick={() => setTopic(['climate'])}>
        Climate topic
      </button>
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      {results.length === 0 ? <p role="status">No matching results</p> : null}
    </section>
  );
}

afterEach(cleanup);

describe('global search component flow', () => {
  it('searches across entity types and opens the matching result set', () => {
    renderComponentFlow(<SearchFlow />, { initialUrl: '/search?q=' });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'budget' } });
    expect(screen.getByText('Budget Assembly')).toBeTruthy();
    expect(screen.queryByText('Climate Council')).toBeNull();
  });

  it('combines entity and topic filters deterministically', () => {
    renderComponentFlow(<SearchFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'Groups only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Climate topic' }));
    expect(screen.getByText('Climate Council')).toBeTruthy();
    expect(screen.queryByText('Budget Assembly')).toBeNull();
  });

  it('renders an observable empty state for a failed match', () => {
    renderComponentFlow(<SearchFlow />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'does-not-exist' } });
    expect(screen.getByRole('status').textContent).toBe('No matching results');
  });
});
