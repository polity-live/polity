/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ElectionTimelineCard } from '../ElectionTimelineCard';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ title }: { title: string }) => <button type="button">Share {title}</button>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'features.timeline.cards.castVote': 'Cast vote',
        'features.timeline.cards.election.candidates': 'candidates',
        'features.timeline.cards.election.electionFor': 'Election for',
        'features.timeline.cards.election.endsOn': 'Ends on',
        'features.events.agenda.hideIndicationResults': 'Hide indication results',
        'features.events.agenda.showIndicationResults': 'Show indication results',
        'features.timeline.cards.election.ofVotes': 'of votes',
        'features.timeline.cards.election.phase': 'phase',
        'features.timeline.cards.election.phases.nomination': 'Nomination',
        'features.timeline.cards.election.phases.results': 'Results',
        'features.timeline.cards.election.phases.voting': 'Voting',
        'features.timeline.cards.election.status.elected': 'Elected',
        'features.timeline.cards.election.status.votingOpen': 'Voting open',
        'features.timeline.cards.election.submitBy': 'Submit by',
        'features.timeline.cards.election.turnout': 'turnout',
        'features.timeline.cards.election.viewCandidates': 'View candidates',
        'features.timeline.cards.election.voted': 'voted',
        'features.timeline.cards.election.winnerAnnounced': 'Winner',
        'features.timeline.cards.viewResults': 'View results',
      };

      return fallback ?? labels[key] ?? key;
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ElectionTimelineCard', () => {
  it('marks the winner in the candidate row and keeps result/share actions', () => {
    const onViewResults = vi.fn();
    const { container } = render(
      <ElectionTimelineCard
        election={{
          id: 'election-1',
          title: 'Board election',
          roleName: 'Board',
          status: 'winner_announced',
          candidates: [
            {
              id: 'candidate-1',
              name: 'Polity Tester',
              voteCount: 3,
              votePercentage: 75,
              indicationCount: 2,
              indicationPercentage: 67,
            },
            {
              id: 'candidate-2',
              name: 'Mina Bauer',
              voteCount: 1,
              votePercentage: 25,
              indicationCount: 1,
              indicationPercentage: 33,
            },
          ],
          winnerId: 'candidate-1',
          winnerName: 'Polity Tester',
          totalCandidates: 2,
          totalVoters: 4,
          turnoutPercentage: 80,
        }}
        onViewResults={onViewResults}
      />
    );

    const rows = container.querySelectorAll('[data-election-candidate-row="true"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-winner')).toBe('true');
    expect(screen.getByText('Polity Tester')).toBeTruthy();
    expect(screen.getByText('3 · 75%')).toBeTruthy();
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.queryByText('Winner announced')).toBeNull();
    expect(screen.queryByText('IND')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show indication results' }));
    expect(screen.getByRole('button', { name: 'Hide indication results' })).toBeTruthy();
    expect(screen.getAllByText('IND')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'View results' }));
    expect(onViewResults).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Share Board election' })).toBeTruthy();
  });

  it('keeps voting and candidate actions while rendering candidate rows', () => {
    const onCastVote = vi.fn();
    const onViewCandidates = vi.fn();
    const { container } = render(
      <ElectionTimelineCard
        election={{
          id: 'election-1',
          title: 'Board election',
          roleName: 'Board',
          status: 'voting_open',
          votingEndDate: new Date('2026-06-20T12:00:00Z'),
          candidates: [
            {
              id: 'candidate-1',
              name: 'Polity Tester',
              indicationCount: 2,
              indicationPercentage: 67,
            },
            { id: 'candidate-2', name: 'Mina Bauer', indicationCount: 1, indicationPercentage: 33 },
          ],
          totalCandidates: 2,
        }}
        onCastVote={onCastVote}
        onViewCandidates={onViewCandidates}
      />
    );

    expect(container.querySelectorAll('[data-election-candidate-row="true"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cast vote' }));
    fireEvent.click(screen.getByRole('button', { name: 'View candidates' }));

    expect(onCastVote).toHaveBeenCalledTimes(1);
    expect(onViewCandidates).toHaveBeenCalledTimes(1);
  });
});
