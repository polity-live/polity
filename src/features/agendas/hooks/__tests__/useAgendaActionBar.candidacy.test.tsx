/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgendaActionBar } from '../useAgendaActionBar';

const mocks = vi.hoisted(() => ({
  addCandidate: vi.fn(),
  deleteCandidate: vi.fn(),
  updateElection: vi.fn(),
  updateVote: vi.fn(),
  verifyVotingPassword: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'ada@example.com' } }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    can: () => false,
    canVote: () => true,
    canBeCandidate: () => true,
  }),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    addSpeaker: vi.fn(),
    removeSpeaker: vi.fn(),
    updateAgendaItem: vi.fn(),
  }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({
    currentUser: { id: 'user-1', gender: 'female' },
  }),
}));

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    addCandidate: mocks.addCandidate,
    deleteCandidate: mocks.deleteCandidate,
    updateElection: mocks.updateElection,
  }),
}));

vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    updateVote: mocks.updateVote,
  }),
}));

vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({
    verifyVotingPassword: mocks.verifyVotingPassword,
  }),
}));

vi.mock('@/features/vote-cast/hooks/useVoteCasting', () => ({
  useVoteCasting: () => ({
    phase: 'indicative',
    isIndicationPhase: true,
    isLoading: false,
    castAmendmentVote: vi.fn(),
    castElectionVote: vi.fn(),
  }),
}));

function Harness({ isCandidate = false }: { isCandidate?: boolean }) {
  const actionBar = useAgendaActionBar({
    eventId: 'event-1',
    currentAgendaItem: { id: 'agenda-1', type: 'election', status: 'pending' },
    eventTitle: 'Annual assembly',
    election: {
      id: 'election-1',
      title: 'Board election',
      description: 'Choose a board.',
      majority_type: 'simple',
      role: { title: 'Chair' },
      candidates: isCandidate ? [{ id: 'candidate-1', user_id: 'user-1' }] : [],
    },
  });

  return (
    <div>
      <button type="button" onClick={actionBar.handleBecomeCandidate}>
        become
      </button>
      <button type="button" onClick={actionBar.handleWithdrawCandidacy}>
        withdraw
      </button>
      <span data-testid="dialog-open">{String(actionBar.candidacyDialogProps.open)}</span>
      <span data-testid="dialog-mode">{actionBar.candidacyDialogProps.mode}</span>
      <button type="button" onClick={() => actionBar.candidacyDialogProps.onSubmit('1234')}>
        submit pin
      </button>
    </div>
  );
}

function SecretIndicativeLockHarness({ type }: { type: 'election' | 'vote' }) {
  const actionBar = useAgendaActionBar({
    eventId: 'event-1',
    currentAgendaItem: { id: 'agenda-1', type, status: 'active', voting_phase: 'indication' },
    eventTitle: 'Annual assembly',
    election:
      type === 'election'
        ? {
            id: 'election-1',
            title: 'Board election',
            ballot_visibility: 'secret',
            candidates: [],
            indicative_participations: [{ elector_id: 'elector-1' }],
          }
        : null,
    vote:
      type === 'vote'
        ? {
            id: 'vote-1',
            status: 'indicative',
            ballot_visibility: 'secret',
            indicative_participations: [{ voter_id: 'voter-1' }],
          }
        : null,
    electorId: type === 'election' ? 'elector-1' : undefined,
    voterId: type === 'vote' ? 'voter-1' : undefined,
  });

  return (
    <div>
      <span data-testid="secret-lock">{String(actionBar.disableSecretIndicativeVoteButton)}</span>
      <span data-testid="secret-lock-tooltip">{actionBar.secretIndicativeVoteTooltip}</span>
    </div>
  );
}

beforeEach(() => {
  mocks.addCandidate.mockReset();
  mocks.addCandidate.mockResolvedValue(undefined);
  mocks.deleteCandidate.mockReset();
  mocks.deleteCandidate.mockResolvedValue(undefined);
  mocks.updateElection.mockReset();
  mocks.updateVote.mockReset();
  mocks.verifyVotingPassword.mockReset();
  mocks.verifyVotingPassword.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('useAgendaActionBar candidacy confirmation', () => {
  it('opens a become-candidacy PIN dialog before adding a candidate', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'become' }));

    expect(screen.getByTestId('dialog-open').textContent).toBe('true');
    expect(screen.getByTestId('dialog-mode').textContent).toBe('become');
    expect(mocks.addCandidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'submit pin' }));

    await waitFor(() => expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('1234'));
    await waitFor(() =>
      expect(mocks.addCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          election_id: 'election-1',
          user_id: 'user-1',
          name: 'ada@example.com',
        })
      )
    );
  });

  it('opens a withdraw-candidacy PIN dialog before deleting the candidate', async () => {
    render(<Harness isCandidate />);

    fireEvent.click(screen.getByRole('button', { name: 'withdraw' }));

    expect(screen.getByTestId('dialog-open').textContent).toBe('true');
    expect(screen.getByTestId('dialog-mode').textContent).toBe('withdraw');
    expect(mocks.deleteCandidate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'submit pin' }));

    await waitFor(() => expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('1234'));
    await waitFor(() => expect(mocks.deleteCandidate).toHaveBeenCalledWith('candidate-1'));
  });

  it.each(['election', 'vote'] as const)(
    'locks the toolbar vote action after a secret indicative %s submission',
    type => {
      render(<SecretIndicativeLockHarness type={type} />);

      expect(screen.getByTestId('secret-lock').textContent).toBe('true');
      expect(screen.getByTestId('secret-lock-tooltip').textContent).toContain(
        'Geheime indikative Stimmen können nicht geändert werden'
      );
    }
  );
});
