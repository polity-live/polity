/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AmendmentVotingQueue } from '../AmendmentVotingQueue';
import { VoteControls } from '../VoteControls';
import { VotingPhaseIndicator } from '../VotingPhaseIndicator';
import { VotingSessionManager } from '../VotingSessionManager';

const mocks = vi.hoisted(() => ({
  createChangeRequest: vi.fn(),
  voteOnChangeRequest: vi.fn(),
  currentChangeRequest: null as any,
  changeRequestResults: { accept: 1, reject: 0, abstain: 0 },
  hasVoted: false,
  castChangeRequestVote: vi.fn(),
  changeRequestLoading: false,
  eventVoting: {} as any,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    createChangeRequest: mocks.createChangeRequest,
    voteOnChangeRequest: mocks.voteOnChangeRequest,
  }),
}));
vi.mock('../../hooks/useChangeRequestVoting', () => ({
  useChangeRequestVoting: () => ({
    currentChangeRequest: mocks.currentChangeRequest,
    voteResults: mocks.changeRequestResults,
    hasVoted: mocks.hasVoted,
    castVote: mocks.castChangeRequestVote,
    isLoading: mocks.changeRequestLoading,
  }),
}));
vi.mock('../../hooks/useEventVoting', async importOriginal => {
  const original = await importOriginal<typeof import('../../hooks/useEventVoting')>();
  return { ...original, useEventVoting: () => mocks.eventVoting };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createChangeRequest.mockResolvedValue(undefined);
  mocks.voteOnChangeRequest.mockResolvedValue(undefined);
  mocks.castChangeRequestVote.mockResolvedValue(undefined);
  mocks.currentChangeRequest = null;
  mocks.hasVoted = false;
  mocks.changeRequestLoading = false;
  mocks.eventVoting = {
    currentSession: null,
    votedCount: 0,
    totalVoters: 2,
    canManageVoting: true,
    voteResults: { accept: 0, reject: 0, abstain: 0 },
    isLoading: false,
    timeRemaining: null,
    startIntroductionPhase: vi.fn().mockResolvedValue('vote-1'),
    startVotingPhase: vi.fn().mockResolvedValue(undefined),
    closeVoting: vi.fn().mockResolvedValue(undefined),
  };
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000020');
});

function changeRequest(id: string, order: number, characterCount: number) {
  return {
    id,
    title: `Request ${id}`,
    description: `Description ${id}`,
    proposedChange: `Change ${id}`,
    votingOrder: order,
    characterCount,
    status: 'pending',
    createdAt: 1,
  };
}

describe('voting UI contracts', () => {
  it('sorts, reorders, votes, advances, and completes an amendment voting queue', async () => {
    const onAdvance = vi.fn();
    const onComplete = vi.fn();
    const requests = [changeRequest('later', 2, 10), changeRequest('first', 1, 5)];
    mocks.currentChangeRequest = requests[1];
    const { container, rerender } = render(
      <AmendmentVotingQueue
        amendmentId="amendment-1"
        eventId="event-1"
        agendaItemId="agenda-1"
        changeRequests={requests}
        currentSession={{
          id: 'session-1',
          status: 'active',
          votingStartTime: Date.now(),
          votingEndTime: Date.now() + 60_000,
          currentChangeRequestIndex: 0,
        }}
        isOrganizer
        onAdvanceToNext={onAdvance}
        onComplete={onComplete}
        userId="user-1"
      />
    );
    expect(screen.getAllByRole('heading', { level: 4 })[0].textContent).toContain('Request first');
    const moveDown = container.querySelector<HTMLElement>(
      '[data-action-id="votes.amendment-queue.order.move-down"]'
    );
    expect(moveDown).toBeTruthy();
    fireEvent.click(moveDown!);
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());

    const accept = container.querySelector<HTMLElement>(
      '[data-action-id="votes.amendment-queue.vote.accept"]'
    );
    accept!.focus();
    fireEvent.keyDown(accept!, { key: 'Enter' });
    fireEvent.click(accept!);
    expect(mocks.castChangeRequestVote).toHaveBeenCalledWith('accept');
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.amendment-queue.advance"]')!
    );
    expect(onAdvance).toHaveBeenCalledOnce();

    rerender(
      <AmendmentVotingQueue
        amendmentId="amendment-1"
        eventId="event-1"
        agendaItemId="agenda-1"
        changeRequests={requests}
        currentSession={{
          id: 'session-1',
          status: 'active',
          votingStartTime: Date.now(),
          votingEndTime: Date.now() + 60_000,
          currentChangeRequestIndex: 2,
        }}
        isOrganizer
        onAdvanceToNext={onAdvance}
        onComplete={onComplete}
        userId="user-1"
      />
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.amendment-queue.complete"]')!
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('creates a deferred change request, records each vote choice, and exposes progress states', async () => {
    const onVoteComplete = vi.fn();
    const votes = [
      {
        id: 'vote-1',
        vote: 'accept',
        createdAt: 1,
        voter: { id: 'user-2', user: { name: 'Grace', avatar: '' } },
      },
    ];
    const collaborators = [
      { id: 'collab-1', user: { id: 'user-1', name: 'Ada', avatar: '' } },
      { id: 'collab-2', user: { id: 'user-2', name: 'Grace', avatar: '' } },
    ];
    const { container } = render(
      <VoteControls
        changeRequestId="draft-reference"
        currentUserId="user-1"
        votes={votes}
        collaborators={collaborators}
        status="pending"
        amendmentId="amendment-1"
        documentId="document-1"
        suggestionData={{
          crId: 'CR-1',
          description: 'Description',
          proposedChange: 'Change',
          justification: 'Reason',
          userId: 'user-1',
          createdAt: 1,
        }}
        onVoteComplete={onVoteComplete}
      />
    );
    const accept = container.querySelector<HTMLElement>(
      '[data-action-id="votes.change-request.vote.accept"]'
    )!;
    accept.focus();
    fireEvent.keyDown(accept, { key: 'Enter' });
    fireEvent.click(accept);
    await waitFor(() => expect(mocks.createChangeRequest).toHaveBeenCalled());
    expect(mocks.voteOnChangeRequest).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000020',
      vote: 'accept',
      change_request_id: '00000000-0000-4000-8000-000000000020',
    });
    expect(onVoteComplete).toHaveBeenCalledOnce();
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
  });

  it('votes directly on a persisted change request without a completion callback', async () => {
    const persistedId = '00000000-0000-4000-8000-000000000021';
    const { container } = render(
      <VoteControls
        changeRequestId={persistedId}
        currentUserId="user-1"
        votes={[]}
        collaborators={[]}
        status="pending"
        amendmentId="amendment-1"
        documentId="document-1"
      />
    );

    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.change-request.vote.reject"]')!
    );

    await waitFor(() =>
      expect(mocks.voteOnChangeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ vote: 'reject', change_request_id: persistedId })
      )
    );
    expect(mocks.createChangeRequest).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('reports a missing persisted change request instead of attempting a vote', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <VoteControls
        changeRequestId="draft-without-payload"
        currentUserId="user-1"
        votes={[]}
        collaborators={[]}
        status="pending"
        amendmentId="amendment-1"
        documentId="document-1"
      />
    );

    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.change-request.vote.abstain"]')!
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.voteOnChangeRequest).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('maps active timer progress and completed outcomes into the phase indicator view', () => {
    const { rerender } = render(
      <VotingPhaseIndicator
        phase="voting"
        duration={120}
        acceptCount={2}
        rejectCount={1}
        abstainCount={1}
        totalEligible={8}
      />
    );
    expect(screen.getByText('4 / 8')).toBeTruthy();
    expect(screen.getByText('2:00')).toBeTruthy();
    rerender(
      <VotingPhaseIndicator
        phase="closed"
        result="passed"
        acceptCount={5}
        rejectCount={2}
        abstainCount={1}
        totalEligible={8}
      />
    );
    expect(screen.getByText('features.events.voting.passed')).toBeTruthy();
    expect(screen.getByText('features.events.voting.closed')).toBeTruthy();
  });

  it('coordinates setup, introduction, active voting, progress, and close controls', async () => {
    const { container, rerender } = render(
      <VotingSessionManager
        eventId="event-1"
        agendaItemId="agenda-1"
        agendaItemTitle="Budget"
        votingType="amendment"
        targetEntityId="amendment-1"
      />
    );
    const setupToggle = container.querySelector<HTMLElement>(
      '[data-action-id="votes.session.setup.toggle"]'
    )!;
    setupToggle.focus();
    fireEvent.keyDown(setupToggle, { key: 'Enter' });
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.session.introduction.start"]')!
    );
    await waitFor(() =>
      expect(mocks.eventVoting.startIntroductionPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          agendaItemId: 'agenda-1',
          targetEntityId: 'amendment-1',
          majorityType: 'simple',
        })
      )
    );

    mocks.eventVoting = {
      ...mocks.eventVoting,
      currentSession: { id: 'agenda-1', phase: 'introduction', majorityType: 'simple' },
      votedCount: 1,
      totalVoters: 2,
    };
    rerender(
      <VotingSessionManager
        eventId="event-1"
        agendaItemId="agenda-1"
        agendaItemTitle="Budget"
        votingType="amendment"
        targetEntityId="amendment-1"
      />
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.session.voting.start"]')!
    );
    await waitFor(() =>
      expect(mocks.eventVoting.startVotingPhase).toHaveBeenCalledWith('agenda-1', 300)
    );
    mocks.eventVoting = {
      ...mocks.eventVoting,
      currentSession: { id: 'agenda-1', phase: 'voting', majorityType: 'simple' },
      timeRemaining: 30,
    };
    rerender(
      <VotingSessionManager
        eventId="event-1"
        agendaItemId="agenda-1"
        agendaItemTitle="Budget"
        votingType="amendment"
        targetEntityId="amendment-1"
      />
    );
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-action-id="votes.session.voting.close"]')!
    );
    await waitFor(() => expect(mocks.eventVoting.closeVoting).toHaveBeenCalledWith('agenda-1'));
  });
});
