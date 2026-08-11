/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  progressValues: [] as unknown[],
  shareProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) =>
      typeof params === 'string' ? params : params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: ({ value }: { value: unknown }) => {
    mocks.progressValues.push(value);
    return <div data-testid="progress" />;
  },
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href }: { children: ReactNode; href?: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: (props: Record<string, any>) => {
    mocks.shareProps = props;
    return <button type="button">Share</button>;
  },
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ children, title, badge }: any) => (
    <header>
      {title}
      {badge}
      {children}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardActions: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
}));

import {
  VoteTimelineCard,
  formatVoteCountPercent,
  formatVoteTimeRemaining,
  normalizeVotePercent,
  type VoteTimelineCardProps,
} from '../VoteTimelineCard';

const baseVote: VoteTimelineCardProps['vote'] = {
  id: 'vote-1',
  amendmentId: 'amendment-1',
  amendmentTitle: 'Budget amendment',
  status: 'open',
  supportPercentage: 60,
  supportCount: 6,
  opposeCount: 4,
};

function renderVote(overrides: Partial<VoteTimelineCardProps['vote']> = {}, props = {}) {
  return render(<VoteTimelineCard vote={{ ...baseVote, ...overrides }} {...props} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  mocks.baseProps = undefined;
  mocks.shareProps = undefined;
  mocks.progressValues = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('vote formatters', () => {
  const t = (key: string, values?: any) => (values ? `${key}:${JSON.stringify(values)}` : key);

  it('formats ended, day, hour, and minute countdown ranges', () => {
    expect(formatVoteTimeRemaining(new Date('2026-08-09T11:00:00Z'), t)).toContain('ended');
    expect(formatVoteTimeRemaining(new Date('2026-08-11T14:00:00Z'), t)).toContain('"days":2');
    expect(formatVoteTimeRemaining(new Date('2026-08-09T14:03:04Z'), t)).toBe('2:03:04');
    expect(formatVoteTimeRemaining(new Date('2026-08-09T12:03:04Z'), t)).toBe('3:04');
  });

  it('normalizes non-finite, missing, low, high, and ordinary percentages', () => {
    expect(normalizeVotePercent(Number.NaN)).toBe(0);
    expect(normalizeVotePercent(Infinity)).toBe(0);
    expect(normalizeVotePercent(null)).toBe(0);
    expect(normalizeVotePercent(-10)).toBe(0);
    expect(normalizeVotePercent(120)).toBe(100);
    expect(normalizeVotePercent(42.4)).toBe(42.4);
    expect(formatVoteCountPercent(undefined, undefined)).toBe('0 · 0%');
  });
});

describe('VoteTimelineCard', () => {
  it('renders a rich active agenda vote with turnout, trend, abstentions, and user vote', () => {
    renderVote({
      question: 'Approve it?',
      endTime: '2026-08-11T14:00:00Z',
      abstainCount: 2,
      totalVoters: 20,
      votedCount: 10,
      trend: 'up',
      trendPercentage: 5,
      hasVoted: true,
      userVote: 'support',
      agendaEventId: 'event-1',
      agendaItemId: 'item-1',
    });

    expect(mocks.baseProps?.href).toBe('/event/event-1/agenda/item-1');
    expect(document.body.textContent).toContain('Approve it?');
    expect(document.body.textContent).toContain('50%');
    expect(document.body.textContent).toContain('features.timeline.cards.voted');
    expect(mocks.shareProps?.url).toBe('/event/event-1/agenda/item-1');
  });

  it.each([
    ['closing_soon', '2026-08-09T14:03:04Z'],
    ['last_hour', '2026-08-09T12:03:04Z'],
    ['final_minutes', '2026-08-09T11:00:00Z'],
  ] as const)('renders the %s active timer state', (status, endTime) => {
    renderVote({ status, endTime });
    expect(document.body.textContent).toContain(`features.timeline.cards.voteStatus.${status}`);
  });

  it('uses explicit and amendment destinations when agenda linkage is incomplete', () => {
    renderVote({ agendaEventId: 'event-1' }, { href: '/custom' });
    expect(mocks.baseProps?.href).toBe('/custom');
    cleanup();
    renderVote({ agendaEventId: 'event-1', agendaItemId: undefined });
    expect(mocks.baseProps?.href).toBe('/amendment/amendment-1');
  });

  it('renders down and stable trend variants below the support threshold', () => {
    renderVote({ supportPercentage: 40, trend: 'down', trendPercentage: 2 });
    expect(document.body.textContent).toContain('2%');
    cleanup();
    renderVote({ supportPercentage: 40, trend: 'stable', trendPercentage: 2 });
    expect(document.body.textContent).not.toContain('2%');
  });

  it('toggles indication results beside final results', () => {
    renderVote({
      status: 'passed',
      indicationSupportPercentage: 55,
      indicationSupportCount: 11,
      indicationOpposeCount: 9,
    });
    const toggle = screen.getByText('Show indication results');
    expect(document.body.textContent).not.toContain('11 · 55%');
    fireEvent.click(toggle);
    expect(document.body.textContent).toContain('11 · 55%');
    expect(screen.getByText('Hide indication results')).toBeTruthy();
  });

  it('shows only indication-phase rows with optional abstentions', () => {
    renderVote({
      isIndicationPhase: true,
      indicationSupportPercentage: 120,
      indicationSupportCount: 3,
      indicationOpposeCount: 2,
      indicationAbstainCount: 1,
    });
    expect(document.body.textContent).toContain('3 · 100%');
    expect(document.body.textContent).toContain('1 *');
    expect(mocks.progressValues).toEqual([120]);

    cleanup();
    renderVote({ isIndicationPhase: true, indicationSupportPercentage: undefined });
    expect(document.body.textContent).not.toContain('features.timeline.cards.actual');
  });

  it.each(['failed', 'tied'] as const)(
    'renders the completed %s status without a timer',
    status => {
      renderVote({ status, endTime: '2026-08-09T14:00:00Z' });
      expect(document.body.textContent).not.toContain('2:00:00');
    }
  );

  it('falls back safely for an unknown runtime status and absent count metadata', () => {
    renderVote({
      status: 'runtime' as any,
      abstainCount: undefined,
      totalVoters: 0,
      votedCount: 0,
      trend: undefined,
      question: undefined,
      supportPercentage: Number.NaN,
    });
    expect(mocks.baseProps?.href).toBe('/amendment/amendment-1');
    expect(document.body.textContent).toContain('6 · 0%');
    expect(document.body.textContent).not.toContain('features.timeline.cards.turnout');
  });
});
