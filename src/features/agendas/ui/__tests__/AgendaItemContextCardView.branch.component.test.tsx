/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vote } from 'lucide-react';

const mocks = vi.hoisted(() => ({
  timeline: vi.fn((props: any) => (
    <div data-testid="timeline">
      {props.items.map((item: any) => (
        <div key={item.id}>
          {item.label}
          {item.description}
        </div>
      ))}
    </div>
  )),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => {
    const href = Object.entries(params ?? {}).reduce(
      (path: string, [key, value]) => path.replace(`$${key}`, String(value)),
      to
    );
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));
vi.mock('date-fns', () => ({
  format: (date: Date, pattern: string) => `${pattern}:${date.getTime()}`,
}));
vi.mock('@/features/shared/ui/timeline/CivicMotionTimeline', () => ({
  CivicMotionTimeline: (props: any) => mocks.timeline(props),
}));
vi.mock('../AgendaBadges', () => ({
  AgendaCountdownPill: ({ label, tone }: any) => (
    <span>
      {label}:{tone}
    </span>
  ),
  AgendaEndedPill: () => <span>ended-pill</span>,
  AgendaStatusBadge: ({ status }: any) => <span>status:{status}</span>,
  AgendaTypeBadge: ({ type }: any) => <span>type:{type}</span>,
  AgendaElectionModeBadge: ({ electionMode, seatCount }: any) => (
    <span>
      mode:{electionMode}:{seatCount}
    </span>
  ),
}));
vi.mock('@/features/amendments/ui/AmendmentProcessDetailsPanel', () => ({
  AmendmentProcessDetailsPanel: ({ variant, defaultOpen }: any) => (
    <div data-testid="amendment-panel">
      {variant}:{String(defaultOpen)}
    </div>
  ),
}));
vi.mock('../ElectionDetailsSectionView', () => ({
  ElectionDetailsSectionView: () => <div data-testid="election-details" />,
}));

import {
  AgendaItemContextCardView,
  agendaItemContextCardViewTestApi,
} from '../AgendaItemContextCardView';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string, fallback?: string) => fallback ?? key;
const relative = (date: Date) => `relative:${date.getTime()}`;

function props(overrides: Record<string, unknown> = {}) {
  return {
    agendaItem: {
      id: 'agenda-1',
      title: 'Budget',
      description: '',
      type: 'vote',
      status: 'pending',
    },
    amendment: null,
    amendmentForwardingPreview: null,
    amendmentPathVisualizationData: null,
    amendmentGroupTypeById: new Map(),
    onAmendmentGroupClick: vi.fn(),
    onAmendmentEventClick: vi.fn(),
    election: null,
    votingStartTime: null,
    votingEndTime: null,
    showHeaderStatusBadge: false,
    agendaDetailLink: null,
    className: '',
    presentation: 'standalone',
    t,
    i18n: {},
    navigate: vi.fn(),
    locale: {} as never,
    TypeIcon: Vote,
    gradientClass: '',
    durationMinutes: null,
    estimatedDurationMinutes: 30,
    scheduledAt: null,
    actualStartedAt: null,
    actualCompletedAt: null,
    estimatedStartedAt: null,
    estimatedCompletedAt: null,
    estimatedOngoingCompletedAt: null,
    isCompleted: false,
    isOngoing: false,
    now: 1_000,
    hasAgendaDetailLink: false,
    formatRelativeTime: relative,
    navigateToAgendaDetail: vi.fn(),
    electionDetailsController: { open: false, onOpenChange: vi.fn() },
    ...overrides,
  } as unknown as ComponentProps<typeof AgendaItemContextCardView>;
}

describe('AgendaItemContextCardView pure branches', () => {
  it('validates, formats, merges, sorts, and activates timeline entries', () => {
    const api = agendaItemContextCardViewTestApi;
    expect(api.isValidAgendaDate(new Date(0))).toBe(true);
    expect(api.isValidAgendaDate(new Date(Number.NaN))).toBe(false);
    expect(api.isValidAgendaDate('2026-01-01')).toBe(false);
    expect(api.formatAgendaDateTime(new Date(5), {} as never)).toBe('dd.MM.yyyy p:5');

    const items = [
      { id: 'late', label: 'Late', timestamp: 120_000, tone: 'info', value: 'late' },
      { id: 'early', label: 'Early', timestamp: 0, tone: 'info', value: 'early' },
      { id: 'near', label: 'Near', timestamp: 60_000, tone: 'info', value: 'near' },
    ] as never;
    const merged = api.mergeAgendaTimelineItems(items);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.label).toContain('Early / Near');
    expect(api.getAgendaTimelineActiveIndex(merged, -1)).toBe(0);
    expect(api.getAgendaTimelineActiveIndex(merged, 200_000)).toBe(1);
  });
});

describe('AgendaItemContextCardView presentation branches', () => {
  it('renders embedded amendment and election sections and omits missing sections', () => {
    const { rerender } = render(
      <AgendaItemContextCardView
        {...props({
          presentation: 'embedded',
          amendment: { id: 'amendment-1' },
          election: { role: { id: 'role-1' } },
        })}
      />
    );
    expect(screen.getByTestId('amendment-panel').textContent).toBe('agenda:false');
    expect(screen.getByTestId('election-details')).toBeTruthy();

    rerender(<AgendaItemContextCardView {...props({ presentation: 'embedded' })} />);
    expect(screen.queryByTestId('amendment-panel')).toBeNull();
    expect(screen.queryByTestId('election-details')).toBeNull();
  });

  it('renders future estimated and voting timing with linked metadata', () => {
    const start = new Date(100_000);
    const end = new Date(200_000);
    const voteStart = new Date(300_000);
    const voteEnd = new Date(400_000);
    const navigateToAgendaDetail = vi.fn();
    const { container } = render(
      <AgendaItemContextCardView
        {...props({
          agendaItem: {
            id: 'agenda-1',
            title: 'Budget',
            description: 'Description',
            type: 'election',
            status: 'pending',
          },
          amendment: { id: 'amendment-1' },
          election: { election_mode: 'list', seat_count: 3, role: { id: 'role-1' } },
          estimatedStartedAt: start,
          estimatedCompletedAt: end,
          votingStartTime: voteStart,
          votingEndTime: voteEnd,
          durationMinutes: 15,
          showHeaderStatusBadge: true,
          agendaDetailLink: { eventId: 'event-1', agendaItemId: 'agenda-1' },
          hasAgendaDetailLink: true,
          navigateToAgendaDetail,
        })}
      />
    );
    expect(screen.getByTestId('timeline')).toBeTruthy();
    expect(document.body.textContent).toContain('status:pending');
    expect(document.body.textContent).toContain('mode:list:3');
    expect(document.body.textContent).toContain('Description');
    const header = container.querySelector(
      '[data-action-id="agendas.context-card.detail.navigate"]'
    )!;
    fireEvent.click(header);
    fireEvent.keyDown(header, { key: 'Escape' });
    fireEvent.keyDown(header, { key: 'Enter' });
    fireEvent.keyDown(header, { key: ' ' });
    expect(navigateToAgendaDetail).toHaveBeenCalledTimes(3);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/event/event-1/agenda/agenda-1'
    );
  });

  it('renders completed actual timing and past voting completion with amendment navigation', () => {
    const actualStart = new Date(500);
    const actualEnd = new Date(800);
    const { container } = render(
      <AgendaItemContextCardView
        {...props({
          amendment: { id: 'amendment-1' },
          actualStartedAt: actualStart,
          actualCompletedAt: actualEnd,
          estimatedStartedAt: new Date(100),
          estimatedCompletedAt: new Date(900),
          votingStartTime: new Date(400),
          votingEndTime: new Date(700),
          isCompleted: true,
          now: 1_000,
        })}
      />
    );
    expect(document.body.textContent).toContain('ended-pill');
    expect(
      container
        .querySelector('[data-action-id="agendas.context-card.amendment.navigate"]')
        ?.getAttribute('href')
    ).toBe('/amendment/amendment-1');
  });

  it('renders ongoing timing before and after its estimate and a plain title', () => {
    const { rerender } = render(
      <AgendaItemContextCardView
        {...props({
          actualStartedAt: new Date(500),
          estimatedOngoingCompletedAt: new Date(2_000),
          isOngoing: true,
        })}
      />
    );
    expect(document.body.textContent).toContain('features.events.agenda.endsIn:active');

    rerender(
      <AgendaItemContextCardView
        {...props({
          actualStartedAt: new Date(500),
          estimatedOngoingCompletedAt: new Date(900),
          isOngoing: true,
        })}
      />
    );
    expect(screen.queryByText('features.events.agenda.endsIn:active')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();

    rerender(
      <AgendaItemContextCardView
        {...props({
          estimatedCompletedAt: new Date(900),
        })}
      />
    );
    expect(screen.queryByText('features.events.agenda.endsIn:end')).toBeNull();
  });

  it('ignores invalid dates and merges coincident timeline events', () => {
    const invalid = new Date(Number.NaN);
    render(
      <AgendaItemContextCardView
        {...props({
          estimatedStartedAt: invalid,
          estimatedCompletedAt: new Date(100_000),
          votingStartTime: new Date(5_000),
          votingEndTime: new Date(5_000),
          now: 4_000,
        })}
      />
    );
    expect(mocks.timeline.mock.calls[0]?.[0].items[0].label).toContain('/');
  });
});
