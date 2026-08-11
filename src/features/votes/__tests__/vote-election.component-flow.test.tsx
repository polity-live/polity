/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';

import { renderComponentFlow } from '@/test/render-component-flow';
import { computeEligibleVoters } from '@/features/votes/logic/computeEligibleVoters';

const mocks = vi.hoisted(() => ({
  castVote: vi.fn(),
  eventVoting: {} as any,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { id?: string };
  }) => <a href={params?.id ? to.replace('$id', params.id) : to}>{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/features/votes/hooks/useEventVoting', () => ({
  useEventVoting: () => mocks.eventVoting,
}));

import { VoteButtons } from '@/features/votes/ui/VoteButtons';
import { AgendaElectionSection } from '@/features/agendas/ui/AgendaElectionSection';

const votingRole = {
  action_rights: [{ resource: 'events', action: 'active_voting' }],
};

function EligibleVoteFlow() {
  const eligible = computeEligibleVoters(
    [
      { status: 'active', user: { id: 'voter-a', name: 'Voter A' }, role: votingRole },
      { status: 'active', user: { id: 'observer', name: 'Observer' }, role: null },
    ],
    new Set()
  );

  return (
    <div>
      <output data-testid="eligible-voters">{eligible.map(voter => voter.name).join(',')}</output>
      {eligible.some(voter => voter.id === 'voter-a') ? (
        <VoteButtons eventId="event-1" agendaItemId="agenda-1" sessionId="session-1" />
      ) : null}
    </div>
  );
}

const candidates = [
  { id: 'candidate-a', name: 'Candidate A', status: 'accepted', order_index: 0, user: null },
  { id: 'candidate-b', name: 'Candidate B', status: 'accepted', order_index: 1, user: null },
] as unknown as CandidatesByElectionRow[];

function SecretElectionFlow() {
  const [closed, setClosed] = useState(false);
  const secretSelections = [
    { candidate_id: 'candidate-a' },
    { candidate_id: 'candidate-a' },
    { candidate_id: 'candidate-b' },
  ];

  return (
    <div>
      <AgendaElectionSection
        roleName="Board"
        candidates={candidates}
        indicativeSelections={[]}
        finalSelections={closed ? secretSelections : []}
        userHasVoted
        userSelectedCandidateIds={[]}
        electionStatus={closed ? 'closed' : 'final'}
        canVote
        canBeCandidate={false}
        isUserCandidate={false}
        onBecomeCandidate={vi.fn()}
      />
      <button type="button" onClick={() => setClosed(true)}>
        Close secret election
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventVoting = {
    canVote: true,
    hasUserVoted: false,
    userVote: null,
    currentSession: { phase: 'voting' },
    isLoading: false,
    castVote: mocks.castVote,
  };
});

afterEach(cleanup);

describe('vote and election component flow', () => {
  it('applies active voting rights before dispatching a named vote', () => {
    renderComponentFlow(<EligibleVoteFlow />);

    expect(screen.getByTestId('eligible-voters').textContent).toBe('Voter A');
    fireEvent.click(screen.getByRole('button', { name: 'features.events.voting.accept' }));

    expect(mocks.castVote).toHaveBeenCalledWith('session-1', 'accept');
  });

  it('keeps secret election totals hidden until close and then exposes only aggregate results', () => {
    const { container } = renderComponentFlow(<SecretElectionFlow />);

    expect(container.querySelector('[data-winner="true"]')).toBeNull();
    expect(screen.queryByText('2 · 67%')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close secret election' }));

    expect(container.querySelector('[data-winner="true"]')).toBeTruthy();
    expect(screen.getByText('2 · 67%')).toBeTruthy();
    expect(screen.queryByText(/voter-a|voter-b/i)).toBeNull();
  });
});
