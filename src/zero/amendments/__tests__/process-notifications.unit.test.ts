import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendmentTitleMock: vi.fn(),
  eventTitleMock: vi.fn(),
  groupNameMock: vi.fn(),
  fireNotificationMock: vi.fn(),
}));

vi.mock('../../server-helpers', () => ({
  amendmentTitle: mocks.amendmentTitleMock,
  eventTitle: mocks.eventTitleMock,
  groupName: mocks.groupNameMock,
}));

vi.mock('../../server-notify', () => ({
  fireNotification: mocks.fireNotificationMock,
}));

import { notifyProcessVoteResolution } from '../process-notifications';

function createTx() {
  return {
    run: vi.fn(),
  };
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
});

describe('notifyProcessVoteResolution', () => {
  it('returns without reads for unhandled or amendment-free resolutions', async () => {
    const tx = createTx();
    await notifyProcessVoteResolution(tx as never, 'user-1', 'agenda-1', {
      handled: false,
      amendmentId: 'amendment-1',
    });
    await notifyProcessVoteResolution(tx as never, 'user-1', 'agenda-1', {
      handled: true,
      amendmentId: null,
    });
    expect(tx.run).not.toHaveBeenCalled();
    expect(mocks.amendmentTitleMock).not.toHaveBeenCalled();
  });

  it('notifies group members when a process vote records group support', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({
      id: 'agenda-1',
      event_id: 'event-1',
    });
    mocks.amendmentTitleMock.mockResolvedValueOnce('Safer Streets');
    mocks.eventTitleMock.mockResolvedValueOnce('Planning Event');
    mocks.groupNameMock.mockResolvedValueOnce('Target group');

    await notifyProcessVoteResolution(tx as never, 'user-1', 'agenda-1', {
      handled: true,
      amendmentId: 'amendment-1',
      supportedGroupId: 'group-1',
      terminalDecision: null,
    });

    expect(mocks.fireNotificationMock).toHaveBeenCalledWith(
      'notifyGroupAmendmentSupportConfirmed',
      {
        senderId: 'user-1',
        amendmentId: 'amendment-1',
        amendmentTitle: 'Safer Streets',
        groupId: 'group-1',
        groupName: 'Target group',
        eventId: 'event-1',
        eventTitle: 'Planning Event',
      }
    );
  });

  it('uses optional event data and fallback labels for a rejected amendment', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'agenda-1', event_id: null });
    mocks.amendmentTitleMock.mockResolvedValueOnce('Rejected amendment');

    await notifyProcessVoteResolution(tx as never, 'sender', 'agenda-1', {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'rejected',
    });

    expect(mocks.eventTitleMock).not.toHaveBeenCalled();
    expect(mocks.fireNotificationMock).toHaveBeenCalledWith('notifyAmendmentRejected', {
      senderId: 'sender',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Rejected amendment',
      eventId: undefined,
      eventTitle: 'Event',
    });
  });

  it('notifies accepted workflow changes without loading an event title', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' });
    mocks.amendmentTitleMock.mockResolvedValueOnce('Accepted amendment');

    await notifyProcessVoteResolution(tx as never, 'sender', 'agenda-1', {
      handled: true,
      amendmentId: 'amendment-1',
      terminalDecision: 'accepted',
    });

    expect(mocks.eventTitleMock).not.toHaveBeenCalled();
    expect(mocks.fireNotificationMock).toHaveBeenCalledWith('notifyWorkflowChanged', {
      senderId: 'sender',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Accepted amendment',
      newStatus: 'accepted',
    });
  });

  it('supports group confirmation without an agenda item', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce(undefined);
    mocks.amendmentTitleMock.mockResolvedValueOnce('Amendment');
    mocks.groupNameMock.mockResolvedValueOnce('Group');

    await notifyProcessVoteResolution(tx as never, 'sender', 'agenda-1', {
      handled: true,
      amendmentId: 'amendment-1',
      supportedGroupId: 'group-1',
    });

    expect(mocks.fireNotificationMock).toHaveBeenCalledWith(
      'notifyGroupAmendmentSupportConfirmed',
      expect.objectContaining({ eventId: undefined, eventTitle: undefined })
    );
  });
});
