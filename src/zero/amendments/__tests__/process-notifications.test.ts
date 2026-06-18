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
});
