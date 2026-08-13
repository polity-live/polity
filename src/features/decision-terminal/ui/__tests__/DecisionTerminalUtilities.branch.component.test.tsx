/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DecisionSummary, DecisionSummaryCompact } from '../DecisionSummary';
import { FlashCell, FlashIndicator, FlashRow } from '../FlashRow';
import {
  TrendArrow,
  TrendIndicator,
  formatPercentageChange,
  getTrendConfig,
} from '../TrendIndicator';
import { useDecisionRowController } from '../useDecisionRowController';
import type { DecisionItem } from '../types';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const flash = (type: 'up' | 'down' | 'neutral', intensity: 'low' | 'medium' | 'high' = 'low') => ({
  itemId: `${type}-${intensity}`,
  type,
  intensity,
  timestamp: 1,
});

describe('FlashRow utilities', () => {
  it('renders absent and every flash direction with and without glow', () => {
    const { rerender, container } = render(<FlashRow>Plain</FlashRow>);
    expect(container.firstElementChild?.getAttribute('data-flashing')).toBe('false');
    for (const type of ['up', 'down', 'neutral'] as const) {
      rerender(<FlashRow flashState={flash(type)}>{type}</FlashRow>);
      expect(container.firstElementChild?.getAttribute('data-flash-type')).toBe(type);
    }
    rerender(
      <FlashRow flashState={flash('down')} showGlow={false}>
        no glow
      </FlashRow>
    );
  });

  it('renders flash cells and indicator sizes for all directions', () => {
    const { rerender, container } = render(<FlashCell>Plain</FlashCell>);
    for (const type of ['up', 'down', 'neutral'] as const) {
      rerender(<FlashCell flashState={flash(type)}>{type}</FlashCell>);
    }
    rerender(<FlashIndicator />);
    expect(container.firstElementChild).toBeNull();
    const cases = [
      ['up', 'sm'],
      ['down', 'md'],
      ['neutral', 'lg'],
    ] as const;
    for (const [type, size] of cases) {
      rerender(<FlashIndicator flashState={flash(type)} size={size} />);
      expect(container.querySelector('span')).toBeTruthy();
    }
  });
});

describe('TrendIndicator utilities', () => {
  it('maps every trend and formats signed percentages', () => {
    for (const direction of ['up', 'down', 'stable', 'volatile'] as const) {
      expect(getTrendConfig(direction).symbol).toBeTruthy();
    }
    expect(getTrendConfig('unexpected' as any).symbol).toBe('●');
    expect(formatPercentageChange(2.4)).toBe('+2%');
    expect(formatPercentageChange(-2.6)).toBe('-3%');
  });

  it('renders compact, expanded, hidden-percentage, and arrow variants', () => {
    const { rerender } = render(
      <TrendIndicator trend={{ direction: 'up', percentage: 4 }} compact />
    );
    expect(screen.getByText('+4%')).toBeTruthy();
    rerender(
      <TrendIndicator
        trend={{ direction: 'down', percentage: -3 }}
        compact
        showPercentage={false}
      />
    );
    expect(screen.queryByText('-3%')).toBeNull();
    rerender(<TrendIndicator trend={{ direction: 'stable', percentage: 0 }} />);
    expect(screen.getByText('+0%')).toBeTruthy();
    rerender(
      <TrendIndicator trend={{ direction: 'volatile', percentage: 8 }} showPercentage={false} />
    );
    expect(screen.queryByText('+8%')).toBeNull();
    rerender(<TrendArrow direction="up" />);
    expect(screen.getByText('▲')).toBeTruthy();
  });
});

describe('DecisionSummary controllers', () => {
  const sections = [
    { type: 'summary' as const, title: 'Summary', content: 'First' },
    { type: 'impact' as const, title: 'Impact', content: 'Second' },
  ];

  it('handles empty, default, collapsed, and compact summary states', () => {
    const empty = render(<DecisionSummary sections={[]} />);
    const { container } = empty;
    expect(container.firstElementChild).toBeNull();
    empty.unmount();

    const summary = render(<DecisionSummary sections={sections} />);
    fireEvent.click(
      summary.container.querySelector<HTMLElement>(
        '[data-action-id="decision-terminal.summary.collapse-all"]'
      )!
    );
    fireEvent.click(
      summary.container.querySelector<HTMLElement>(
        '[data-action-id="decision-terminal.summary.expand-all"]'
      )!
    );
    fireEvent.click(
      summary.container.querySelectorAll<HTMLElement>(
        '[data-action-id="decision-terminal.summary.section.toggle"]'
      )[0]
    );
    fireEvent.click(
      summary.container.querySelectorAll<HTMLElement>(
        '[data-action-id="decision-terminal.summary.section.toggle"]'
      )[0]
    );
    summary.unmount();

    const collapsed = render(
      <DecisionSummary sections={sections} defaultCollapsed maxContentHeight={10} />
    );
    expect(screen.getByText('Summary')).toBeTruthy();
    collapsed.unmount();

    const compact = render(<DecisionSummaryCompact summary={'Compact summary '.repeat(20)} />);
    const toggle = compact.container.querySelector<HTMLElement>(
      '[data-action-id="decision-terminal.summary.compact.toggle"]'
    )!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
  });
});

describe('useDecisionRowController', () => {
  const base = (overrides: Partial<DecisionItem> = {}) =>
    ({
      id: 'decision-1',
      type: 'vote',
      title: 'Decision',
      body: 'Body',
      endsAt: new Date().toISOString(),
      status: 'active',
      visibility: 'public',
      trend: { direction: 'stable', percentage: 0 },
      isClosed: false,
      ...overrides,
    }) as DecisionItem;

  it('maps vote and sparse election rows', () => {
    const { result, rerender } = renderHook(
      ({ decision }) => useDecisionRowController({ decision }),
      { initialProps: { decision: base() } }
    );
    expect(result.current.electionBarData).toBeNull();

    rerender({ decision: base({ type: 'election', candidates: [] }) });
    expect(result.current.electionBarData).toBeNull();
    rerender({
      decision: base({
        type: 'election',
        isIndicationPhase: true,
        candidates: [
          { id: 'b', name: 'Beta', votes: 2, indicationVotes: undefined, isWinner: false },
          { id: 'a', name: 'Alpha', votes: 0, indicationVotes: 0, isWinner: false },
        ],
      }),
    });
    expect(result.current.electionBarData?.totalSelections).toBe(0);
    expect(result.current.electionBarData?.candidates.map(item => item.label)).toEqual([
      'Alpha',
      'Beta',
    ]);

    rerender({
      decision: base({
        type: 'election',
        isIndicationPhase: false,
        votedCount: 4,
        candidates: [
          { id: 'a', name: 'Alpha', votes: undefined as any, isWinner: false },
          { id: 'b', name: 'Beta', votes: 3, isWinner: false },
        ],
      }),
    });
    expect(result.current.electionBarData?.totalSelections).toBe(4);
  });

  it('flashes only for significant trend changes and clears the timer', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ percentage }) =>
        useDecisionRowController({ decision: base({ trend: { direction: 'up', percentage } }) }),
      { initialProps: { percentage: 0 } }
    );
    rerender({ percentage: 1 });
    expect(result.current.isFlashing).toBe(false);
    rerender({ percentage: 3 });
    expect(result.current.isFlashing).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isFlashing).toBe(false);
    rerender({ percentage: 6 });
    unmount();
  });
});
