/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AmendmentVotingQueue } from '../AmendmentVotingQueue';

const mocks = vi.hoisted(() => ({
  latestProps: null as any,
  toastSuccess: vi.fn(),
}));

vi.mock('../AmendmentVotingQueueView', () => ({
  AmendmentVotingQueueView: (props: any) => {
    mocks.latestProps = props;
    return <div data-testid="queue-controller" />;
  },
}));

vi.mock('../../hooks/useChangeRequestVoting', () => ({
  useChangeRequestVoting: () => ({
    currentChangeRequest: null,
    voteResults: null,
    hasVoted: false,
    castVote: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess },
}));

const request = (id: string, votingOrder?: number, characterCount?: number) => ({
  id,
  title: id,
  description: id,
  proposedChange: id,
  votingOrder,
  characterCount,
  status: 'pending',
  createdAt: 1,
});

const baseProps = {
  amendmentId: 'amendment-1',
  eventId: 'event-1',
  agendaItemId: 'agenda-1',
  isOrganizer: true,
  onAdvanceToNext: vi.fn(),
  onComplete: vi.fn(),
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.latestProps = null;
});

describe('AmendmentVotingQueue controller branches', () => {
  it('provides empty defaults without a session, user, or requests', () => {
    render(<AmendmentVotingQueue {...baseProps} changeRequests={[]} />);

    expect(mocks.latestProps.currentIndex).toBe(0);
    expect(mocks.latestProps.progress).toBe(0);
    expect(mocks.latestProps.timeRemaining).toBe(0);
    expect(mocks.latestProps.sortedChangeRequests).toEqual([]);
  });

  it.each([
    [
      [request('ordered', 1), request('unordered')],
      ['ordered', 'unordered'],
    ],
    [
      [request('unordered'), request('ordered', 1)],
      ['ordered', 'unordered'],
    ],
    [
      [request('short', undefined, 2), request('long', undefined, 9)],
      ['long', 'short'],
    ],
    [
      [request('missing'), request('zero', undefined, 0)],
      ['missing', 'zero'],
    ],
  ])('sorts mixed queue metadata deterministically', (changeRequests, expectedIds) => {
    render(<AmendmentVotingQueue {...baseProps} changeRequests={changeRequests} />);

    expect(mocks.latestProps.sortedChangeRequests.map((item: any) => item.id)).toEqual(expectedIds);
  });

  it('handles both reorder directions and protects queue boundaries', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    render(
      <AmendmentVotingQueue
        {...baseProps}
        userId="user-1"
        changeRequests={[request('first', 1), request('second', 2)]}
        currentSession={{
          id: 'session-1',
          status: 'active',
          votingStartTime: 0,
          votingEndTime: 5_000,
          currentChangeRequestIndex: 0,
        }}
      />
    );

    expect(mocks.latestProps.timeRemaining).toBe(0);
    await act(async () => mocks.latestProps.handleMoveUp(0));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    await act(async () => mocks.latestProps.handleMoveUp(1));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.latestProps.sortedChangeRequests.map((item: any) => item.id)).toEqual([
      'second',
      'first',
    ]);

    await act(async () => mocks.latestProps.handleMoveDown(1));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    await act(async () => mocks.latestProps.handleMoveDown(0));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});
