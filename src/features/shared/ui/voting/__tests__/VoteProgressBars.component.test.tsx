// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipHint: ({ children, content }: { children?: ReactNode; content: string }) => (
    <div data-tooltip={content}>{children}</div>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      values?.count === undefined ? key : `${key}:${values.count}`,
  }),
  translate: (key: string) => key,
}));

import {
  calculateVotePercentages,
  CandidateBarCompact,
  GroupedVoteResultBar,
  VoteBarCompact,
  VoteProgressBar,
  type VoteOption,
} from '../VoteProgressBars';

afterEach(cleanup);

describe('VoteProgressBars', () => {
  it('calculates percentages for empty and populated votes', () => {
    expect(calculateVotePercentages({ support: 0, oppose: 0, abstain: 0 })).toEqual({
      support: 0,
      oppose: 0,
      abstain: 0,
    });
    expect(calculateVotePercentages({ support: 2, oppose: 1, abstain: 3 })).toEqual({
      support: 33,
      oppose: 17,
      abstain: 50,
    });
  });

  it('renders the empty bar and all default animated segments', () => {
    const empty = render(
      <VoteProgressBar votes={{ support: 0, oppose: 0, abstain: 0 }} className="empty" />
    );
    expect(empty.container.firstElementChild?.classList.contains('empty')).toBe(true);
    expect(screen.queryByRole('progressbar')).toBeNull();
    empty.unmount();

    const { container } = render(
      <VoteProgressBar votes={{ support: 3, oppose: 2, abstain: 1 }} className="result" />
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(container.querySelectorAll('[data-tooltip]')).toHaveLength(3);
    expect(container.querySelectorAll('.duration-500')).toHaveLength(3);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByText('17%')).toBeTruthy();
  });

  it('supports compact static bars, labels, hidden percentages, and absent segments', () => {
    const { container } = render(
      <VoteProgressBar
        votes={{ support: 4, oppose: 0, abstain: 0 }}
        showLabels
        showPercentages={false}
        compact
        animated={false}
      />
    );
    expect(screen.getByRole('progressbar').classList.contains('h-2')).toBe(true);
    expect(container.querySelectorAll('[data-tooltip]')).toHaveLength(1);
    expect(container.querySelector('.duration-500')).toBeNull();
    expect(screen.getByText('features.timeline.terminal.support')).toBeTruthy();
    expect(screen.getByText('features.timeline.terminal.oppose')).toBeTruthy();
    expect(screen.getByText('features.timeline.terminal.abstain')).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('can suppress the legend and covers each non-animated segment independently', () => {
    const first = render(
      <VoteProgressBar
        votes={{ support: 0, oppose: 2, abstain: 1 }}
        showLabels={false}
        showPercentages={false}
        animated={false}
      />
    );
    expect(first.container.querySelectorAll('[data-tooltip]')).toHaveLength(2);
    expect(first.container.querySelector('.text-xs')).toBeNull();
    first.unmount();

    const second = render(
      <VoteProgressBar
        votes={{ support: 1, oppose: 0, abstain: 1 }}
        showPercentages
        animated={false}
      />
    );
    expect(second.container.querySelectorAll('[data-tooltip]')).toHaveLength(2);
    second.unmount();

    const withoutAbstention = render(
      <VoteProgressBar votes={{ support: 1, oppose: 0, abstain: 0 }} showPercentages />
    );
    expect(withoutAbstention.container.querySelectorAll('[data-tooltip]')).toHaveLength(1);
  });

  it('renders compact vote and candidate stacks, including empty and filtered segments', () => {
    const vote = render(
      <VoteBarCompact votes={{ support: 2, oppose: 0, abstain: 1 }} className="votes" />
    );
    expect(vote.container.querySelectorAll('[data-tooltip]')).toHaveLength(2);
    expect(vote.container.firstElementChild?.classList.contains('votes')).toBe(true);
    expect(vote.container.querySelector('[style="width: 67%;"]')).toBeTruthy();
    vote.unmount();

    const candidates = render(
      <CandidateBarCompact
        className="candidates"
        candidates={[
          { id: 'a', label: 'A', value: 1 },
          { id: 'b', label: 'B', value: 0 },
          { id: 'c', label: 'C', value: 1 },
          { id: 'd', label: 'D', value: 1 },
          { id: 'e', label: 'E', value: 1 },
          { id: 'f', label: 'F', value: 1 },
          { id: 'g', label: 'G', value: 1 },
        ]}
      />
    );
    expect(candidates.container.querySelectorAll('[data-tooltip]')).toHaveLength(6);
    expect(candidates.container.querySelectorAll('.bg-chart-1')).toHaveLength(2);
    candidates.unmount();

    const empty = render(<CandidateBarCompact candidates={[]} />);
    expect(empty.container.querySelector('[data-tooltip]')).toBeNull();
  });

  it('renders grouped final and indication results and all empty-state combinations', () => {
    const option: VoteOption = {
      key: 'yes',
      label: 'Yes',
      icon: <span data-testid="option-icon" />,
      color: 'final-color',
      lightColor: 'indication-color',
      finalCount: 3,
      finalPercent: 75,
      indicationCount: 1,
      indicationPercent: 25,
    };

    const final = render(
      <GroupedVoteResultBar
        options={[option]}
        isIndicationPhase={false}
        showBoth={false}
        totalFinal={4}
        totalIndication={4}
        className="grouped"
      />
    );
    expect(screen.getByText('3 (75%)')).toBeTruthy();
    expect(screen.getByText('1 (25%) *')).toBeTruthy();
    expect(final.container.querySelector('.grouped')).toBeTruthy();
    expect(final.container.querySelector('[class*="text-muted-foreground/70"]')).toBeTruthy();
    final.unmount();

    const indication = render(
      <GroupedVoteResultBar
        options={[option]}
        isIndicationPhase
        showBoth={false}
        totalFinal={4}
        totalIndication={0}
      />
    );
    expect(indication.container.querySelector('[class*="text-muted-foreground/70"]')).toBeTruthy();
    expect(screen.queryByText('features.events.agenda.noVotesYet')).toBeNull();
    indication.unmount();

    const both = render(
      <GroupedVoteResultBar
        options={[]}
        isIndicationPhase={false}
        showBoth
        totalFinal={0}
        totalIndication={0}
      />
    );
    expect(screen.getByText('features.events.agenda.noVotesYet')).toBeTruthy();
    both.unmount();

    render(
      <GroupedVoteResultBar
        options={[]}
        isIndicationPhase={false}
        showBoth
        totalFinal={0}
        totalIndication={1}
      />
    );
    expect(screen.queryByText('features.events.agenda.noVotesYet')).toBeNull();
  });
});
