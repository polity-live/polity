/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalendarFilterBar } from '../CalendarFilterBar';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? `translated:${key}`,
  }),
  translate: (key: string, fallback?: string) => fallback ?? `translated:${key}`,
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

afterEach(() => cleanup());

describe('CalendarFilterBar', () => {
  it('renders defaults, updates both inputs, and clears active filters', () => {
    const onSearchChange = vi.fn();
    const onDateFilterChange = vi.fn();
    const { container } = render(
      <CalendarFilterBar
        searchQuery="assembly"
        onSearchChange={onSearchChange}
        dateFilter="2030-01-02"
        onDateFilterChange={onDateFilterChange}
        middleFilter={<span>Middle filter</span>}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'translated:features.calendar.search.placeholder'
    );
    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(searchInput, { target: { value: 'council' } });
    fireEvent.change(dateInput, { target: { value: '2030-02-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.click(screen.getByText('translated:features.calendar.search.clearDate'));

    expect(onSearchChange.mock.calls).toEqual([['council'], ['']]);
    expect(onDateFilterChange.mock.calls).toEqual([['2030-02-03'], ['']]);
    expect(screen.getByText('Middle filter')).toBeTruthy();
  });

  it('uses custom copy and hides optional controls for empty filters', () => {
    render(
      <CalendarFilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        dateFilter=""
        onDateFilterChange={vi.fn()}
        searchPlaceholder="Find meetings"
        clearSearchLabel="Reset query"
        clearDateLabel="Reset date"
      />
    );

    expect(screen.getByPlaceholderText('Find meetings')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset query' })).toBeNull();
    expect(screen.queryByText('Reset date')).toBeNull();
    expect(screen.queryByText('Middle filter')).toBeNull();
  });

  it('uses custom clear labels when their controls are visible', () => {
    render(
      <CalendarFilterBar
        searchQuery="query"
        onSearchChange={vi.fn()}
        dateFilter="2030-01-02"
        onDateFilterChange={vi.fn()}
        clearSearchLabel="Reset query"
        clearDateLabel="Reset date"
      />
    );

    expect(screen.getByRole('button', { name: 'Reset query' })).toBeTruthy();
    expect(screen.getByText('Reset date')).toBeTruthy();
  });
});
