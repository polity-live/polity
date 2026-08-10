/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmendmentVotingQueueView,
  type AmendmentVotingQueueViewProps,
} from '../AmendmentVotingQueueView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

const request = (overrides: Record<string, unknown>) => ({
  id: 'request-1',
  title: 'Request one',
  description: 'Description',
  proposedChange: 'Change',
  status: 'pending',
  createdAt: 1,
  ...overrides,
});

const props = (overrides: Partial<AmendmentVotingQueueViewProps> = {}) => ({
  amendmentId: 'amendment-1',
  eventId: 'event-1',
  agendaItemId: 'agenda-1',
  changeRequests: [],
  currentSession: { id: 'session-1', status: 'active' },
  isOrganizer: true,
  onAdvanceToNext: vi.fn(),
  onComplete: vi.fn(),
  userId: 'user-1',
  t: (key: string) => key,
  localChangeRequests: [],
  setLocalChangeRequests: vi.fn(),
  currentChangeRequest: null,
  currentVoteResults: null,
  hasVoted: false,
  castVote: vi.fn(),
  votingLoading: false,
  sortedChangeRequests: [],
  currentIndex: 0,
  totalRequests: 0,
  progress: 0,
  timeRemaining: 0,
  minutesRemaining: 0,
  secondsRemaining: 4,
  handleMoveUp: vi.fn(),
  handleMoveDown: vi.fn(),
  updateVotingOrder: vi.fn(),
  ...overrides,
});

afterEach(cleanup);

describe('AmendmentVotingQueueView branches', () => {
  it('renders rejected completed requests including sparse creator metadata', () => {
    const items = [
      request({
        id: 'rejected',
        title: 'Rejected request',
        voteResults: { accept: 1, reject: 2, abstain: 0 },
        creator: { id: 'creator-1' },
        source: 'collaborator',
      }),
      request({
        id: 'event-source',
        title: 'Event source request',
        characterCount: 7,
        voteResults: { accept: 0, reject: 0, abstain: 0 },
        creator: { id: 'creator-2', name: 'Ada' },
        source: 'participant',
      }),
      request({ id: 'no-creator', title: 'No creator request' }),
    ];

    render(
      <AmendmentVotingQueueView
        {...props({
          sortedChangeRequests: items,
          currentIndex: 3,
          totalRequests: 3,
          currentSession: { id: 'session-1', status: 'closed' },
        })}
      />
    );

    expect(screen.getAllByText('generated.inline.1248_abgelehnt_110d6fe7')).toHaveLength(2);
    expect(document.body.textContent).toContain('generated.inline.0028_unbekannt_d0b00a9f');
    expect(document.body.textContent).toContain('Ada');
    expect(document.body.textContent).toContain('generated.inline.0157_collaborator_794b34c1');
    expect(document.body.textContent).toContain('generated.inline.0158_event_teilnehmer_c24630ba');
    expect(document.body.textContent).toContain('0generated.inline.1249');
    expect(document.body.textContent).toContain('7generated.inline.1249');
  });

  it('shows a recorded vote while hiding voting buttons', () => {
    render(
      <AmendmentVotingQueueView
        {...props({
          sortedChangeRequests: [request({})],
          totalRequests: 1,
          currentChangeRequest: request({}),
          currentVoteResults: { accept: 2, reject: 1, abstain: 0 },
          hasVoted: true,
        })}
      />
    );

    expect(screen.getByText('features.events.voting.voted')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="votes.amendment-queue.vote.accept"]')
    ).toBeNull();
  });

  it('renders and invokes every available vote action', () => {
    const castVote = vi.fn();
    const viewProps = props({
      sortedChangeRequests: [request({})],
      totalRequests: 1,
      currentChangeRequest: request({}),
      castVote,
    });
    const { container } = render(<AmendmentVotingQueueView {...viewProps} />);

    for (const vote of ['accept', 'reject', 'abstain']) {
      fireEvent.click(
        container.querySelector<HTMLElement>(
          `[data-action-id="votes.amendment-queue.vote.${vote}"]`
        )!
      );
    }
    expect(castVote.mock.calls.map(call => call[0])).toEqual(['accept', 'reject', 'abstain']);
  });

  it('forwards enabled organizer reorder actions', () => {
    const handleMoveUp = vi.fn();
    const handleMoveDown = vi.fn();
    const { container } = render(
      <AmendmentVotingQueueView
        {...props({
          sortedChangeRequests: [
            request({ id: 'first', title: 'First' }),
            request({ id: 'second', title: 'Second' }),
          ],
          totalRequests: 2,
          handleMoveUp,
          handleMoveDown,
        })}
      />
    );

    const moveUps = container.querySelectorAll<HTMLElement>(
      '[data-action-id="votes.amendment-queue.order.move-up"]'
    );
    const moveDowns = container.querySelectorAll<HTMLElement>(
      '[data-action-id="votes.amendment-queue.order.move-down"]'
    );
    fireEvent.click(moveUps[1]);
    fireEvent.click(moveDowns[0]);
    expect(handleMoveUp).toHaveBeenCalledWith(1);
    expect(handleMoveDown).toHaveBeenCalledWith(0);
  });
});
