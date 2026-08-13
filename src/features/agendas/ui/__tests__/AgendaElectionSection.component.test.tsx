/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';

import {
  AgendaElectionSection,
  isAutoAssignedRoleElection,
  isEventRoleElection,
} from '../AgendaElectionSection';

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
  translate: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
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

      return typeof fallback === 'string' ? fallback : _key;
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgendaElectionSection', () => {
  it.each([
    ['event role', { role: { scope: 'event', event_id: 'event-1' } }, true, true],
    ['event role without event', { role: { scope: 'event', event_id: null } }, false, true],
    ['group role', { role: { scope: 'group', event_id: null } }, false, true],
    ['other role', { role: { scope: 'other', event_id: null } }, false, false],
    ['missing role', null, false, false],
  ])('classifies %s assignment scope', (_label, value, eventRole, autoAssigned) => {
    expect(isEventRoleElection(value)).toBe(eventRole);
    expect(isAutoAssignedRoleElection(value)).toBe(autoAssigned);
  });

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

    const namedResultsActions = [
      screen.getByRole('button', { name: 'Klick für Einzelansicht' }),
      screen.getByRole('button', { name: /No candidates yet/ }),
    ];
    for (const action of namedResultsActions) {
      expect(action.getAttribute('data-action-id')).toBe('agendas.election.named-results.open');
      fireEvent.click(action);
    }

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

    expect(candidateButton.getAttribute('data-action-id')).toBe(
      'agendas.election.candidacy.become'
    );
    expect(candidateButton.getAttribute('aria-disabled')).toBe('true');
    candidateButton.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain(
      'Passive Voting Rights are required to become a candidate in this event.'
    );
    expect(candidateButton.className).toContain('text-muted-foreground');
  });

  it('dispatches candidacy become and withdrawal through stable async actions', () => {
    const onBecomeCandidate = vi.fn();
    const onWithdrawCandidacy = vi.fn();
    const props = {
      roleName: 'Board',
      candidates: [],
      indicativeSelections: [],
      finalSelections: [],
      userHasVoted: false,
      userSelectedCandidateIds: [],
      electionStatus: 'indicative' as const,
      canVote: false,
      canBeCandidate: true,
      onBecomeCandidate,
    };

    const { rerender } = render(<AgendaElectionSection {...props} isUserCandidate={false} />);
    const become = screen.getByRole('button', { name: /Become Candidate/ });
    fireEvent.click(become);
    expect(onBecomeCandidate).toHaveBeenCalledTimes(1);

    rerender(
      <AgendaElectionSection {...props} isUserCandidate onWithdrawCandidacy={onWithdrawCandidacy} />
    );
    const withdraw = document.querySelector<HTMLElement>(
      '[data-action-id="agendas.election.candidacy.withdraw"]'
    )!;
    fireEvent.click(withdraw);
    expect(onWithdrawCandidacy).toHaveBeenCalledTimes(1);
  });

  it.each(['online', 'hybrid', 'offline'] as const)(
    'shows %s attendance mode and list-election metadata',
    attendanceMode => {
      render(
        <AgendaElectionSection
          roleName="Board"
          electionMode="list"
          seatCount={2}
          candidates={[]}
          indicativeSelections={[]}
          finalSelections={[]}
          userHasVoted={false}
          userSelectedCandidateIds={[]}
          electionStatus="final"
          canVote={false}
          canBeCandidate={false}
          isUserCandidate={false}
          attendanceMode={attendanceMode}
          onBecomeCandidate={() => undefined}
        />
      );
      expect(screen.getByText(attendanceMode)).toBeTruthy();
    }
  );

  it('omits attendance and election-mode badges when explicitly unavailable', () => {
    render(
      <AgendaElectionSection
        roleName="Board"
        electionMode={null}
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="final"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        attendanceMode={null}
        onBecomeCandidate={() => undefined}
      />
    );
    expect(screen.queryByText('online')).toBeNull();
  });

  it('shows runoff status and a target-event tooltip fallback', () => {
    render(
      <AgendaElectionSection
        roleName="Delegate"
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="runoff_required"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        delegateTargetEventId="event-2"
        delegateTargetEventTitle={null}
        onBecomeCandidate={() => undefined}
      />
    );
    expect(
      screen.getByText(
        'generated.inline.0014_gleichstand_am_letzten_sitz_fuer_diese_wahl_i_2e1eafc5'
      )
    ).toBeTruthy();
  });

  it('filters withdrawn candidates from the empty named-results state', () => {
    const onOpenNamedResults = vi.fn();
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[
          {
            id: 'withdrawn',
            name: 'Withdrawn',
            status: 'withdrawn',
            order_index: 0,
            user: null,
          } as unknown as CandidatesByElectionRow,
        ]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="final"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onOpenNamedResults={onOpenNamedResults}
        onBecomeCandidate={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /No candidates yet/ }));
    expect(onOpenNamedResults).toHaveBeenCalled();
  });

  it('renders candidate display-name fallbacks and indication participation', () => {
    const candidates = [
      {
        id: 'named',
        name: null,
        status: 'accepted',
        order_index: null,
        user: { first_name: null, last_name: null, email: 'email@example.com', avatar: null },
      },
      {
        id: 'candidate-name',
        name: 'Candidate fallback',
        status: 'nominated',
        order_index: null,
        user: { first_name: null, last_name: null, email: null, avatar: null },
      },
      {
        id: 'unknown',
        name: null,
        status: 'nominated',
        order_index: null,
        user: null,
      },
      {
        id: 'unknown-user',
        name: null,
        status: 'nominated',
        order_index: null,
        user: { first_name: null, last_name: null, email: null, avatar: null },
      },
    ] as unknown as CandidatesByElectionRow[];
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={candidates}
        indicativeSelections={[{ candidate_id: 'named' }]}
        finalSelections={[]}
        userHasVoted
        userSelectedCandidateIds={['named']}
        electionStatus="indicative"
        canVote
        canBeCandidate
        isUserCandidate={false}
        onOpenNamedResults={vi.fn()}
        onBecomeCandidate={() => undefined}
      />
    );
    expect(screen.getAllByText('email@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Candidate fallback')).toBeTruthy();
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
    expect(screen.getByText('features.events.agenda.yourIndication')).toBeTruthy();
  });

  it('normalizes non-finite percentages from defensive offline input', () => {
    const candidate = {
      id: 'a',
      name: 'A',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;
    render(
      <AgendaElectionSection
        roleName="Board"
        candidates={[candidate]}
        indicativeSelections={[]}
        finalSelections={[]}
        offlineTallies={[{ candidate_id: 'a', phase: 'final', count: Number.POSITIVE_INFINITY }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        onBecomeCandidate={() => undefined}
      />
    );
    expect(screen.getByText(/0%/)).toBeTruthy();
  });

  it('resolves list winners and rejects a tie at the seat boundary', () => {
    const candidates = [
      { id: 'a', name: 'A', status: 'accepted', order_index: null, user: null },
      { id: 'b', name: 'B', status: 'accepted', order_index: null, user: null },
      { id: 'c', name: 'C', status: 'accepted', order_index: null, user: null },
    ] as unknown as CandidatesByElectionRow[];
    const props = {
      roleName: 'Board',
      electionMode: 'list' as const,
      candidates,
      indicativeSelections: [],
      userHasVoted: false,
      userSelectedCandidateIds: [],
      electionStatus: 'closed',
      canVote: false,
      canBeCandidate: false,
      isUserCandidate: false,
      onBecomeCandidate: () => undefined,
    };
    const { container, rerender } = render(
      <AgendaElectionSection
        {...props}
        seatCount={2}
        finalSelections={[
          { candidate_id: 'a' },
          { candidate_id: 'a' },
          { candidate_id: 'a' },
          { candidate_id: 'b' },
          { candidate_id: 'b' },
          { candidate_id: 'c' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-winner="true"]')).toHaveLength(2);

    rerender(
      <AgendaElectionSection
        {...props}
        seatCount={1}
        finalSelections={[{ candidate_id: 'a' }, { candidate_id: 'b' }]}
      />
    );
    expect(container.querySelectorAll('[data-winner="true"]')).toHaveLength(0);
  });

  it('defaults list elections to one seat and shows candidate loading', () => {
    const candidate = {
      id: 'a',
      name: 'A',
      status: 'accepted',
      order_index: 0,
      user: null,
    } as unknown as CandidatesByElectionRow;
    const { container, rerender } = render(
      <AgendaElectionSection
        roleName="Board"
        electionMode="list"
        seatCount={null}
        candidates={[candidate]}
        indicativeSelections={[]}
        finalSelections={[{ candidate_id: 'a' }]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="closed"
        canVote={false}
        canBeCandidate
        isUserCandidate={false}
        isCandidateLoading
        onBecomeCandidate={() => undefined}
      />
    );
    expect(container.querySelectorAll('[data-winner="true"]')).toHaveLength(1);
    rerender(
      <AgendaElectionSection
        roleName="Board"
        electionMode="list"
        seatCount={null}
        candidates={[]}
        indicativeSelections={[]}
        finalSelections={[]}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
        electionStatus="indicative"
        canVote={false}
        canBeCandidate
        isUserCandidate={false}
        isCandidateLoading
        onBecomeCandidate={() => undefined}
      />
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
