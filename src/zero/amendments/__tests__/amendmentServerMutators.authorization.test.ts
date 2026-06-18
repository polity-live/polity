import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const amendmentDeleteMock = vi.fn();
const createProcessTaskMock = vi.fn();
const supportAmendmentMock = vi.fn();
const updateSupportVoteMock = vi.fn();
const fireNotificationMock = vi.fn();
const amendmentTitleMock = vi.fn();
const eventTitleMock = vi.fn();
const groupNameMock = vi.fn();
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
      createProcessTask: { fn: (...args: unknown[]) => createProcessTaskMock(...args) },
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
  amendmentTitle: (...args: unknown[]) => amendmentTitleMock(...args),
  eventTitle: (...args: unknown[]) => eventTitleMock(...args),
  groupName: (...args: unknown[]) => groupNameMock(...args),
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
type CreateAmendmentArgs = Parameters<typeof amendmentServerMutators.create.fn>[0]['args'];
type InitializeProcessPathArgs = Parameters<
  typeof amendmentServerMutators.initializeProcessPath.fn
>[0]['args'];
type CreateProcessTaskArgs = Parameters<
  typeof amendmentServerMutators.createProcessTask.fn
>[0]['args'];
type UpdateSupportConfirmationArgs = Parameters<
  typeof amendmentServerMutators.updateSupportConfirmation.fn
>[0]['args'];

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

function createAmendmentCreateTx(location: AmendmentMutatorTx['location'] = 'server') {
  return {
    ...createTx(location),
    mutate: {
      role: {
        insert: vi.fn(),
      },
      action_right: {
        insert: vi.fn(),
      },
      amendment_collaborator: {
        insert: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function createAmendmentArgs(overrides: Partial<CreateAmendmentArgs> = {}): CreateAmendmentArgs {
  return {
    id: 'amendment-1',
    code: null,
    title: 'Amendment',
    reason: null,
    category: null,
    preamble: null,
    group_id: null,
    event_id: null,
    clone_source_id: null,
    document_id: null,
    tags: null,
    visibility: 'public',
    editing_mode: 'edit',
    discussions: null,
    image_url: null,
    x: null,
    youtube: null,
    linkedin: null,
    website: null,
    ...overrides,
  };
}

function initializeProcessPathArgs(
  overrides: Partial<InitializeProcessPathArgs> = {}
): InitializeProcessPathArgs {
  return {
    amendment_id: 'amendment-1',
    amendment_title: 'Amendment',
    amendment_reason: null,
    enriched_path: [
      {
        groupId: 'group-target',
        groupName: 'Target group',
        eventId: 'event-1',
        eventTitle: 'Vote event',
        eventStartDate: Date.now() + 1000,
        agendaItemId: 'agenda-1',
        amendmentVoteId: 'vote-1',
        forwardingStatus: 'forward_confirmed',
      },
    ],
    source_group_id: 'group-source',
    workflow_id: null,
    ...overrides,
  };
}

function createProcessTaskArgs(
  overrides: Partial<CreateProcessTaskArgs> = {}
): CreateProcessTaskArgs {
  return {
    id: 'task-1',
    process_run_id: 'run-1',
    branch_id: null,
    step_run_id: null,
    task_type: 'schedule_event',
    status: 'open',
    title: 'Manual assignment',
    description: null,
    group_id: 'group-target',
    target_group_id: null,
    event_id: null,
    agenda_item_id: null,
    support_confirmation_id: null,
    due_at: null,
    resolved_at: null,
    metadata: null,
    ...overrides,
  };
}

function updateSupportConfirmationArgs(
  overrides: Partial<UpdateSupportConfirmationArgs> = {}
): UpdateSupportConfirmationArgs {
  return {
    id: 'support-confirmation-1',
    status: 'confirmed',
    ...overrides,
  };
}

describe('amendmentServerMutators authorization', () => {
  beforeEach(() => {
    canMock.mockReset();
    amendmentDeleteMock.mockReset();
    createProcessTaskMock.mockReset();
    supportAmendmentMock.mockReset();
    updateSupportVoteMock.mockReset();
    fireNotificationMock.mockReset();
    amendmentTitleMock.mockReset();
    eventTitleMock.mockReset();
    groupNameMock.mockReset();
    userNameMock.mockReset();
    Object.values(processEngineMocks).forEach(mock => mock.mockReset());
  });

  it('creates amendments without checking target group or event permissions', async () => {
    const tx = createAmendmentCreateTx('server');
    tx.run.mockResolvedValueOnce(null);

    await expect(
      amendmentServerMutators.create.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: createAmendmentArgs({
          group_id: 'group-target',
          event_id: 'event-1',
        }),
      })
    ).resolves.toBeUndefined();

    expect(canMock).not.toHaveBeenCalled();
    expect(tx.mutate.amendment_collaborator.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment_id: 'amendment-1',
        user_id: 'user-1',
        status: 'admin',
      })
    );
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

  it('rejects process path initialization without a source group', async () => {
    const tx = createTx('server');

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: initializeProcessPathArgs({ source_group_id: null }),
      })
    ).rejects.toThrow(PermissionError);

    expect(canMock).not.toHaveBeenCalled();
    expect(processEngineMocks.initializeAmendmentProcessPath).not.toHaveBeenCalled();
  });

  it('rejects process path initialization without source group membership role', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce(null).mockResolvedValueOnce([
      {
        id: 'membership-1',
        membership_roles: [],
      },
    ]);

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: initializeProcessPathArgs(),
      })
    ).rejects.toThrow(PermissionError);

    expect(canMock).not.toHaveBeenCalled();
    expect(processEngineMocks.initializeAmendmentProcessPath).not.toHaveBeenCalled();
  });

  it('allows process path initialization for a member with any source group role', async () => {
    const tx = createTx('server');
    const args = initializeProcessPathArgs();
    tx.run.mockResolvedValueOnce(null).mockResolvedValueOnce([
      {
        id: 'membership-1',
        membership_roles: [{ role_id: 'role-1' }],
      },
    ]);

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args,
      })
    ).resolves.toBeUndefined();

    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'manage',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(processEngineMocks.initializeAmendmentProcessPath).toHaveBeenCalledWith(
      tx,
      'user-1',
      args
    );
  });

  it('rejects process path initialization without amendment manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'amendments', 'amendment:amendment-1');
    tx.run.mockResolvedValueOnce({ id: 'group-source' });
    canMock.mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: initializeProcessPathArgs(),
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

  it('notifies process task recipients for manual open group tasks', async () => {
    const tx = createTx('server');
    groupNameMock.mockResolvedValueOnce('Target group');
    const args = createProcessTaskArgs();

    await expect(
      amendmentServerMutators.createProcessTask.fn({
        tx: tx as never,
        ctx: createCtx(),
        args,
      })
    ).resolves.toBeUndefined();

    expect(createProcessTaskMock).toHaveBeenCalledWith({ tx, ctx: createCtx(), args });
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyProcessTaskCreated', {
      senderId: 'user-1',
      groupId: 'group-target',
      groupName: 'Target group',
      taskTitle: 'Manual assignment',
    });
  });

  it('does not notify for manual process tasks without group visibility or open status', async () => {
    const tx = createTx('server');

    await amendmentServerMutators.createProcessTask.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createProcessTaskArgs({ group_id: null }),
    });
    await amendmentServerMutators.createProcessTask.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createProcessTaskArgs({ id: 'task-2', status: 'scheduled' }),
    });

    expect(createProcessTaskMock).toHaveBeenCalledTimes(2);
    expect(groupNameMock).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyProcessTaskCreated',
      expect.anything()
    );
  });

  it('notifies amendment followers and group members when group support is confirmed', async () => {
    const tx = createTx('server');
    const previousConfirmation = {
      id: 'support-confirmation-1',
      amendment_id: 'amendment-1',
      group_id: 'group-target',
      event_id: 'event-1',
      status: 'pending',
    };
    tx.run.mockResolvedValueOnce(previousConfirmation);
    amendmentTitleMock.mockResolvedValueOnce('Safer Streets');
    groupNameMock.mockResolvedValueOnce('Target group');
    eventTitleMock.mockResolvedValueOnce('Planning Event');
    const args = updateSupportConfirmationArgs();

    await expect(
      amendmentServerMutators.updateSupportConfirmation.fn({
        tx: tx as never,
        ctx: createCtx(),
        args,
      })
    ).resolves.toBeUndefined();

    expect(fireNotificationMock).toHaveBeenCalledWith('notifySupportConfirmed', {
      senderId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Safer Streets',
      groupId: 'group-target',
      groupName: 'Target group',
    });
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyGroupAmendmentSupportConfirmed', {
      senderId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Safer Streets',
      groupId: 'group-target',
      groupName: 'Target group',
      eventId: 'event-1',
      eventTitle: 'Planning Event',
    });
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
