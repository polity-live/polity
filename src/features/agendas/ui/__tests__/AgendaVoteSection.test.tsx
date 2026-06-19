/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';

import { AgendaVoteSection } from '../AgendaVoteSection';

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

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'features.events.agenda.actual': 'Final',
        'features.events.agenda.indication': 'Indication',
        'features.events.agenda.indicationOnly': 'Indication only',
        'features.events.agenda.indicationShort': 'Ind',
        'features.events.agenda.indicationVotes': 'indication votes',
        'features.events.agenda.noChoices': 'No choices yet',
        'features.events.agenda.noVotesYet': 'No votes yet',
        'features.events.agenda.selected': 'Selected',
        'features.events.agenda.voteResults': 'Vote results',
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

function choice(overrides: Partial<ChoicesByVoteRow>): ChoicesByVoteRow {
  return {
    id: 'choice-1',
    label: 'Yes',
    order_index: 0,
    ...overrides,
  } as unknown as ChoicesByVoteRow;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgendaVoteSection', () => {
  it('renders a clickable named-results result card with winner, selection, and eligible summary', () => {
    const onOpenNamedResults = vi.fn();

    const { container } = render(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[
          choice({ id: 'yes', label: 'Yes', order_index: 0 }),
          choice({ id: 'no', label: 'No', order_index: 1 }),
        ]}
        indicativeDecisions={[{ choice_id: 'yes' }, { choice_id: 'no' }]}
        finalDecisions={[{ choice_id: 'yes' }, { choice_id: 'yes' }, { choice_id: 'no' }]}
        userHasVoted
        userSelectedChoiceIds={['yes']}
        voteStatus="closed"
        voteResult="passed"
        voteSharePercent={67}
        totalEligibleVoters={5}
        onOpenNamedResults={onOpenNamedResults}
      />
    );

    const resultCard = container.querySelector('button');
    expect(resultCard).toBeTruthy();
    fireEvent.click(resultCard as HTMLButtonElement);

    expect(onOpenNamedResults).toHaveBeenCalledTimes(1);
    expect(screen.getByText('The motion was accepted with 67% of votes.')).toBeTruthy();
    expect(container.querySelector('[data-slot="vote-results-display"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="vote-result-option"]')).toHaveLength(2);
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();

    const resultsDisplay = container.querySelector('[data-slot="vote-results-display"]');
    expect(resultsDisplay).toBeTruthy();
    expect(within(resultsDisplay as HTMLElement).getByText(/Eligible:\s*5/)).toBeTruthy();
    expect(within(resultsDisplay as HTMLElement).getByText(/Voted:\s*3/)).toBeTruthy();
  });

  it('keeps the empty choices state visible without opening named results', () => {
    render(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        userHasVoted={false}
        userSelectedChoiceIds={[]}
        voteStatus="indicative"
      />
    );

    expect(screen.getByText('No choices yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /No choices yet/ })).toBeNull();
  });
});
