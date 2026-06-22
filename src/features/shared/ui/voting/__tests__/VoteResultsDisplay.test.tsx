/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoteResultsDisplay, type VoteBarOption } from '../VoteResultsDisplay';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, valuesOrFallback?: unknown, maybeFallback?: string) => {
      const labels: Record<string, string> = {
        'features.events.agenda.actual': 'Final',
        'features.events.agenda.indication': 'Indication',
        'features.events.agenda.indicationShort': 'Ind',
        'features.events.agenda.indicationVotes': 'indication votes',
        'features.events.agenda.hideIndicationResults': 'Hide indication results',
        'features.events.agenda.noVotesYet': 'No votes yet',
        'features.events.agenda.selected': 'Selected',
        'features.events.agenda.showIndicationResults': 'Show indication results',
        'features.events.agenda.votes': 'votes',
        'features.events.agenda.winner': 'Winner',
        'features.events.agenda.defaultChoiceLabels.yes': 'Yes',
        'features.events.agenda.defaultChoiceLabels.no': 'No',
        'features.events.agenda.defaultChoiceLabels.abstain': 'Abstain',
        'features.events.voting.eligible': 'Eligible',
        'features.events.voting.share': 'Share',
        'features.events.voting.voted': 'Voted',
      };

      const fallback =
        typeof maybeFallback === 'string'
          ? maybeFallback
          : typeof valuesOrFallback === 'string'
            ? valuesOrFallback
            : undefined;

      return labels[key] ?? fallback ?? key;
    },
  }),
}));

const options: VoteBarOption[] = [
  {
    key: 'yes',
    label: 'accept',
    color: 'bg-success',
    lightColor: 'bg-success/40',
    finalCount: 3,
    finalPercent: 75,
    indicationCount: 1,
    indicationPercent: 25,
  },
  {
    key: 'no',
    label: 'reject',
    color: 'bg-danger',
    lightColor: 'bg-danger/40',
    finalCount: 1,
    finalPercent: 25,
    indicationCount: 3,
    indicationPercent: 75,
  },
];

afterEach(() => {
  cleanup();
});

describe('VoteResultsDisplay', () => {
  it('renders all choices as lean localized result rows', () => {
    const { container } = render(
      <VoteResultsDisplay
        options={options}
        phase="closed"
        totalFinal={4}
        totalIndication={4}
        selectedOptionIds={['yes']}
        winnerOptionId="yes"
        showWinner
      />
    );

    expect(container.querySelector('[data-slot="vote-results-display"]')).toBeTruthy();
    const rows = container.querySelectorAll('[data-slot="vote-result-option"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-framed')).toBe('true');
    expect(rows[1]?.getAttribute('data-framed')).toBeNull();
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.queryByText('YE')).toBeNull();
    expect(screen.queryByText('NO')).toBeNull();
    expect(screen.getAllByText('3 · 75%').length).toBeGreaterThan(0);
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.queryByText(/Eligible:/)).toBeNull();
    expect(screen.queryByText(/Share:/)).toBeNull();
  });

  it('keeps indication rows collapsed for final results until toggled', () => {
    render(
      <VoteResultsDisplay options={options} phase="closed" totalFinal={4} totalIndication={4} />
    );

    expect(screen.getByRole('button', { name: 'Show indication results' })).toBeTruthy();
    expect(screen.queryByText('Ind')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show indication results' }));

    expect(screen.getByRole('button', { name: 'Hide indication results' })).toBeTruthy();
    expect(screen.getAllByText('Ind')).toHaveLength(2);
  });

  it('offers indication results in final phase even before final votes are cast', () => {
    render(
      <VoteResultsDisplay
        options={options.map(option => ({
          ...option,
          finalCount: 0,
          finalPercent: 0,
        }))}
        phase="final"
        totalFinal={0}
        totalIndication={4}
      />
    );

    expect(screen.getByRole('button', { name: 'Show indication results' })).toBeTruthy();
    expect(screen.getAllByText('0 · 0%')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Show indication results' }));

    expect(screen.getAllByText('Ind')).toHaveLength(2);
    expect(screen.getByText('1 · 25%')).toBeTruthy();
    expect(screen.getByText('3 · 75%')).toBeTruthy();
  });

  it('shows the empty state only once for zero totals', () => {
    render(
      <VoteResultsDisplay
        options={options.map(option => ({
          ...option,
          finalCount: 0,
          finalPercent: 0,
          indicationCount: 0,
          indicationPercent: 0,
        }))}
        phase="indication"
        totalFinal={0}
        totalIndication={0}
      />
    );

    expect(screen.getAllByText('No votes yet')).toHaveLength(1);
  });

  it('shows indication phase results without an indication toggle', () => {
    render(
      <VoteResultsDisplay options={options} phase="indication" totalFinal={4} totalIndication={4} />
    );

    expect(screen.queryByRole('button', { name: 'Show indication results' })).toBeNull();
    expect(screen.getByText('1 · 25%')).toBeTruthy();
    expect(screen.getByText('3 · 75%')).toBeTruthy();
  });
});
