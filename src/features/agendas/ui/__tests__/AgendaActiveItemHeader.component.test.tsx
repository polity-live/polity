/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AgendaActiveItemHeader,
  getAgendaActiveItemTimingEntries,
} from '../AgendaActiveItemHeader';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params: Record<string, string>;
  }) => (
    <a href={to.replace('$id', params.id)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: {
      get language() {
        return mocks.language;
      },
    },
  }),
}));

afterEach(() => {
  cleanup();
  mocks.language = 'en';
});

describe('AgendaActiveItemHeader', () => {
  it('renders amendment identity, description, and group exactly once', () => {
    render(
      <AgendaActiveItemHeader
        topLabel="TOP-2"
        isLive
        status="active"
        type="amendment"
        title="Amendment: A1"
        description="Deterministic seed amendment."
        amendmentId="amendment-1"
        group={{ id: 'group-1', name: 'K1' }}
      />
    );

    expect(screen.getAllByText('Amendment: A1')).toHaveLength(1);
    expect(screen.getAllByText('Deterministic seed amendment.')).toHaveLength(1);
    expect(screen.getAllByText('K1')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Amendment: A1' }).getAttribute('href')).toBe(
      '/amendment/amendment-1'
    );
  });

  it('deduplicates voting times that match agenda start and end', () => {
    const start = new Date('2026-07-12T17:05:00.000Z');
    const end = new Date('2026-07-12T17:35:00.000Z');

    expect(
      getAgendaActiveItemTimingEntries({
        startAt: start,
        endAt: end,
        votingStartAt: new Date(start.getTime() + 30_000),
        votingEndAt: new Date(end.getTime() - 30_000),
      }).map(entry => entry.id)
    ).toEqual(['start', 'end']);
  });

  it('keeps voting times when they materially differ from agenda timing', () => {
    const start = new Date('2026-07-12T17:05:00.000Z');
    const end = new Date('2026-07-12T17:35:00.000Z');

    expect(
      getAgendaActiveItemTimingEntries({
        startAt: start,
        endAt: end,
        votingStartAt: new Date(start.getTime() + 120_000),
        votingEndAt: new Date(end.getTime() - 120_000),
      }).map(entry => entry.id)
    ).toEqual(['start', 'end', 'voting-start', 'voting-end']);
  });

  it('normalizes absent, invalid, numeric, and one-sided timing values', () => {
    expect(getAgendaActiveItemTimingEntries()).toEqual([]);
    expect(
      getAgendaActiveItemTimingEntries({
        startAt: 'invalid',
        endAt: null,
        votingStartAt: '2026-07-12T17:05:00.000Z',
        votingEndAt: undefined,
      }).map(entry => entry.id)
    ).toEqual(['voting-start']);
    expect(
      getAgendaActiveItemTimingEntries({
        startAt: new Date('2026-07-12T17:05:00.000Z').getTime(),
        votingStartAt: null,
        votingEndAt: '2026-07-12T17:35:00.000Z',
      }).map(entry => entry.id)
    ).toEqual(['start', 'voting-end']);
  });

  it('renders estimated timing, duration, action, and linked group in German locale', () => {
    mocks.language = 'de';
    const { container } = render(
      <AgendaActiveItemHeader
        status="pending"
        type="vote"
        title="Budget"
        group={{ id: 'group-1', name: 'Board' }}
        action={<button>Action</button>}
        className="custom"
        timing={{
          startAt: '2026-07-12T17:05:00.000Z',
          endAt: '2026-07-12T17:35:00.000Z',
          votingStartAt: '2026-07-12T17:10:00.000Z',
          votingEndAt: '2026-07-12T17:30:00.000Z',
          durationMinutes: 30,
          startIsEstimated: true,
          endIsEstimated: true,
        }}
      />
    );
    expect(container.textContent).toContain('Estimated start');
    expect(container.textContent).toContain('Estimated end');
    expect(container.textContent).toContain('Voting start');
    expect(container.textContent).toContain('Voting end');
    expect(screen.getByRole('link', { name: 'Board' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();
    expect(container.querySelector('.lucide-arrow-right')).toBeTruthy();
  });

  it('omits optional identity and timing sections for empty values', () => {
    const { container } = render(
      <AgendaActiveItemHeader
        topLabel={null}
        isLive={false}
        status="pending"
        type="discussion"
        title="Budget"
        description={null}
        amendmentId={null}
        group={{ id: 'group-1', name: null }}
        timing={{ durationMinutes: 0 }}
        action={null}
      />
    );
    expect(container.querySelector('.lucide-clock-3')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders actual start and completion labels when estimates are false', () => {
    const { container } = render(
      <AgendaActiveItemHeader
        status="completed"
        type="discussion"
        title="Budget"
        timing={{
          startAt: '2026-07-12T17:05:00.000Z',
          endAt: '2026-07-12T17:35:00.000Z',
          startIsEstimated: false,
          endIsEstimated: false,
        }}
      />
    );
    expect(container.textContent).toContain('Started');
    expect(container.textContent).toContain('Completed');
  });
});
