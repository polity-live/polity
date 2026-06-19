/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NamedBallotResultsModel } from '../../logic/buildNamedBallotResults';
import { NamedBallotResultsDialog } from '../NamedBallotResultsDialog';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (
    key: string,
    paramsOrFallback?: string | Record<string, string | number | undefined | null>,
    fallback?: string
  ) => {
    if (key.includes('erfasst')) return 'erfasst';
    if (key.includes('offline_aggregiert')) return 'offline aggregiert';
    if (typeof paramsOrFallback === 'string') return paramsOrFallback;
    return fallback ?? key;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NamedBallotResultsDialog', () => {
  it('renders total option summaries above named result rows', () => {
    const model: NamedBallotResultsModel = {
      phase: 'final',
      isClosed: true,
      groupedBySourceGroup: false,
      groups: [
        {
          key: 'all',
          label: 'Alle Stimmberechtigten',
          rows: [
            {
              id: 'participant-1',
              displayName: 'Polity Tester',
              userId: 'user-1',
              userHandle: 'tester',
              avatar: null,
              selectionIds: ['candidate-1'],
              selections: ['Polity Tester'],
              kind: 'participant',
              status: 'recorded',
              statusLabel: 'Erfasst',
              isStruckThrough: false,
            },
          ],
          optionSummaries: [{ id: 'candidate-1', label: 'Polity Tester', count: 1 }],
          eligibleCount: 1,
          recordedCount: 1,
          offlineAggregatedCount: 0,
        },
      ],
      totalOptionSummaries: [
        {
          id: 'candidate-1',
          label: 'Polity Tester',
          namedCount: 1,
          offlineCount: 2,
          totalCount: 3,
        },
      ],
      totalEligibleCount: 1,
      totalRecordedCount: 1,
      totalOfflineAggregatedCount: 0,
    };

    render(
      <NamedBallotResultsDialog
        open
        onOpenChange={() => undefined}
        title="Delegiertenwahl: Delegate2on1"
        description="Live-Einzelansicht"
        model={model}
      />
    );

    expect(screen.getByText('Gesamtergebnis')).toBeTruthy();
    expect(screen.getByText('Polity Tester: 3')).toBeTruthy();
    expect(screen.getByText('(davon 2 offline)')).toBeTruthy();

    const userLink = screen.getByRole('link', { name: /Polity Tester/ });
    expect(userLink.getAttribute('href')).toBe('/user/user-1');
  });
});
