/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';

import { AgendaElectionSection } from '../AgendaElectionSection';

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
    t: (_key: string, fallback?: string) => {
      if (_key === 'features.events.agenda.becomeCandidate') {
        return 'Become Candidate';
      }

      if (_key === 'features.events.agenda.noCandidates') {
        return 'No candidates yet';
      }

      if (_key === 'features.events.agenda.candidateAccepted') {
        return 'Accepted';
      }

      if (_key === 'features.events.agenda.candidateNominated') {
        return 'Nominated';
      }

      if (_key === 'features.events.agenda.delegateParticipantsAdded') {
        return 'Elected delegates were automatically added to the event as participants.';
      }

      if (_key === 'features.events.agenda.hideIndicationResults') {
        return 'Hide indication results';
      }

      if (_key === 'features.events.agenda.indicationShort') {
        return 'IND';
      }

      if (_key === 'features.events.agenda.roleWinnersAssigned') {
        return 'The roles were automatically assigned to the winners.';
      }

      if (_key === 'features.events.agenda.showIndicationResults') {
        return 'Show indication results';
      }

      return fallback ?? _key;
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgendaElectionSection', () => {
  it('keeps the election role badge as text when no delegate target event is present', () => {
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="indicative"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onBecomeCandidate={() => undefined}
      />
    );

    expect(screen.getByText('Board')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Board' })).toBeNull();
  });

  it('links the election role badge to the delegate target event when present', () => {
    render(
      <AgendaElectionSection
        roleName="Delegiertenwahl: Delegate2on1"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        delegateTargetEventId="target-event"
        delegateTargetEventTitle="Delegate2on1"
        onBecomeCandidate={() => undefined}
      />
    );

    const delegateTargetLink = screen.getByRole('link', {
      name: 'Delegiertenwahl: Delegate2on1',
    });

    expect(delegateTargetLink.getAttribute('href')).toBe('/event/target-event');
    expect(delegateTargetLink.textContent).toContain('Delegate2on1');
  });

  it('shows the delegate participant sync note for closed delegate elections with winners', () => {
    const electedCandidate = {
      id: 'candidate-1',
      name: 'Polity Tester',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;

    render(
      <AgendaElectionSection
        roleName="Delegiertenwahl: Delegate2on1"
        candidates={[electedCandidate]}
        indicativeSelections={[]}
        finalSelections={[{ candidate_id: 'candidate-1' }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        delegateTargetEventId="target-event"
        delegateTargetEventTitle="Delegate2on1"
        onBecomeCandidate={() => undefined}
      />
    );

    expect(
      screen.getByText('Elected delegates were automatically added to the event as participants.')
    ).toBeTruthy();
  });

  it('shows the role assignment note for closed group role elections with winners', () => {
    const electedCandidate = {
      id: 'candidate-1',
      name: 'Polity Tester',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;

    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[electedCandidate]}
        indicativeSelections={[]}
        finalSelections={[{ candidate_id: 'candidate-1' }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        showRoleAssignedMessage
        onBecomeCandidate={() => undefined}
      />
    );

    expect(screen.getByText('The roles were automatically assigned to the winners.')).toBeTruthy();
  });

  it('renders closed election results as candidate rows without summary layers', () => {
    const electedCandidate = {
      id: 'candidate-1',
      name: 'Polity Tester',
      status: 'nominated',
      order_index: 0,
      user: {
        email: 'test48@gmail.com',
        first_name: 'Polity',
        last_name: 'Tester',
        avatar: null,
      },
    } as unknown as CandidatesByElectionRow;
    const otherCandidate = {
      id: 'candidate-2',
      name: 'Other Candidate',
      status: 'accepted',
      order_index: 1,
      user: null,
    } as unknown as CandidatesByElectionRow;

    const { container } = render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[electedCandidate, otherCandidate]}
        indicativeSelections={[{ candidate_id: 'candidate-1' }]}
        finalSelections={[{ candidate_id: 'candidate-1' }]}
        userHasVoted
        userSelectedCandidateIds={['candidate-1']}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        winnerName="Polity Tester"
        winnerVoteSharePercent={100}
        onBecomeCandidate={() => undefined}
        onOpenNamedResults={vi.fn()}
      />
    );

    const rows = container.querySelectorAll('[data-election-candidate-row="true"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-winner')).toBe('true');
    expect(rows[0]?.getAttribute('data-selected')).toBe('true');
    expect(rows[0]?.getAttribute('data-framed')).toBe('true');
    expect(rows[1]?.getAttribute('data-framed')).toBeNull();
    expect(screen.getByText('Polity Tester')).toBeTruthy();
    expect(screen.getByText('test48@gmail.com')).toBeTruthy();
    expect(screen.getByText('Nominated')).toBeTruthy();
    expect(screen.getByText('Winner')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('1 · 100%')).toBeTruthy();
    expect(screen.queryByText('IND')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show indication results' }));
    expect(screen.getByRole('button', { name: 'Hide indication results' })).toBeTruthy();
    expect(screen.getAllByText('IND')).toHaveLength(2);
    expect(screen.queryByText('features.events.agenda.candidates')).toBeNull();
    expect(screen.queryByText(/won/i)).toBeNull();
    expect(container.querySelector('[data-slot="vote-results-display"]')).toBeNull();
  });

  it('hides the event role assignment note before close or without resolved winners', () => {
    const tiedCandidateA = {
      id: 'candidate-1',
      name: 'Polity Tester A',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;
    const tiedCandidateB = {
      id: 'candidate-2',
      name: 'Polity Tester B',
      status: 'accepted',
      order_index: 1,
      user: null,
    } as unknown as CandidatesByElectionRow;

    const { rerender } = render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[tiedCandidateA]}
        indicativeSelections={[]}
        finalSelections={[{ candidate_id: 'candidate-1' }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="final"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        showRoleAssignedMessage
        onBecomeCandidate={() => undefined}
      />
    );

    expect(screen.queryByText('The roles were automatically assigned to the winners.')).toBeNull();

    rerender(
      <AgendaElectionSection
        roleName="Board"
        candidates={[tiedCandidateA, tiedCandidateB]}
        indicativeSelections={[]}
        finalSelections={[{ candidate_id: 'candidate-1' }, { candidate_id: 'candidate-2' }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        showRoleAssignedMessage
        onBecomeCandidate={() => undefined}
      />
    );

    expect(screen.queryByText('The roles were automatically assigned to the winners.')).toBeNull();
  });

  it('opens named results from the detail badge and empty candidate state', () => {
    const onOpenNamedResults = vi.fn();

    render(
      <AgendaElectionSection
        roleName="Delegiertenwahl: Delegate2on1"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onOpenNamedResults={onOpenNamedResults}
        onBecomeCandidate={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Klick für Einzelansicht' }));
    fireEvent.click(screen.getByRole('button', { name: /No candidates yet/ }));

    expect(onOpenNamedResults).toHaveBeenCalledTimes(2);
  });

  it('renders the Become Candidate button as blocked with help when passive voting rights are missing', async () => {
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="indicative"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onBecomeCandidate={() => undefined}
      />
    );

    const candidateButton = screen.getByRole('button', { name: /Become Candidate/ });

    expect(candidateButton.getAttribute('aria-disabled')).toBe('true');
    candidateButton.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain(
      'Passive Voting Rights are required to become a candidate in this event.'
    );
    expect(candidateButton.className).toContain('text-muted-foreground');
  });
});
