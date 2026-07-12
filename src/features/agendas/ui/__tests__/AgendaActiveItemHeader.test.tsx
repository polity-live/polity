/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AgendaActiveItemHeader,
  getAgendaActiveItemTimingEntries,
} from '../AgendaActiveItemHeader';

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
    i18n: { language: 'en' },
  }),
}));

afterEach(cleanup);

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
});
