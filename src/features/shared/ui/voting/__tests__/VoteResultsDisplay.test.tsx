/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoteResultsDisplay, type VoteBarOption } from '../VoteResultsDisplay';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'features.events.agenda.actual': 'Final',
        'features.events.agenda.indication': 'Indication',
        'features.events.agenda.indicationShort': 'Ind',
        'features.events.agenda.indicationVotes': 'indication votes',
        'features.events.agenda.noVotesYet': 'No votes yet',
        'features.events.agenda.selected': 'Selected',
        'features.events.agenda.votes': 'votes',
        'features.events.agenda.winner': 'Winner',
        'features.events.voting.eligible': 'Eligible',
        'features.events.voting.share': 'Share',
        'features.events.voting.voted': 'Voted',
      };

      return fallback ?? labels[key] ?? key;
    },
  }),
}));

const options: VoteBarOption[] = [
  {
    key: 'yes',
    label: 'yes',
    color: 'bg-success',
    lightColor: 'bg-success/40',
    finalCount: 3,
    finalPercent: 75,
    indicationCount: 1,
    indicationPercent: 25,
  },
  {
    key: 'no',
    label: 'no',
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
  it('renders all choices in one compact results surface', () => {
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
    expect(container.querySelectorAll('[data-slot="vote-result-option"]')).toHaveLength(2);
    expect(screen.getByText('yes')).toBeTruthy();
    expect(screen.getByText('no')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Winner')).toBeTruthy();
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
});
