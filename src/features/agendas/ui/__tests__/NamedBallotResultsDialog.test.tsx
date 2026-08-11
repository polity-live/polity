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
    if (key === 'features.events.agenda.defaultChoiceLabels.yes') return 'Yes';
    if (key === 'features.events.agenda.defaultChoiceLabels.no') return 'No';
    if (key === 'features.events.agenda.defaultChoiceLabels.abstain') return 'Abstain';
    if (typeof paramsOrFallback === 'string') return paramsOrFallback;
    return fallback ?? key;
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NamedBallotResultsDialog', () => {
  it.each([
    ['missing model', null],
    [
      'empty groups',
      {
        phase: 'indicative',
        isClosed: false,
        groupedBySourceGroup: false,
        groups: [],
        totalOptionSummaries: [],
        totalEligibleCount: 0,
        totalRecordedCount: 0,
        totalOfflineAggregatedCount: 0,
      } satisfies NamedBallotResultsModel,
    ],
  ])('renders the unavailable state for a %s', (_label, model) => {
    render(
      <NamedBallotResultsDialog
        open
        onOpenChange={() => undefined}
        title="Results"
        description="Details"
        model={model}
      />
    );
    expect(screen.getByText('features.events.agenda.namedResults.unavailable')).toBeTruthy();
  });

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

  it('localizes default vote choice labels in summaries and rows', () => {
    const model: NamedBallotResultsModel = {
      phase: 'final',
      isClosed: true,
      groupedBySourceGroup: true,
      groups: [
        {
          key: 'all',
          label: 'Alle Stimmberechtigten',
          rows: [
            {
              id: 'participant-1',
              displayName: 'Polity Tester',
              userId: null,
              userHandle: null,
              avatar: null,
              selectionIds: ['accept'],
              selections: ['accept'],
              kind: 'participant',
              status: 'recorded',
              statusLabel: 'Erfasst',
              isStruckThrough: false,
            },
          ],
          optionSummaries: [{ id: 'accept', label: 'accept', count: 1 }],
          eligibleCount: 1,
          recordedCount: 1,
          offlineAggregatedCount: 0,
        },
      ],
      totalOptionSummaries: [
        {
          id: 'accept',
          label: 'accept',
          namedCount: 1,
          offlineCount: 0,
          totalCount: 1,
        },
        {
          id: 'reject',
          label: 'reject',
          namedCount: 0,
          offlineCount: 0,
          totalCount: 0,
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
        title="Vote Results"
        description="Live-Einzelansicht"
        model={model}
      />
    );

    expect(screen.getAllByText(/Yes/).length).toBeGreaterThan(0);
    expect(screen.getByText('No: 0')).toBeTruthy();
    expect(screen.queryByText(/accept/)).toBeNull();
    expect(screen.queryByText(/reject/)).toBeNull();
  });

  it('renders indicative grouped fallbacks, empty selections, and every decision tone', () => {
    const model: NamedBallotResultsModel = {
      phase: 'indicative',
      isClosed: false,
      groupedBySourceGroup: true,
      groups: [
        {
          key: 'group-1',
          label: 'Working group',
          rows: [
            {
              id: 'offline',
              displayName: '   ',
              userId: 'user-1',
              userHandle: null,
              avatar: null,
              selectionIds: [],
              selections: [],
              kind: 'participant',
              status: 'offline_aggregated',
              statusLabel: 'Offline',
              isStruckThrough: true,
            },
            {
              id: 'missing',
              displayName: 'Anonymous User',
              userId: null,
              userHandle: 'anonymous',
              avatar: null,
              selectionIds: [],
              selections: [],
              kind: 'participant',
              status: 'missing' as unknown as 'recorded',
              statusLabel: 'Missing',
              isStruckThrough: true,
            },
            {
              id: 'decisions',
              displayName: 'Decision User',
              userId: null,
              userHandle: null,
              avatar: null,
              selectionIds: ['reject', 'abstain', 'custom'],
              selections: ['reject', 'abstain', 'custom'],
              kind: 'participant',
              status: 'recorded',
              statusLabel: 'Recorded',
              isStruckThrough: false,
            },
          ],
          optionSummaries: [
            { id: 'reject', label: 'reject', count: 0 },
            { id: 'abstain', label: 'abstain', count: 0 },
            { id: 'custom', label: 'custom', count: 0 },
          ],
          eligibleCount: 3,
          recordedCount: 1,
          offlineAggregatedCount: 1,
        },
      ],
      totalOptionSummaries: [
        { id: 'reject', label: 'reject', namedCount: 0, offlineCount: 0, totalCount: 0 },
        { id: 'abstain', label: 'abstain', namedCount: 0, offlineCount: 0, totalCount: 0 },
        { id: 'custom', label: 'custom', namedCount: 0, offlineCount: 0, totalCount: 0 },
      ],
      totalEligibleCount: 3,
      totalRecordedCount: 1,
      totalOfflineAggregatedCount: 1,
    };

    const { container } = render(
      <NamedBallotResultsDialog
        open
        onOpenChange={() => undefined}
        title="Indicative results"
        description="Details"
        model={model}
      />
    );

    expect(screen.getByText('Indication')).toBeTruthy();
    expect(screen.getAllByText(/offline aggregated/).length).toBeGreaterThan(0);
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(screen.getByText('@anonymous')).toBeTruthy();
    expect(screen.getByText('U')).toBeTruthy();
    expect(container.querySelectorAll('.line-through')).toHaveLength(2);
    expect(container.querySelectorAll('[style="width: 0%;"]')).toHaveLength(3);
  });

  it('omits the total summary strip when a populated model has no summaries', () => {
    const model: NamedBallotResultsModel = {
      phase: 'final',
      isClosed: true,
      groupedBySourceGroup: false,
      groups: [
        {
          key: 'all',
          label: 'All',
          rows: [],
          optionSummaries: [],
          eligibleCount: 0,
          recordedCount: 0,
          offlineAggregatedCount: 0,
        },
      ],
      totalOptionSummaries: [],
      totalEligibleCount: 0,
      totalRecordedCount: 0,
      totalOfflineAggregatedCount: 0,
    };
    render(
      <NamedBallotResultsDialog
        open
        onOpenChange={() => undefined}
        title="Results"
        description="Details"
        model={model}
      />
    );
    expect(screen.queryByText('Gesamtergebnis')).toBeNull();
  });
});
