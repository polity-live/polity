/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DelegateAssemblyCompositionPanel } from '../DelegateAssemblyCompositionPanel';

const REFERENCE_TIME = vi.hoisted(() => new Date('2026-06-17T10:00:00Z').getTime());

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

vi.mock('@/features/charts/ui/ChartRenderer', () => ({
  CHART_PALETTE: ['#0f766e', '#2563eb', '#9333ea', '#d97706'],
  ChartRenderer: ({ points }: { points: { x: string; value: number }[] }) => (
    <div data-testid="composition-chart">
      {points.map(point => (
        <span key={point.x}>
          {point.x}:{point.value}
        </span>
      ))}
    </div>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => {
  const translations: Record<string, string> = {
    'features.events.participants.composition.title': 'Delegate Composition',
    'features.events.participants.composition.description': 'Seat distribution',
    'features.events.participants.composition.sectionTitles.planned': 'Planned delegates',
    'features.events.participants.composition.sectionTitles.scheduled': 'Scheduled delegates',
    'features.events.participants.composition.sectionTitles.elected': 'Elected delegates',
    'features.events.participants.composition.sectionDescriptions.planned': 'Planned seats',
    'features.events.participants.composition.sectionDescriptions.scheduled': 'Scheduled seats',
    'features.events.participants.composition.sectionDescriptions.elected': 'Elected seats',
    'features.events.participants.composition.columns.category': 'Category',
    'features.events.participants.composition.columns.absolute': 'Absolute',
    'features.events.participants.composition.columns.share': 'Share',
    'features.events.participants.composition.remainder.unscheduled': 'Unscheduled',
    'features.events.participants.composition.remainder.notYetElected': 'Not yet elected',
    'features.delegates.ratio.oneMember': '1 delegate per 1 member',
  };

  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        if (key === 'features.events.participants.composition.total') {
          return `${params?.count ?? 0} total seats`;
        }

        return translations[key] ?? key;
      },
    }),
  };
});

vi.mock('@/zero/events', () => ({
  useDelegateAssemblyCompositionData: () => ({
    event: {
      event_type: 'delegate_assembly',
      delegate_seat_allocation_type: 'members_per_delegate',
      main_group_delegate_allocation_mode: '1',
    },
    allocations: [
      {
        group_id: 'group-b1',
        allocated_seats: 2,
        group: { id: 'group-b1', name: 'B1' },
      },
      {
        group_id: 'group-b2',
        allocated_seats: 1,
        group: { id: 'group-b2', name: 'B2' },
      },
    ],
    delegates: [
      {
        group_id: 'group-b2',
        status: 'confirmed',
        seat_count: 1,
        group: { id: 'group-b2', name: 'B2' },
      },
    ],
    scheduledElections: [
      {
        description: `@delegate-election-meta ${JSON.stringify({
          kind: 'delegate_election',
          targetEventId: 'target-event',
          targetGroupId: 'target-group',
          sourceGroupId: 'group-b1',
          seatRoleIds: ['seat-1'],
          allSeatRoleIds: ['seat-1'],
          mode: 'single',
        })}`,
        agenda_item: {
          event: {
            id: 'subgroup-election-1',
            status: 'planned',
            start_date: REFERENCE_TIME + 1_000,
          },
        },
      },
    ],
    isLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('DelegateAssemblyCompositionPanel', () => {
  it('renders three composition charts with compact tables and linked group labels', () => {
    render(<DelegateAssemblyCompositionPanel eventId="target-event" />);

    expect(screen.getByText('Planned delegates')).toBeTruthy();
    expect(screen.getByText('Scheduled delegates')).toBeTruthy();
    expect(screen.getByText('Elected delegates')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1 delegate per 1 member')).toBeTruthy();
    expect(screen.getAllByTestId('composition-chart')).toHaveLength(3);
    expect(screen.getAllByText('Absolute')).toHaveLength(3);
    expect(screen.getAllByText('Share')).toHaveLength(3);
    expect(screen.getByText('Unscheduled')).toBeTruthy();
    expect(screen.getByText('Not yet elected')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'B1' })[0].getAttribute('href')).toBe(
      '/group/group-b1'
    );
  });
});
