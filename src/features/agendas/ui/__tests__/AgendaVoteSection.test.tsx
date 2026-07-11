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
    t: (key: string, valuesOrFallback?: unknown, maybeFallback?: string) => {
      const labels: Record<string, string> = {
        'features.events.agenda.actual': 'Final',
        'features.events.agenda.indication': 'Indication',
        'features.events.agenda.indicationOnly': 'Indication only',
        'features.events.agenda.indicationShort': 'Ind',
        'features.events.agenda.indicationVotes': 'indication votes',
        'features.events.agenda.namedResults.label': 'Named',
        'features.events.agenda.noChoices': 'No choices yet',
        'features.events.agenda.noVotesYet': 'No votes yet',
        'features.events.agenda.openNamedResults': 'Open named results',
        'features.events.agenda.selected': 'Selected',
        'features.events.agenda.voteResults': 'Vote results',
        'features.events.agenda.votes': 'votes',
        'features.events.agenda.winner': 'Winner',
        'features.events.agenda.defaultChoiceLabels.yes': 'Yes',
        'features.events.agenda.defaultChoiceLabels.no': 'No',
        'features.events.agenda.defaultChoiceLabels.abstain': 'Abstain',
        'features.events.agenda.forwarding.pendingPrefix': 'The amendment will be forwarded to',
        'features.events.agenda.forwarding.pendingSuffix': ' after the vote.',
        'features.events.agenda.forwarding.completedPrefix':
          'The amendment was successfully forwarded to',
        'features.events.agenda.forwarding.completedSuffix': '.',
        'features.events.agenda.forwarding.rejectedPrefix': 'The amendment was not forwarded to',
        'features.events.agenda.forwarding.rejectedSuffix': ' because the vote was rejected.',
        'features.events.agenda.forwarding.tiePrefix': 'The amendment was not forwarded to',
        'features.events.agenda.forwarding.tieSuffix': ' because the vote ended in a tie.',
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
  it('renders lean vote rows with named-results access, winner, and selection', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Open named results' }));

    expect(onOpenNamedResults).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-slot="vote-results-display"]')).toBeTruthy();
    const rows = container.querySelectorAll('[data-slot="vote-result-option"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-framed')).toBe('true');
    expect(rows[1]?.getAttribute('data-framed')).toBeNull();
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('2 · 67%')).toBeTruthy();
    expect(screen.getByText('1 · 33%')).toBeTruthy();
    expect(screen.queryByText('YE')).toBeNull();
    expect(screen.queryByText('NO')).toBeNull();

    const resultsDisplay = container.querySelector('[data-slot="vote-results-display"]');
    expect(resultsDisplay).toBeTruthy();
    expect(within(resultsDisplay as HTMLElement).queryByText(/Eligible:/)).toBeNull();
    expect(within(resultsDisplay as HTMLElement).queryByText(/Voted:/)).toBeNull();
    expect(screen.queryByText(/The motion was accepted/)).toBeNull();
  });

  it('does not mark a winner while the final vote is still open', () => {
    render(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[
          choice({ id: 'yes', label: 'Yes', order_index: 0 }),
          choice({ id: 'no', label: 'No', order_index: 1 }),
        ]}
        indicativeDecisions={[{ choice_id: 'yes' }, { choice_id: 'no' }]}
        finalDecisions={[{ choice_id: 'yes' }]}
        userHasVoted
        userSelectedChoiceIds={['yes']}
        voteStatus="final"
        totalEligibleVoters={3}
      />
    );

    expect(screen.queryByText('Winner')).toBeNull();
    expect(screen.getByText('1 · 100%')).toBeTruthy();
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

  it('shows a linked forwarding notice below the results before and after the vote closes', () => {
    const forwardingPreview = {
      status: 'pending' as const,
      nextEventId: 'next-event',
      nextEventTitle: 'Next Assembly',
    };

    const { container, rerender } = render(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[choice({ id: 'yes', label: 'Yes', order_index: 0 })]}
        indicativeDecisions={[{ choice_id: 'yes' }]}
        finalDecisions={[]}
        userHasVoted={false}
        userSelectedChoiceIds={[]}
        voteStatus="indicative"
        forwardingPreview={forwardingPreview}
      />
    );

    expect(screen.getByText(/The amendment will be forwarded to/)).toBeTruthy();
    const pendingLink = screen.getByRole('link', { name: 'Next Assembly' });
    expect(pendingLink.getAttribute('href')).toBe('/event/next-event/agenda');
    expect(screen.getByText(/after the vote/)).toBeTruthy();
    const pendingResults = container.querySelector('[data-slot="vote-results-display"]');
    const pendingNotice = screen.getByText(/The amendment will be forwarded to/).closest('div');
    expect(pendingResults).toBeTruthy();
    expect(pendingNotice).toBeTruthy();
    expect(
      (pendingResults as HTMLElement).compareDocumentPosition(pendingNotice as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    rerender(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[choice({ id: 'yes', label: 'Yes', order_index: 0 })]}
        indicativeDecisions={[{ choice_id: 'yes' }]}
        finalDecisions={[{ choice_id: 'yes' }]}
        userHasVoted={false}
        userSelectedChoiceIds={[]}
        voteStatus="closed"
        voteResult="passed"
        forwardingPreview={{ ...forwardingPreview, status: 'forwarded' }}
      />
    );

    expect(screen.getByText(/The amendment was successfully forwarded to/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Next Assembly' }).getAttribute('href')).toBe(
      '/event/next-event/agenda'
    );
    const completedResults = container.querySelector('[data-slot="vote-results-display"]');
    const completedNotice = screen
      .getByText(/The amendment was successfully forwarded to/)
      .closest('div');
    expect(completedResults).toBeTruthy();
    expect(completedNotice).toBeTruthy();
    expect(
      (completedResults as HTMLElement).compareDocumentPosition(completedNotice as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it.each([
    ['rejected', ' because the vote was rejected.', 'var(--badge-danger-bg)'],
    ['tie', ' because the vote ended in a tie.', 'var(--badge-warning-bg)'],
  ] as const)('does not claim successful forwarding for a %s vote', (status, suffix, color) => {
    const { container } = render(
      <AgendaVoteSection
        voteTitle="Budget motion"
        choices={[choice({ id: 'yes', label: 'Yes', order_index: 0 })]}
        indicativeDecisions={[]}
        finalDecisions={[]}
        userHasVoted={false}
        userSelectedChoiceIds={[]}
        voteStatus="closed"
        forwardingPreview={{
          status,
          nextEventId: 'next-event',
          nextEventTitle: 'Next Assembly',
        }}
      />
    );

    expect(screen.getByText(suffix, { exact: false })).toBeTruthy();
    expect(screen.queryByText(/successfully forwarded/)).toBeNull();
    expect(container.querySelector(`[data-forwarding-status="${status}"]`)?.className).toContain(
      color
    );
  });
});
