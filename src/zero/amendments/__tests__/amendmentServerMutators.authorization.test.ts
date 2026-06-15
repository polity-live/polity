import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const amendmentDeleteMock = vi.fn();
const supportAmendmentMock = vi.fn();
const updateSupportVoteMock = vi.fn();
const fireNotificationMock = vi.fn();
const userNameMock = vi.fn();
const processEngineMocks = vi.hoisted(() => ({
  completeProcessTaskWithEvent: vi.fn(),
  initializeAmendmentProcessPath: vi.fn(),
  resolveAmendmentProcessVote: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    amendments: {
      create: { fn: vi.fn() },
      update: { fn: vi.fn() },
      delete: { fn: (...args: unknown[]) => amendmentDeleteMock(...args) },
      addCollaborator: { fn: vi.fn() },
      removeCollaborator: { fn: vi.fn() },
      updateCollaborator: { fn: vi.fn() },
      createChangeRequest: { fn: vi.fn() },
      voteOnChangeRequest: { fn: vi.fn() },
      updateChangeRequest: { fn: vi.fn() },
      createSupportConfirmation: { fn: vi.fn() },
      updateSupportConfirmation: { fn: vi.fn() },
      supportAmendment: { fn: (...args: unknown[]) => supportAmendmentMock(...args) },
      updateSupportVote: { fn: (...args: unknown[]) => updateSupportVoteMock(...args) },
      deleteSupportVote: { fn: vi.fn() },
    },
  },
}));

vi.mock('../../server-notify', () => ({
  fireNotification: (...args: unknown[]) => fireNotificationMock(...args),
}));

vi.mock('../../server-helpers', () => ({
  amendmentTitle: vi.fn(),
  eventTitle: vi.fn(),
  groupName: vi.fn(),
  recomputeAmendmentCounters: vi.fn(),
  recomputeEventCounters: vi.fn(),
  recomputeGroupCounters: vi.fn(),
  recomputeUserCounters: vi.fn(),
  userName: (...args: unknown[]) => userNameMock(...args),
}));

vi.mock('../process-engine', () => ({
  completeProcessTaskWithEvent: (...args: unknown[]) =>
    processEngineMocks.completeProcessTaskWithEvent(...args),
  initializeAmendmentProcessPath: (...args: unknown[]) =>
    processEngineMocks.initializeAmendmentProcessPath(...args),
  resolveAmendmentProcessVote: (...args: unknown[]) =>
    processEngineMocks.resolveAmendmentProcessVote(...args),
}));

vi.mock('../process-notifications', () => ({
  notifyProcessVoteResolution: vi.fn(),
}));

import { amendmentServerMutators } from '../server-mutators';

type AmendmentMutatorInput = Parameters<typeof amendmentServerMutators.delete.fn>[0];
type AmendmentMutatorTx = AmendmentMutatorInput['tx'];
type AmendmentMutatorCtx = AmendmentMutatorInput['ctx'];

function createTx(location: AmendmentMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {},
  };
}

function createCtx(): AmendmentMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

describe('amendmentServerMutators authorization', () => {
  beforeEach(() => {
    canMock.mockReset();
    amendmentDeleteMock.mockReset();
    supportAmendmentMock.mockReset();
    updateSupportVoteMock.mockReset();
    fireNotificationMock.mockReset();
    userNameMock.mockReset();
    Object.values(processEngineMocks).forEach(mock => mock.mockReset());
  });

  it('rejects amendment deletion before calling the shared mutator', async () => {
    const tx = createTx('server');
    const error = new PermissionError('delete', 'amendments', 'amendment:amendment-1');
    canMock.mockRejectedValue(error);

    await expect(
      amendmentServerMutators.delete.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'amendment-1' },
      })
    ).rejects.toBe(error);

    expect(amendmentDeleteMock).not.toHaveBeenCalled();
  });

  it('rejects support vote updates for another user before calling the shared mutator', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValue({
      id: 'support-vote-1',
      amendment_id: 'amendment-1',
      user_id: 'user-2',
    });

    await expect(
      amendmentServerMutators.updateSupportVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'support-vote-1', vote: 1 },
      })
    ).rejects.toThrow(PermissionError);

    expect(updateSupportVoteMock).not.toHaveBeenCalled();
  });

  it('allows a signed-in viewer to support vote a public amendment without amendment vote rights', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        title: 'Open amendment',
        visibility: 'public',
        created_by_id: 'author-user',
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'collab-1',
        amendment_id: 'amendment-1',
        user_id: 'admin-user',
        status: 'admin',
      });
    userNameMock.mockResolvedValueOnce('Voting User');

    await expect(
      amendmentServerMutators.supportAmendment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'support-vote-1', amendment_id: 'amendment-1', vote: 1 },
      })
    ).resolves.toBeUndefined();

    expect(canMock).not.toHaveBeenCalled();
    expect(supportAmendmentMock).toHaveBeenCalled();
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyAmendmentVoted', {
      senderId: 'user-1',
      senderName: 'Voting User',
      recipientUserId: 'admin-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Open amendment',
      voteType: 'upvote',
    });
  });

  it('rejects support voting on a private amendment without view access', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        title: 'Private amendment',
        visibility: 'private',
        created_by_id: 'author-user',
        group_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce(null);

    await expect(
      amendmentServerMutators.supportAmendment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'support-vote-1', amendment_id: 'amendment-1', vote: 1 },
      })
    ).rejects.toThrow(PermissionError);

    expect(supportAmendmentMock).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it('rejects process path initialization without amendment manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'amendments', 'amendment:amendment-1');
    canMock.mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          amendment_id: 'amendment-1',
          amendment_title: 'Amendment',
          amendment_reason: null,
          enriched_path: [
            {
              groupId: 'group-1',
              groupName: 'Group',
              eventId: null,
              eventTitle: '',
              eventStartDate: null,
              agendaItemId: null,
              amendmentVoteId: null,
              forwardingStatus: '',
            },
          ],
          source_group_id: null,
          workflow_id: null,
        },
      })
    ).rejects.toBe(error);

    expect(processEngineMocks.initializeAmendmentProcessPath).not.toHaveBeenCalled();
  });

  it('requires event vote management before resolving event-scoped process votes', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage_votes', 'events', 'event:event-1');

    tx.run.mockResolvedValueOnce({
      id: 'agenda-1',
      event_id: 'event-1',
      amendment_id: 'amendment-1',
    });
    canMock.mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.resolveProcessVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { agenda_item_id: 'agenda-1' },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'manage_votes',
      resource: 'events',
      eventId: 'event-1',
    });
    expect(processEngineMocks.resolveAmendmentProcessVote).not.toHaveBeenCalled();
  });

  it('requires amendment and target event rights before completing a process task', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage_votes', 'events', 'event:event-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'task-1',
        process_run_id: 'run-1',
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      });
    canMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.completeProcessTaskWithEvent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          process_task_id: 'task-1',
          event_id: 'event-1',
          description: null,
        },
      })
    ).rejects.toBe(error);

    expect(processEngineMocks.completeProcessTaskWithEvent).not.toHaveBeenCalled();
  });
});
