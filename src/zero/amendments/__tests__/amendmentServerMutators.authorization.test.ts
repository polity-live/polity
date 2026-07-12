import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();
const amendmentUpdateMock = vi.fn();
const amendmentDeleteMock = vi.fn();
const createProcessTaskMock = vi.fn();
const supportAmendmentMock = vi.fn();
const updateSupportVoteMock = vi.fn();
const sharedUpdateProcessBranchMock = vi.fn();
const changeRequestDeleteMock = vi.fn();
const voteOnChangeRequestMock = vi.fn();
const fireNotificationMock = vi.fn();
const amendmentTitleMock = vi.fn();
const eventTitleMock = vi.fn();
const groupNameMock = vi.fn();
const userNameMock = vi.fn();
const processEngineMocks = vi.hoisted(() => ({
  completeProcessTaskWithEvent: vi.fn(),
  initializeAmendmentProcessPath: vi.fn(),
  replanProcessBranchEvents: vi.fn(),
  resolveAmendmentProcessVote: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    amendments: {
      create: { fn: vi.fn() },
      update: { fn: (...args: unknown[]) => amendmentUpdateMock(...args) },
      delete: { fn: (...args: unknown[]) => amendmentDeleteMock(...args) },
      addCollaborator: { fn: vi.fn() },
      removeCollaborator: { fn: vi.fn() },
      updateCollaborator: { fn: vi.fn() },
      createChangeRequest: { fn: vi.fn() },
      voteOnChangeRequest: { fn: (...args: unknown[]) => voteOnChangeRequestMock(...args) },
      updateChangeRequest: { fn: vi.fn() },
      deleteChangeRequest: { fn: (...args: unknown[]) => changeRequestDeleteMock(...args) },
      createSupportConfirmation: { fn: vi.fn() },
      updateSupportConfirmation: { fn: vi.fn() },
      updateProcessBranch: { fn: (...args: unknown[]) => sharedUpdateProcessBranchMock(...args) },
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
  replanProcessBranchEvents: (...args: unknown[]) =>
    processEngineMocks.replanProcessBranchEvents(...args),
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
type CreateChangeRequestArgs = Parameters<
  typeof amendmentServerMutators.createChangeRequest.fn
>[0]['args'];
type UpdateSupportConfirmationArgs = Parameters<
  typeof amendmentServerMutators.updateSupportConfirmation.fn
>[0]['args'];
type AddCollaboratorArgs = Parameters<typeof amendmentServerMutators.addCollaborator.fn>[0]['args'];

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

function createEventChangeRequestTx(location: AmendmentMutatorTx['location'] = 'server') {
  return {
    ...createTx(location),
    mutate: {
      agenda_item_change_request: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      change_request: {
        update: vi.fn(),
        delete: vi.fn(),
      },
      vote: {
        insert: vi.fn(),
      },
      vote_choice: {
        insert: vi.fn(),
      },
      voter: {
        insert: vi.fn(),
      },
    },
  };
}

function createProcessBranchUpdateTx(location: AmendmentMutatorTx['location'] = 'server') {
  return {
    ...createTx(location),
    mutate: {
      amendment_process_branch: {
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
    discussions: null,
    image_url: null,
    x: null,
    youtube: null,
    linkedin: null,
    website: null,
    ...overrides,
  };
}

function createChangeRequestArgs(
  overrides: Partial<CreateChangeRequestArgs> = {}
): CreateChangeRequestArgs {
  return {
    id: 'cr-new',
    amendment_id: 'amendment-1',
    process_branch_id: 'branch-1',
    title: 'New event CR',
    description: null,
    status: 'open',
    reason: null,
    source_type: null,
    source_id: null,
    source_title: null,
    change_type: 'text',
    original_text: 'old',
    new_text: 'new',
    original_properties: null,
    new_properties: null,
    changed_character_count: 3,
    voting_status: 'pending',
    voting_deadline: 0,
    voting_majority_type: null,
    quorum_required: null,
    created_in_mode: 'suggest_event',
    resolved_in_mode: null,
    resolution_method: null,
    visibility_scope: null,
    obsolete_reason: null,
    obsolete_by_vote_id: null,
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

function addCollaboratorArgs(overrides: Partial<AddCollaboratorArgs> = {}): AddCollaboratorArgs {
  return {
    id: 'collaborator-1',
    user_id: 'invited-user',
    amendment_id: 'amendment-1',
    role_id: 'role-1',
    status: 'invited',
    visibility: null,
    ...overrides,
  };
}

describe('amendmentServerMutators authorization', () => {
  beforeEach(() => {
    canMock.mockReset();
    amendmentUpdateMock.mockReset();
    amendmentDeleteMock.mockReset();
    createProcessTaskMock.mockReset();
    supportAmendmentMock.mockReset();
    updateSupportVoteMock.mockReset();
    sharedUpdateProcessBranchMock.mockReset();
    changeRequestDeleteMock.mockReset();
    voteOnChangeRequestMock.mockReset();
    fireNotificationMock.mockReset();
    amendmentTitleMock.mockReset();
    eventTitleMock.mockReset();
    groupNameMock.mockReset();
    userNameMock.mockReset();
    Object.values(processEngineMocks).forEach(mock => mock.mockReset());
  });

  it('creates amendments without checking target group or event permissions', async () => {
    const tx = createAmendmentCreateTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'event-1',
        amendment_deadline: null,
      })
      .mockResolvedValueOnce(null);

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

  it('waits for an invited collaborator notification before completing', async () => {
    const tx = createTx('server');
    let resolveNotification: (() => void) | undefined;
    const notificationPending = new Promise<void>(resolve => {
      resolveNotification = resolve;
    });
    fireNotificationMock.mockReturnValueOnce(notificationPending);
    amendmentTitleMock.mockResolvedValueOnce('Amendment One');
    userNameMock.mockResolvedValueOnce('Inviting User');

    let mutationCompleted = false;
    const mutation = amendmentServerMutators.addCollaborator
      .fn({
        tx: tx as never,
        ctx: createCtx(),
        args: addCollaboratorArgs(),
      })
      .then(() => {
        mutationCompleted = true;
      });

    await vi.waitFor(() => {
      expect(fireNotificationMock).toHaveBeenCalledWith('notifyCollaborationInvite', {
        senderId: 'user-1',
        recipientUserId: 'invited-user',
        amendmentId: 'amendment-1',
        amendmentTitle: 'Amendment One',
      });
    });
    expect(mutationCompleted).toBe(false);

    resolveNotification?.();
    await mutation;

    expect(mutationCompleted).toBe(true);
  });

  it('keeps self-request collaboration notifications on the request path', async () => {
    const tx = createTx('server');
    tx.run.mockResolvedValueOnce({
      id: 'amendment-1',
      created_by_id: 'author-user',
      visibility: 'public',
    });
    amendmentTitleMock.mockResolvedValueOnce('Amendment One');
    userNameMock.mockResolvedValueOnce('Requesting User');

    await amendmentServerMutators.addCollaborator.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: addCollaboratorArgs({
        user_id: 'user-1',
        status: 'requested',
      }),
    });

    expect(fireNotificationMock).toHaveBeenCalledWith('notifyCollaborationRequest', {
      senderId: 'user-1',
      senderName: 'Requesting User',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    expect(fireNotificationMock).not.toHaveBeenCalledWith(
      'notifyCollaborationInvite',
      expect.anything()
    );
  });

  it('rejects direct amendment retargeting to an event with an expired amendment deadline', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        title: 'Amendment',
        event_id: null,
        editing_mode: 'edit',
      })
      .mockResolvedValueOnce({
        id: 'event-closed',
        amendment_deadline: Date.now() - 1,
      });
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.update.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'amendment-1',
          event_id: 'event-closed',
        },
      })
    ).rejects.toThrow('Antragsfrist');

    expect(amendmentUpdateMock).not.toHaveBeenCalled();
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

  it('requires amendment manage rights before replanning branch events', async () => {
    const tx = createTx('server');
    const args = {
      branch_id: 'branch-1',
      event_updates: [{ step_run_id: 'step-1', event_id: 'event-2' }],
    };
    tx.run
      .mockResolvedValueOnce({ id: 'branch-1', process_run_id: 'run-1' })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });

    await expect(
      amendmentServerMutators.replanProcessBranchEvents.fn({
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
    expect(processEngineMocks.replanProcessBranchEvents).toHaveBeenCalledWith(tx, 'user-1', args);
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

  it('appends new event change requests before the branch final-closing link', async () => {
    const tx = createEventChangeRequestTx();
    const amendment = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: 'legacy-event',
      editing_mode: 'suggest_event',
      current_process_run_id: 'run-1',
    };
    tx.run
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([{ event_id: 'event-permission', status: 'scheduled' }])
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-other', event_id: 'event-other', amendment_id: 'amendment-1' },
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'link-existing',
          agenda_item_id: 'agenda-target',
          change_request_id: 'cr-existing',
          vote_id: 'vote-existing',
          order_index: 0,
          is_closing_vote: false,
          step_kind: 'change_request',
          process_branch_id: 'branch-1',
        },
        {
          id: 'link-final',
          agenda_item_id: 'agenda-target',
          change_request_id: null,
          vote_id: 'vote-final',
          order_index: 1,
          is_closing_vote: true,
          step_kind: 'closing',
          process_branch_id: 'branch-1',
        },
      ])
      .mockResolvedValueOnce({
        id: 'vote-final',
        purpose: 'closing',
        status: 'indicative',
      })
      .mockResolvedValueOnce([{ user_id: 'voter-1' }]);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');
    eventTitleMock.mockResolvedValueOnce('Target Event');

    await amendmentServerMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createChangeRequestArgs(),
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
        status: 'indicative',
      })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'link-final',
        order_index: 2,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: 'cr-new',
        order_index: 1,
        step_kind: 'change_request',
        process_branch_id: 'branch-1',
        is_closing_vote: false,
      })
    );
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyEventChangeRequestCreated',
      expect.objectContaining({
        eventId: 'event-target',
      })
    );
  });

  it('appends open event change requests before an existing final vote without a timeline link', async () => {
    const tx = createEventChangeRequestTx();
    const amendment = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: null,
      editing_mode: 'suggest_event',
      current_process_run_id: 'run-1',
    };
    tx.run
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([{ event_id: 'event-permission', status: 'scheduled' }])
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'vote-final',
          agenda_item_id: 'agenda-target',
          amendment_id: 'amendment-1',
          purpose: 'closing',
          status: 'indicative',
        },
      ])
      .mockResolvedValueOnce([{ user_id: 'voter-1' }]);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');
    eventTitleMock.mockResolvedValueOnce('Target Event');

    await amendmentServerMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createChangeRequestArgs(),
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
        status: 'indicative',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: 'cr-new',
        order_index: 0,
        step_kind: 'change_request',
        process_branch_id: 'branch-1',
        is_closing_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: null,
        vote_id: 'vote-final',
        order_index: 1,
        step_kind: 'closing',
        process_branch_id: 'branch-1',
        is_closing_vote: true,
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyEventChangeRequestCreated',
      expect.objectContaining({
        eventId: 'event-target',
      })
    );
  });

  it('does not create vote steps or notifications for pending event submissions', async () => {
    const tx = createEventChangeRequestTx();
    const amendment = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: 'event-target',
      editing_mode: 'suggest_event',
      current_process_run_id: 'run-1',
    };
    tx.run
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([{ event_id: 'event-target', status: 'scheduled' }])
      .mockResolvedValueOnce(amendment);

    await amendmentServerMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createChangeRequestArgs({
        status: 'pending_submission',
        voting_status: 'pending_submission',
      }),
    });

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
    expect(fireNotificationMock).not.toHaveBeenCalled();
  });

  it('appends event change request vote steps and notifications when a pending submission becomes open', async () => {
    const tx = createEventChangeRequestTx();
    const previousChangeRequest = {
      id: 'cr-pending',
      amendment_id: 'amendment-1',
      user_id: 'user-1',
      status: 'pending_submission',
      title: 'Pending CR',
      process_branch_id: 'branch-1',
    };
    const amendment = {
      id: 'amendment-1',
      event_id: null,
      editing_mode: 'suggest_event',
    };
    tx.run
      .mockResolvedValueOnce(previousChangeRequest)
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'link-final',
          agenda_item_id: 'agenda-target',
          change_request_id: null,
          vote_id: 'vote-final',
          order_index: 0,
          is_closing_vote: true,
          step_kind: 'closing',
          process_branch_id: 'branch-1',
        },
      ])
      .mockResolvedValueOnce({
        id: 'vote-final',
        purpose: 'closing',
        status: 'indicative',
      })
      .mockResolvedValueOnce([]);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');
    eventTitleMock.mockResolvedValueOnce('Target Event');

    await amendmentServerMutators.updateChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'cr-pending',
        status: 'open',
        voting_status: 'open',
      },
    });

    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'link-final',
        order_index: 1,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: 'cr-pending',
        order_index: 0,
        process_branch_id: 'branch-1',
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyChangeRequestCreated', {
      senderId: 'user-1',
      senderName: 'Author',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
    });
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyEventChangeRequestCreated',
      expect.objectContaining({
        senderId: 'user-1',
        eventId: 'event-target',
      })
    );
  });

  it('appends submitted event change requests when the final vote exists without a timeline link', async () => {
    const tx = createEventChangeRequestTx();
    const previousChangeRequest = {
      id: 'cr-pending',
      amendment_id: 'amendment-1',
      user_id: 'user-1',
      status: 'pending_submission',
      title: 'Pending CR',
      process_branch_id: 'branch-1',
    };
    const amendment = {
      id: 'amendment-1',
      event_id: null,
      editing_mode: 'suggest_event',
    };
    tx.run
      .mockResolvedValueOnce(previousChangeRequest)
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'vote-final',
          agenda_item_id: 'agenda-target',
          amendment_id: 'amendment-1',
          purpose: 'closing',
          status: 'indicative',
        },
      ])
      .mockResolvedValueOnce([{ user_id: 'voter-1' }]);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');
    eventTitleMock.mockResolvedValueOnce('Target Event');

    await amendmentServerMutators.updateChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'cr-pending',
        status: 'open',
        voting_status: 'open',
      },
    });

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        amendment_id: 'amendment-1',
        purpose: 'change_request',
        status: 'indicative',
      })
    );
    expect(tx.mutate.vote_choice.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.voter.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: 'cr-pending',
        order_index: 0,
        step_kind: 'change_request',
        process_branch_id: 'branch-1',
        is_closing_vote: false,
      })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        agenda_item_id: 'agenda-target',
        change_request_id: null,
        vote_id: 'vote-final',
        order_index: 1,
        step_kind: 'closing',
        process_branch_id: 'branch-1',
        is_closing_vote: true,
      })
    );
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyEventChangeRequestCreated',
      expect.objectContaining({
        senderId: 'user-1',
        eventId: 'event-target',
      })
    );
  });

  it('deletes pending event submissions for the author', async () => {
    const tx = createEventChangeRequestTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'cr-pending',
        amendment_id: 'amendment-1',
        user_id: 'user-1',
        status: 'pending_submission',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        event_id: 'event-1',
      });

    await amendmentServerMutators.deleteChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { id: 'cr-pending' },
    });

    expect(changeRequestDeleteMock).toHaveBeenCalledWith({
      tx,
      ctx: createCtx(),
      args: { id: 'cr-pending' },
    });
    expect(canMock).not.toHaveBeenCalled();
  });

  it('rejects deleting already submitted change requests', async () => {
    const tx = createEventChangeRequestTx();
    tx.run.mockResolvedValueOnce({
      id: 'cr-open',
      amendment_id: 'amendment-1',
      user_id: 'user-1',
      status: 'open',
    });

    await expect(
      amendmentServerMutators.deleteChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'cr-open' },
      })
    ).rejects.toThrow('Only pending change request submissions can be deleted');

    expect(changeRequestDeleteMock).not.toHaveBeenCalled();
  });

  it('does not append event change requests after final closing has started', async () => {
    const tx = createEventChangeRequestTx();
    const amendment = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: 'legacy-event',
      editing_mode: 'suggest_event',
      current_process_run_id: 'run-1',
    };
    tx.run
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([{ event_id: 'event-permission', status: 'scheduled' }])
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'link-final',
          agenda_item_id: 'agenda-target',
          change_request_id: null,
          vote_id: 'vote-final',
          order_index: 0,
          is_closing_vote: true,
          step_kind: 'closing',
          process_branch_id: 'branch-1',
        },
      ])
      .mockResolvedValueOnce({
        id: 'vote-final',
        purpose: 'closing',
        status: 'final',
      });
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');

    await amendmentServerMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createChangeRequestArgs(),
    });

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
  });

  it.each(['final', 'closed'])(
    'does not append missing-link event change request vote steps when final vote is %s',
    async status => {
      const tx = createEventChangeRequestTx();
      const amendment = {
        id: 'amendment-1',
        title: 'Amendment',
        event_id: null,
        editing_mode: 'suggest_event',
        current_process_run_id: 'run-1',
      };
      tx.run
        .mockResolvedValueOnce(amendment)
        .mockResolvedValueOnce({
          id: 'branch-1',
          editing_mode: 'suggest_event',
        })
        .mockResolvedValueOnce([{ event_id: 'event-permission', status: 'scheduled' }])
        .mockResolvedValueOnce(amendment)
        .mockResolvedValueOnce({
          id: 'branch-1',
          editing_mode: 'suggest_event',
        })
        .mockResolvedValueOnce([
          { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'vote-final',
            agenda_item_id: 'agenda-target',
            amendment_id: 'amendment-1',
            purpose: 'closing',
            status,
          },
        ]);
      amendmentTitleMock.mockResolvedValueOnce('Amendment');
      userNameMock.mockResolvedValueOnce('Author');

      await amendmentServerMutators.createChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: createChangeRequestArgs(),
      });

      expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
      expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
      expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
    }
  );

  it('does not duplicate event change request timeline links', async () => {
    const tx = createEventChangeRequestTx();
    const amendment = {
      id: 'amendment-1',
      title: 'Amendment',
      event_id: null,
      editing_mode: 'suggest_event',
      current_process_run_id: 'run-1',
    };
    tx.run
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([{ event_id: 'event-permission', status: 'scheduled' }])
      .mockResolvedValueOnce(amendment)
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce([
        { id: 'agenda-target', event_id: 'event-target', amendment_id: 'amendment-1' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'link-existing-cr',
          agenda_item_id: 'agenda-target',
          change_request_id: 'cr-new',
          vote_id: 'vote-existing',
          order_index: 0,
          is_closing_vote: false,
          step_kind: 'change_request',
          process_branch_id: 'branch-1',
        },
      ]);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');
    userNameMock.mockResolvedValueOnce('Author');

    await amendmentServerMutators.createChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: createChangeRequestArgs(),
    });

    expect(tx.mutate.vote.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.insert).not.toHaveBeenCalled();
    expect(tx.mutate.agenda_item_change_request.update).not.toHaveBeenCalled();
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

  it('allows voting on unscoped full-text change requests when the amendment document is in internal voting mode', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const args = {
      id: 'vote-1',
      change_request_id: 'change-request-1',
      vote: 'accept' as const,
    };
    const changeRequest = {
      id: 'change-request-1',
      amendment_id: 'amendment-1',
      process_branch_id: null,
      user_id: 'user-1',
      status: 'open',
      voting_status: 'open',
    };

    tx.run
      .mockResolvedValueOnce(changeRequest)
      .mockResolvedValueOnce({
        id: 'amendment-1',
        document_id: 'document-1',
      })
      .mockResolvedValueOnce({
        id: 'document-1',
        editing_mode: 'vote_internal',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(changeRequest)
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.voteOnChangeRequest.fn({
        tx: tx as never,
        ctx,
        args,
      })
    ).resolves.toBeUndefined();

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'vote',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(voteOnChangeRequestMock).toHaveBeenCalledWith({ tx, ctx, args });
  });

  it('rejects voting on unscoped full-text change requests when the amendment document is not in internal voting mode', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'change-request-1',
        amendment_id: 'amendment-1',
        process_branch_id: null,
        user_id: 'user-1',
        status: 'open',
        voting_status: 'open',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        document_id: 'document-1',
      })
      .mockResolvedValueOnce({
        id: 'document-1',
        editing_mode: 'edit',
      });

    await expect(
      amendmentServerMutators.voteOnChangeRequest.fn({
        tx: tx as never,
        ctx,
        args: {
          id: 'vote-1',
          change_request_id: 'change-request-1',
          vote: 'accept',
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(canMock).not.toHaveBeenCalled();
    expect(voteOnChangeRequestMock).not.toHaveBeenCalled();
  });

  it('allows internal change request vote finalization with amendment manage rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'change-request-1',
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        status: 'open',
        voting_status: 'in_progress',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        event_id: null,
        title: 'Amendment',
      })
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'vote_internal',
      })
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
        tx: tx as never,
        ctx,
        args: { change_request_id: 'change-request-1' },
      })
    ).resolves.toBeUndefined();

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(tx.run).toHaveBeenCalledTimes(4);
  });

  it('allows unscoped internal change request vote finalization when the amendment document is in internal voting mode', async () => {
    const tx = createTx('server');
    const ctx = createCtx();

    tx.run
      .mockResolvedValueOnce({
        id: 'change-request-1',
        amendment_id: 'amendment-1',
        process_branch_id: null,
        status: 'open',
        voting_status: 'in_progress',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        document_id: 'document-1',
        event_id: null,
        title: 'Amendment',
      })
      .mockResolvedValueOnce({
        id: 'document-1',
        editing_mode: 'vote_internal',
      })
      .mockResolvedValueOnce(null);
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
        tx: tx as never,
        ctx,
        args: { change_request_id: 'change-request-1' },
      })
    ).resolves.toBeUndefined();

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(tx.run).toHaveBeenCalledTimes(4);
  });

  it('rejects internal change request vote finalization for update-only amendment rights', async () => {
    const tx = createTx('server');
    const ctx = createCtx();
    const error = new PermissionError('manage', 'amendments', 'amendment:amendment-1');

    tx.run
      .mockResolvedValueOnce({
        id: 'change-request-1',
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        status: 'open',
        voting_status: 'in_progress',
      })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        event_id: null,
        title: 'Amendment',
      })
      .mockResolvedValueOnce({
        id: 'branch-1',
        editing_mode: 'vote_internal',
      });
    canMock.mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
        tx: tx as never,
        ctx,
        args: { change_request_id: 'change-request-1' },
      })
    ).rejects.toBe(error);

    expect(canMock).toHaveBeenCalledWith(tx, ctx, {
      action: 'manage',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(tx.run).toHaveBeenCalledTimes(3);
  });

  it('updates process branches directly after server authorization', async () => {
    const tx = createProcessBranchUpdateTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'scheduled',
        resolution: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce([]);
    canMock.mockResolvedValueOnce(undefined);
    amendmentTitleMock.mockResolvedValueOnce('Amendment');

    await expect(
      amendmentServerMutators.updateProcessBranch.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'branch-1',
          editing_mode: 'suggest_internal',
        },
      })
    ).resolves.toBeUndefined();

    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'update',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        editing_mode: 'suggest_internal',
        updated_at: expect.any(Number),
      })
    );
    expect(sharedUpdateProcessBranchMock).not.toHaveBeenCalled();
    expect(fireNotificationMock).toHaveBeenCalledWith('notifyWorkflowChanged', {
      senderId: 'user-1',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment',
      newStatus: 'suggest_internal',
    });
  });

  it('does not update process branches when amendment update permission is denied', async () => {
    const tx = createProcessBranchUpdateTx('server');
    const error = new PermissionError('update', 'amendments', 'amendment:amendment-1');
    tx.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'scheduled',
        resolution: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      });
    canMock.mockRejectedValueOnce(error);

    await expect(
      amendmentServerMutators.updateProcessBranch.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'branch-1',
          editing_mode: 'suggest_internal',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
    expect(sharedUpdateProcessBranchMock).not.toHaveBeenCalled();
  });

  it('rejects direct street-design updates outside collaborative edit mode', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'street-design-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce({
        id: 'amendment-1',
        origin_amendment_id: null,
        clone_source_id: null,
      })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'suggest_event',
        status: 'scheduled',
        resolution: null,
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.updateStreetDesign.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'street-design-1',
          process_branch_id: 'branch-1',
          title: 'Not allowed',
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'update',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });
  });

  it('keeps terminal process branches readonly on the server', async () => {
    const tx = createProcessBranchUpdateTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'completed',
        resolution: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      });
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.updateProcessBranch.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'branch-1',
          editing_mode: 'suggest_internal',
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
    expect(sharedUpdateProcessBranchMock).not.toHaveBeenCalled();
  });

  it('rejects manually selected automatic event branch modes on the server', async () => {
    const tx = createProcessBranchUpdateTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'scheduled',
        resolution: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce([]);
    canMock.mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.updateProcessBranch.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'branch-1',
          editing_mode: 'suggest_event',
        },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
    expect(sharedUpdateProcessBranchMock).not.toHaveBeenCalled();
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

  it('rejects process task completion when the target event amendment deadline expired', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({
        id: 'task-1',
        process_run_id: 'run-1',
        event_id: null,
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        amendment_id: 'amendment-1',
      })
      .mockResolvedValueOnce({
        id: 'event-closed',
        amendment_deadline: Date.now() - 1,
      });
    canMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    await expect(
      amendmentServerMutators.completeProcessTaskWithEvent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          process_task_id: 'task-1',
          event_id: 'event-closed',
          description: null,
        },
      })
    ).rejects.toThrow('Antragsfrist');

    expect(processEngineMocks.completeProcessTaskWithEvent).not.toHaveBeenCalled();
  });
});
