// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventDeadlinesCard } from '../EventDeadlinesCard';

const timelineSpy = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

vi.mock('@/features/shared/ui/timeline/CivicMotionTimeline', () => ({
  CivicMotionTimeline: (props: unknown) => {
    timelineSpy(props);
    return <div data-testid="timeline" />;
  },
}));

describe('EventDeadlinesCard branch coverage', () => {
  const now = new Date('2026-08-09T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    timelineSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns nothing without enough valid timeline entries', () => {
    const { container, rerender } = render(
      <EventDeadlinesCard
        registrationDeadline={null}
        amendmentDeadline={undefined}
        candidacyDeadline={null}
        startDate={0}
        endDate={Number.POSITIVE_INFINITY}
      />
    );

    expect(container.innerHTML).toBe('');

    rerender(<EventDeadlinesCard startDate="not-a-date" endDate={Number.NaN} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders, sorts, and marks a mixed deadline schedule', () => {
    render(
      <EventDeadlinesCard
        registrationDeadline={now - 2 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000}
        amendmentDeadline={now + 45 * 60 * 1000}
        candidacyDeadline={now + 2 * 60 * 60 * 1000 + 15 * 60 * 1000}
        startDate={new Date(now + 24 * 60 * 60 * 1000).toISOString()}
        endDate={now + 3 * 24 * 60 * 60 * 1000}
      />
    );

    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeTruthy();
    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(
      screen.getAllByTestId('badge').some(badge => badge.dataset.variant === 'destructive')
    ).toBe(true);
    expect(
      screen.getAllByTestId('badge').some(badge => badge.dataset.variant === 'secondary')
    ).toBe(true);

    const props = timelineSpy.mock.calls[0]![0] as {
      activeIndex: number;
      items: { id: string; isActive: boolean; isComplete: boolean; tone: string }[];
    };
    expect(props.items.map(item => item.id)).toEqual([
      'registration-deadline',
      'amendment-deadline',
      'candidacy-deadline',
      'event-start',
      'event-end',
    ]);
    expect(props.activeIndex).toBe(0);
    expect(props.items[0]).toMatchObject({ isActive: true, isComplete: true, tone: 'danger' });
    expect(props.items[1]).toMatchObject({ isActive: false, isComplete: false, tone: 'warning' });
  });

  it('renders a single deadline without the motion timeline', () => {
    render(<EventDeadlinesCard registrationDeadline={now + 30 * 60 * 1000} />);

    expect(screen.getByRole('heading', { name: 'features.events.deadlines.title' })).toBeTruthy();
    expect(screen.queryByTestId('timeline')).toBeNull();
    expect(screen.getByText('0h 30m')).toBeTruthy();
  });

  it('renders a schedule made only from string event boundaries', () => {
    render(
      <EventDeadlinesCard
        startDate={new Date(now - 60 * 60 * 1000).toISOString()}
        endDate={new Date(now + 60 * 60 * 1000).toISOString()}
      />
    );

    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);
    const props = timelineSpy.mock.calls[0]![0] as {
      activeIndex: number;
      items: { isActive: boolean; isComplete: boolean }[];
    };
    expect(props.activeIndex).toBe(0);
    expect(props.items).toEqual([
      expect.objectContaining({ isActive: true, isComplete: true }),
      expect.objectContaining({ isActive: false, isComplete: false }),
    ]);
  });
});
