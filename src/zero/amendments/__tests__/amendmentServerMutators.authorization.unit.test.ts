import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { DEFAULT_AMENDMENT_ROLES } from '../../rbac/constants';
import { encodeAppError } from '@/features/shared/errors/app-error';
import * as editingModePolicy from '../editing-mode-policy';
import * as eventModeTransition from '../event-mode-transition';

const canMock = vi.fn();
const amendmentCreateMock = vi.fn();
const amendmentUpdateMock = vi.fn();
const amendmentDeleteMock = vi.fn();
const addCollaboratorMock = vi.fn();
const removeCollaboratorMock = vi.fn();
const updateCollaboratorMock = vi.fn();
const createCityDesignMock = vi.fn();
const updateCityDesignMock = vi.fn();
const deleteCityDesignMock = vi.fn();
const createChangeRequestMock = vi.fn();
const createDocumentChangeRequestMock = vi.fn();
const updateChangeRequestMock = vi.fn();
const createSupportConfirmationMock = vi.fn();
const updateSupportConfirmationMock = vi.fn();
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
const initializeChangeRequestVotingMock = vi.fn();
const documentCreateMock = vi.fn();
const documentAddCollaboratorMock = vi.fn();
const syncEntityHashtagsMock = vi.fn();
const processEngineMocks = vi.hoisted(() => ({
  completeProcessTaskWithEvent: vi.fn(),
  initializeAmendmentProcessPath: vi.fn(),
  replanProcessBranchEvents: vi.fn(),
  resolveAmendmentProcessVote: vi.fn(),
}));
const documentIntegrityMocks = vi.hoisted(() => ({
  assertDocumentSuggestionIntegrity: vi.fn(),
  assertPersistedDocumentChangeRequestIntegrity: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    amendments: {
      create: { fn: (...args: unknown[]) => amendmentCreateMock(...args) },
      update: { fn: (...args: unknown[]) => amendmentUpdateMock(...args) },
      delete: { fn: (...args: unknown[]) => amendmentDeleteMock(...args) },
      addCollaborator: { fn: (...args: unknown[]) => addCollaboratorMock(...args) },
      removeCollaborator: { fn: (...args: unknown[]) => removeCollaboratorMock(...args) },
      updateCollaborator: { fn: (...args: unknown[]) => updateCollaboratorMock(...args) },
      createCityDesign: { fn: (...args: unknown[]) => createCityDesignMock(...args) },
      updateCityDesign: { fn: (...args: unknown[]) => updateCityDesignMock(...args) },
      deleteCityDesign: { fn: (...args: unknown[]) => deleteCityDesignMock(...args) },
      createChangeRequest: { fn: (...args: unknown[]) => createChangeRequestMock(...args) },
      createDocumentChangeRequest: {
        fn: (...args: unknown[]) => createDocumentChangeRequestMock(...args),
      },
      voteOnChangeRequest: { fn: (...args: unknown[]) => voteOnChangeRequestMock(...args) },
      updateChangeRequest: { fn: (...args: unknown[]) => updateChangeRequestMock(...args) },
      deleteChangeRequest: { fn: (...args: unknown[]) => changeRequestDeleteMock(...args) },
      createSupportConfirmation: {
        fn: (...args: unknown[]) => createSupportConfirmationMock(...args),
      },
      updateSupportConfirmation: {
        fn: (...args: unknown[]) => updateSupportConfirmationMock(...args),
      },
      updateProcessBranch: { fn: (...args: unknown[]) => sharedUpdateProcessBranchMock(...args) },
      createProcessTask: { fn: (...args: unknown[]) => createProcessTaskMock(...args) },
      supportAmendment: { fn: (...args: unknown[]) => supportAmendmentMock(...args) },
      updateSupportVote: { fn: (...args: unknown[]) => updateSupportVoteMock(...args) },
      deleteSupportVote: { fn: vi.fn() },
    },
    documents: {
      addCollaborator: { fn: (...args: unknown[]) => documentAddCollaboratorMock(...args) },
    },
  },
}));
const internalVotingMocks = vi.hoisted(() => ({
  finalizeExpiredInternalChangeRequestVotesForAmendment: vi.fn(),
  initializeInternalChangeRequestVotingForAmendment: vi.fn(),
  maybeFinalizeInternalChangeRequestVote: vi.fn(),
  repairInternalChangeRequestResolution: vi.fn(),
  resolveInternalChangeRequestVote: vi.fn(),
}));

vi.mock('../../documents/server-mutators', () => ({
  documentServerMutators: {
    create: { fn: (...args: unknown[]) => documentCreateMock(...args) },
  },
}));

vi.mock('../../common/server-hashtags', () => ({
  syncEntityHashtagsForCreate: (...args: unknown[]) => syncEntityHashtagsMock(...args),
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

vi.mock('../../agendas/server-mutators', () => ({
  materializeCurrentForwardConfirmedEventVoting: (...args: unknown[]) =>
    initializeChangeRequestVotingMock(...args),
}));

vi.mock('../../change-requests/document-integrity', () => ({
  assertDocumentSuggestionIntegrity: documentIntegrityMocks.assertDocumentSuggestionIntegrity,
  assertPersistedDocumentChangeRequestIntegrity:
    documentIntegrityMocks.assertPersistedDocumentChangeRequestIntegrity,
  isCityDesignChangeRequestSource: (sourceType: string | null | undefined) => {
    const normalized = sourceType?.trim().toLowerCase() ?? '';
    return normalized.startsWith('city_design_');
  },
}));

vi.mock('../../change-requests/internal-voting', () => internalVotingMocks);

import { amendmentServerMutatorInternals, amendmentServerMutators } from '../server-mutators';

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
    country: null,
    region: null,
    post_code: null,
    city: null,
    street: null,
    house_number: null,
    latitude: null,
    longitude: null,
    tags: null,
    visibility: 'public',
    discussions: null,
    image_url: null,
    video_url: null,
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
    amendmentCreateMock.mockReset();
    amendmentUpdateMock.mockReset();
    amendmentDeleteMock.mockReset();
    addCollaboratorMock.mockReset();
    removeCollaboratorMock.mockReset();
    updateCollaboratorMock.mockReset();
    createCityDesignMock.mockReset();
    updateCityDesignMock.mockReset();
    deleteCityDesignMock.mockReset();
    createChangeRequestMock.mockReset();
    createDocumentChangeRequestMock.mockReset();
    updateChangeRequestMock.mockReset();
    createSupportConfirmationMock.mockReset();
    updateSupportConfirmationMock.mockReset();
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
    initializeChangeRequestVotingMock.mockReset();
    documentCreateMock.mockReset();
    documentAddCollaboratorMock.mockReset();
    syncEntityHashtagsMock.mockReset();
    documentIntegrityMocks.assertDocumentSuggestionIntegrity.mockReset();
    documentIntegrityMocks.assertPersistedDocumentChangeRequestIntegrity.mockReset();
    Object.values(processEngineMocks).forEach(mock => mock.mockReset());
    Object.values(internalVotingMocks).forEach(mock => mock.mockReset());
    processEngineMocks.completeProcessTaskWithEvent.mockResolvedValue({ handled: false });
    processEngineMocks.initializeAmendmentProcessPath.mockResolvedValue({ handled: false });
    processEngineMocks.replanProcessBranchEvents.mockResolvedValue({ handled: false });
    processEngineMocks.resolveAmendmentProcessVote.mockResolvedValue({ handled: false });
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
    ).rejects.toThrow(encodeAppError('event_deadline_expired'));

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

  it('requests vote materialization for the newly active process branch', async () => {
    const tx = createTx('server');
    const args = initializeProcessPathArgs();
    tx.run.mockResolvedValueOnce(null).mockResolvedValueOnce([
      {
        id: 'membership-1',
        membership_roles: [{ role_id: 'role-1' }],
      },
    ]);
    processEngineMocks.initializeAmendmentProcessPath.mockResolvedValueOnce({
      handled: true,
      branchId: 'branch-1',
    });

    await amendmentServerMutators.initializeProcessPath.fn({
      tx: tx as never,
      ctx: createCtx(),
      args,
    });

    expect(initializeChangeRequestVotingMock).toHaveBeenCalledTimes(1);
    expect(initializeChangeRequestVotingMock).toHaveBeenCalledWith(tx, createCtx(), 'branch-1');
  });

  it('rejects an inconsistent open document change request before process writes', async () => {
    const tx = createTx('server');
    const args = initializeProcessPathArgs();
    tx.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        {
          id: 'membership-1',
          membership_roles: [{ role_id: 'role-1' }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'change-request-1',
          status: 'open',
          voting_status: 'open',
          suggestion_id: 'suggestion-1',
          process_branch_id: null,
          source_type: null,
        },
      ]);
    documentIntegrityMocks.assertPersistedDocumentChangeRequestIntegrity.mockRejectedValueOnce(
      new Error('linked suggestion is not present in the document')
    );

    await expect(
      amendmentServerMutators.initializeProcessPath.fn({
        tx: tx as never,
        ctx: createCtx(),
        args,
      })
    ).rejects.toThrow(encodeAppError('validation_failed'));

    expect(processEngineMocks.initializeAmendmentProcessPath).not.toHaveBeenCalled();
    expect(initializeChangeRequestVotingMock).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce(changeRequest);
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
    expect(tx.run).toHaveBeenCalledTimes(3);
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
    expect(tx.run).toHaveBeenCalledTimes(3);
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

  it('rejects direct city-design updates outside collaborative edit mode', async () => {
    const tx = createTx('server');
    tx.run
      .mockResolvedValueOnce({ id: 'city-design-1', amendment_id: 'amendment-1' })
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
      amendmentServerMutators.updateCityDesign.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'city-design-1',
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
    ).rejects.toThrow(encodeAppError('event_deadline_expired'));

    expect(processEngineMocks.completeProcessTaskWithEvent).not.toHaveBeenCalled();
  });

  it('covers process-task title selection and required row loaders', async () => {
    expect(
      amendmentServerMutatorInternals.getProcessTaskNotificationTitle(
        'schedule_event',
        '  Custom  '
      )
    ).toBe('Custom');
    expect(
      amendmentServerMutatorInternals.getProcessTaskNotificationTitle('implementation_evaluation')
    ).toBeTruthy();
    expect(
      amendmentServerMutatorInternals.getProcessTaskNotificationTitle('support_confirmation')
    ).toBeTruthy();
    expect(amendmentServerMutatorInternals.getProcessTaskNotificationTitle('other')).toBeTruthy();

    for (const loader of [
      amendmentServerMutatorInternals.loadAmendmentForMutation,
      amendmentServerMutatorInternals.loadProcessBranchForMutation,
      amendmentServerMutatorInternals.loadCollaboratorForMutation,
      amendmentServerMutatorInternals.loadCityDesignForMutation,
      amendmentServerMutatorInternals.loadChangeRequestForMutation,
      amendmentServerMutatorInternals.loadSupportVoteForMutation,
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(null);
      await expect(loader(tx as never, 'missing')).rejects.toThrow();
    }

    const missingRun = createTx();
    missingRun.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.loadProcessRunForBranch(
        missingRun as never,
        {
          process_run_id: 'missing',
        } as never
      )
    ).rejects.toThrow('Process run not found');
  });

  it('resolves branch and document editing modes including a documentless amendment', async () => {
    const branchTx = createTx();
    branchTx.run.mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'suggest_internal' });
    await expect(
      amendmentServerMutatorInternals.resolveChangeRequestMutationEditingMode({
        tx: branchTx as never,
        amendmentId: 'amendment-1',
        processBranchId: 'branch-1',
      })
    ).resolves.toEqual({
      branch: { id: 'branch-1', editing_mode: 'suggest_internal' },
      mode: 'suggest_internal',
    });

    const documentTx = createTx();
    documentTx.run.mockResolvedValueOnce({ id: 'document-1', editing_mode: 'vote_internal' });
    await expect(
      amendmentServerMutatorInternals.resolveChangeRequestMutationEditingMode({
        tx: documentTx as never,
        amendmentId: 'amendment-1',
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
      })
    ).resolves.toEqual({ branch: null, mode: 'vote_internal' });

    const documentlessTx = createTx();
    await expect(
      amendmentServerMutatorInternals.resolveChangeRequestMutationEditingMode({
        tx: documentlessTx as never,
        amendmentId: 'amendment-1',
        amendment: { id: 'amendment-1', document_id: null } as never,
      })
    ).resolves.toEqual({ branch: null, mode: 'edit' });
    expect(documentlessTx.run).not.toHaveBeenCalled();
  });

  it('enforces city-design branch ownership, editability, and direct edit mode', async () => {
    const amendment = { id: 'amendment-1', origin_amendment_id: null, clone_source_id: null };
    const branch = {
      id: 'branch-1',
      process_run_id: 'run-1',
      editing_mode: 'edit',
      status: 'active',
      resolution: null,
    };
    const cases = [
      {
        branch,
        run: { id: 'run-1', amendment_id: 'other' },
        message: 'does not belong',
      },
      {
        branch: { ...branch, status: 'rejected' },
        run: { id: 'run-1', amendment_id: 'amendment-1' },
        message: PermissionError,
      },
      {
        branch: { ...branch, editing_mode: 'suggest_internal' },
        run: { id: 'run-1', amendment_id: 'amendment-1' },
        message: PermissionError,
      },
    ];
    for (const testCase of cases) {
      const tx = createTx();
      tx.run
        .mockResolvedValueOnce(amendment)
        .mockResolvedValueOnce(testCase.branch)
        .mockResolvedValueOnce(testCase.run);
      await expect(
        amendmentServerMutatorInternals.assertCityDesignDirectEditMode(
          tx as never,
          'amendment-1',
          'branch-1'
        )
      ).rejects.toThrow(testCase.message);
    }

    const direct = createTx();
    direct.run.mockResolvedValueOnce({ ...amendment, document_id: null });
    await expect(
      amendmentServerMutatorInternals.assertCityDesignDirectEditMode(
        direct as never,
        'amendment-1',
        null
      )
    ).resolves.toBeUndefined();
  });

  it('covers source-group and replan lookup edge cases', async () => {
    const noRoles = createTx();
    noRoles.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        { membership_roles: null },
        { membership_roles: [{ role_id: null }] },
      ]);
    await expect(
      amendmentServerMutatorInternals.assertCanUseAmendmentPathSourceGroup(
        noRoles as never,
        createCtx(),
        'group-1'
      )
    ).rejects.toThrow(PermissionError);

    const missingBranch = createTx();
    missingBranch.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertCanReplanProcessBranchEvents(
        missingBranch as never,
        createCtx(),
        'missing'
      )
    ).rejects.toThrow('Process branch not found');

    const missingRun = createTx();
    missingRun.run
      .mockResolvedValueOnce({ id: 'branch-1', process_run_id: 'missing' })
      .mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertCanReplanProcessBranchEvents(
        missingRun as never,
        createCtx(),
        'branch-1'
      )
    ).rejects.toThrow('Process run not found');
  });

  it('loads the first event agenda item and recognizes its started state', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([
        { id: 'step-1', event_id: 'event-1', agenda_item_id: 'agenda-linked', order_index: 0 },
      ])
      .mockResolvedValueOnce([{ id: 'agenda-first', status: 'pending' }])
      .mockResolvedValueOnce({ id: 'agenda-linked', status: 'active' });
    await expect(
      amendmentServerMutatorInternals.loadFirstProcessBranchAgendaItemState(
        tx as never,
        {
          id: 'branch-1',
        } as never
      )
    ).resolves.toEqual({ hasProcess: true, firstAgendaItemStarted: true });
  });

  it('finds current branch and process events with terminal and amendment fallbacks', async () => {
    const branchActive = createTx();
    branchActive.run.mockResolvedValueOnce([
      { event_id: 'event-terminal', status: 'completed' },
      { event_id: 'event-active', status: undefined },
    ]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        branchActive as never,
        { event_id: 'event-fallback' } as never,
        'branch-1'
      )
    ).resolves.toBe('event-active');

    const branchFallback = createTx();
    branchFallback.run.mockResolvedValueOnce([{ event_id: 'event-terminal', status: 'completed' }]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        branchFallback as never,
        { event_id: null } as never,
        'branch-1'
      )
    ).resolves.toBe('event-terminal');

    const noBranch = createTx();
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        noBranch as never,
        { current_process_run_id: null, event_id: 'event-amendment' } as never,
        null
      )
    ).resolves.toBe('event-amendment');
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        noBranch as never,
        { current_process_run_id: null, event_id: null } as never,
        null
      )
    ).resolves.toBeNull();

    const process = createTx();
    process.run.mockResolvedValueOnce([
      { event_id: null, status: 'pending' },
      { event_id: 'event-process', status: 'active' },
    ]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        process as never,
        { current_process_run_id: 'run-1', event_id: null } as never,
        null
      )
    ).resolves.toBe('event-process');
  });

  it('covers change-request creation permission modes and missing event context', async () => {
    for (const mode of ['view', 'event_final_closing_vote', 'passed', 'rejected']) {
      const tx = createTx();
      tx.run
        .mockResolvedValueOnce({ id: 'amendment-1' })
        .mockResolvedValueOnce({ id: 'branch-1', editing_mode: mode });
      await expect(
        amendmentServerMutatorInternals.assertCanCreateChangeRequest(
          tx as never,
          createCtx(),
          'amendment-1',
          'branch-1'
        )
      ).rejects.toThrow(PermissionError);
    }

    const internal = createTx();
    internal.run
      .mockResolvedValueOnce({ id: 'amendment-1' })
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'edit' });
    await expect(
      amendmentServerMutatorInternals.assertCanCreateChangeRequest(
        internal as never,
        createCtx(),
        'amendment-1',
        'branch-1'
      )
    ).resolves.toBeTruthy();

    const noEvent = createTx();
    noEvent.run
      .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce([]);
    await expect(
      amendmentServerMutatorInternals.assertCanCreateChangeRequest(
        noEvent as never,
        createCtx(),
        'amendment-1',
        'branch-1'
      )
    ).rejects.toThrow(PermissionError);
  });

  it('routes process-vote authorization through event, amendment, and invalid scopes', async () => {
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertCanResolveProcessVote(
        missing as never,
        createCtx(),
        'missing'
      )
    ).rejects.toThrow('Agenda item not found');

    const event = createTx();
    event.run.mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' });
    await amendmentServerMutatorInternals.assertCanResolveProcessVote(
      event as never,
      createCtx(),
      'agenda-1'
    );

    const amendment = createTx();
    amendment.run.mockResolvedValueOnce({ id: 'agenda-1', amendment_id: 'amendment-1' });
    await amendmentServerMutatorInternals.assertCanResolveProcessVote(
      amendment as never,
      createCtx(),
      'agenda-1'
    );

    const invalid = createTx();
    invalid.run.mockResolvedValueOnce({ id: 'agenda-1', event_id: null, amendment_id: null });
    await expect(
      amendmentServerMutatorInternals.assertCanResolveProcessVote(
        invalid as never,
        createCtx(),
        'agenda-1'
      )
    ).rejects.toThrow(PermissionError);
  });

  it('validates process-task rows, previous event rights, and target event existence', async () => {
    const missingTask = createTx();
    missingTask.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertCanCompleteProcessTaskWithEvent(
        missingTask as never,
        createCtx(),
        'missing',
        'event-1'
      )
    ).rejects.toThrow('Process task not found');

    const missingRun = createTx();
    missingRun.run
      .mockResolvedValueOnce({ id: 'task-1', process_run_id: 'missing' })
      .mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertCanCompleteProcessTaskWithEvent(
        missingRun as never,
        createCtx(),
        'task-1',
        'event-1'
      )
    ).rejects.toThrow('Amendment process run not found');

    const previousEvent = createTx();
    previousEvent.run
      .mockResolvedValueOnce({ id: 'task-1', process_run_id: 'run-1', event_id: 'event-old' })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce({ id: 'event-new', amendment_deadline: null });
    await amendmentServerMutatorInternals.assertCanCompleteProcessTaskWithEvent(
      previousEvent as never,
      createCtx(),
      'task-1',
      'event-new'
    );
    expect(canMock).toHaveBeenCalledWith(
      previousEvent,
      createCtx(),
      expect.objectContaining({ eventId: 'event-old' })
    );

    const missingEvent = createTx();
    missingEvent.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutatorInternals.assertAmendmentTargetEventIdOpen(
        missingEvent as never,
        'missing'
      )
    ).rejects.toThrow('Event not found');
  });

  it('requires explicit access for a private collaboration request and detects managed fields', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({
      id: 'amendment-1',
      visibility: 'private',
      created_by_id: 'other-user',
    });
    await amendmentServerMutatorInternals.assertCanViewOrRequestCollaboration(
      tx as never,
      createCtx(),
      'amendment-1'
    );
    expect(canMock).toHaveBeenCalledWith(tx, createCtx(), {
      action: 'view',
      resource: 'amendments',
      amendmentId: 'amendment-1',
    });

    expect(amendmentServerMutatorInternals.changeRequestUpdateNeedsManage({})).toBe(false);
    for (const field of [
      'status',
      'voting_status',
      'votes_for',
      'votes_against',
      'votes_abstain',
    ]) {
      expect(
        amendmentServerMutatorInternals.changeRequestUpdateNeedsManage({ [field]: null })
      ).toBe(true);
    }
  });

  it('uses terminal and amendment fallbacks for process-run event discovery', async () => {
    const terminal = createTx();
    terminal.run.mockResolvedValueOnce([
      { event_id: null, status: 'active' },
      { event_id: 'event-terminal', status: 'completed' },
    ]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        terminal as never,
        { current_process_run_id: 'run-1', event_id: 'event-amendment' } as never,
        null
      )
    ).resolves.toBe('event-terminal');

    const amendmentFallback = createTx();
    amendmentFallback.run.mockResolvedValueOnce([]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        amendmentFallback as never,
        { current_process_run_id: 'run-1', event_id: 'event-amendment' } as never,
        null
      )
    ).resolves.toBe('event-amendment');

    const nullFallback = createTx();
    nullFallback.run.mockResolvedValueOnce([]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        nullFallback as never,
        { current_process_run_id: 'run-1', event_id: null } as never,
        null
      )
    ).resolves.toBeNull();
  });

  it('resolves an unscoped event suggestion through the amendment document', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        document_id: 'document-1',
        current_process_run_id: null,
        event_id: null,
      })
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' });
    await expect(
      amendmentServerMutatorInternals.assertCanCreateChangeRequest(
        tx as never,
        createCtx(),
        'amendment-1',
        null
      )
    ).rejects.toThrow(PermissionError);

    const present = createTx();
    present.run.mockResolvedValueOnce({ id: 'collaborator-1' });
    await expect(
      amendmentServerMutatorInternals.loadCollaboratorForMutation(
        present as never,
        'collaborator-1'
      )
    ).resolves.toEqual({ id: 'collaborator-1' });
  });

  it('short-circuits event vote-step creation outside eligible states', async () => {
    const amendment = { id: 'amendment-1', document_id: null } as never;

    const internal = createTx();
    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: internal as never,
        amendment,
        changeRequest: { id: 'cr-1', status: 'open' },
        now: 1,
      })
    ).resolves.toBeNull();

    const final = createTx();
    final.run.mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' });
    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: final as never,
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
        changeRequest: { id: 'cr-1', status: 'approved' },
        now: 1,
      })
    ).resolves.toBeNull();

    const malformed = createTx();
    malformed.run
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce({ not: 'an array' });
    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: malformed as never,
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
        changeRequest: { id: 'cr-1', status: 'open' },
        now: 1,
      })
    ).resolves.toBeNull();

    const empty = createTx();
    empty.run
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce([]);
    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: empty as never,
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
        changeRequest: { id: 'cr-1', status: 'open' },
        now: 1,
      })
    ).resolves.toBeNull();
  });

  it('creates an unscoped event vote step with default labels, ordering, and no event', async () => {
    const tx = createEventChangeRequestTx();
    tx.run
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce([{ id: 'agenda-1', event_id: null, order_index: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'ordinary-link',
          agenda_item_id: 'agenda-1',
          process_branch_id: undefined,
          order_index: undefined,
        },
        {
          id: 'closing-link',
          agenda_item_id: 'agenda-1',
          process_branch_id: undefined,
          is_closing_vote: true,
          vote_id: 'vote-final',
          order_index: 0,
        },
      ])
      .mockResolvedValueOnce({ id: 'vote-final', purpose: 'closing', status: 'indicative' });
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('vote-cr' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('choice-yes' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('choice-no' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('choice-abstain' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('link-cr' as ReturnType<typeof crypto.randomUUID>);

    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: tx as never,
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
        changeRequest: { id: 'cr-1', title: null, status: 'open' },
        now: 100,
      })
    ).resolves.toBeNull();

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'vote-cr', title: expect.any(String) })
    );
    expect(tx.mutate.agenda_item_change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'closing-link', order_index: 1 })
    );
    expect(tx.mutate.agenda_item_change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'link-cr', process_branch_id: null })
    );
  });

  it('skips invalid closing links and sorts final-vote candidates by branch coverage and agenda order', async () => {
    const tx = createEventChangeRequestTx();
    tx.run
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce([
        { id: 'agenda-1', event_id: 'event-1', order_index: 0 },
        { id: 'agenda-2', event_id: 'event-2', order_index: 1 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'invalid-closing',
          agenda_item_id: 'missing-agenda',
          process_branch_id: null,
          is_closing_vote: true,
          vote_id: 'vote-invalid',
        },
        { id: 'branch-link', agenda_item_id: 'agenda-2', process_branch_id: null, order_index: 0 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'vote-2',
          agenda_item_id: 'agenda-2',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        },
        {
          id: 'vote-1',
          agenda_item_id: 'agenda-1',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        },
      ])
      .mockResolvedValueOnce({ id: 'event-2', change_request_vote_order: 'creation' });

    await expect(
      amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
        tx: tx as never,
        amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
        changeRequest: { id: 'cr-sort', title: 'Sorted', status: 'open' },
        now: 200,
      })
    ).resolves.toBe('event-2');

    expect(tx.mutate.vote.insert).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_item_id: 'agenda-2' })
    );

    const reverseComparator = createEventChangeRequestTx();
    reverseComparator.run
      .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
      .mockResolvedValueOnce([
        { id: 'agenda-1', event_id: null },
        { id: 'agenda-2', event_id: null },
      ])
      .mockResolvedValueOnce([
        { id: 'branch-link', agenda_item_id: 'agenda-2', process_branch_id: null, order_index: 0 },
      ])
      .mockResolvedValueOnce([
        {
          id: 'vote-1',
          agenda_item_id: 'agenda-1',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        },
        {
          id: 'vote-2',
          agenda_item_id: 'agenda-2',
          amendment_id: 'amendment-1',
          purpose: 'closing',
        },
      ]);
    await amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
      tx: reverseComparator as never,
      amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
      changeRequest: { id: 'cr-reverse-sort', status: 'open' },
      now: 201,
    });
  });

  it('covers equal branch-link sorting and absent agenda order fallbacks', async () => {
    const runCase = async (forceMissingOrder: boolean) => {
      const tx = createEventChangeRequestTx();
      tx.run
        .mockResolvedValueOnce({ id: 'document-1', editing_mode: 'suggest_event' })
        .mockResolvedValueOnce([
          { id: 'agenda-1', event_id: null },
          { id: 'agenda-2', event_id: null },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'vote-2',
            agenda_item_id: 'agenda-2',
            amendment_id: 'amendment-1',
            purpose: 'closing',
          },
          {
            id: 'vote-1',
            agenda_item_id: 'agenda-1',
            amendment_id: 'amendment-1',
            purpose: 'closing',
          },
        ]);

      const OriginalMap = globalThis.Map;
      const nextMapIndex = (() => {
        let value = 0;
        return () => {
          value += 1;
          return value;
        };
      })();
      if (forceMissingOrder) {
        class CoverageMap<K, V> extends OriginalMap<K, V> {
          readonly coverageIndex = nextMapIndex();
          override get(key: K) {
            return this.coverageIndex === 2 ? undefined : super.get(key);
          }
        }
        vi.stubGlobal('Map', CoverageMap);
      }
      try {
        await amendmentServerMutatorInternals.appendEventChangeRequestVoteStepIfNeeded({
          tx: tx as never,
          amendment: { id: 'amendment-1', document_id: 'document-1' } as never,
          changeRequest: { id: `cr-equal-${forceMissingOrder}`, status: 'open' },
          now: 300,
        });
      } finally {
        vi.stubGlobal('Map', OriginalMap);
      }
      expect(tx.mutate.vote.insert).toHaveBeenCalledOnce();
    };

    await runCase(false);
    await runCase(true);
  });

  it('returns resolution metadata for all direct and event modes', () => {
    for (const mode of ['edit', 'suggest_internal', 'view']) {
      expect(amendmentServerMutatorInternals.getChangeRequestResolutionMetadata(mode)).toEqual(
        expect.objectContaining({ resolved_in_mode: mode, resolution_method: 'direct_internal' })
      );
    }
    expect(
      amendmentServerMutatorInternals.getChangeRequestResolutionMetadata('suggest_event')
    ).toEqual(
      expect.objectContaining({ resolved_in_mode: 'suggest_event', resolution_method: null })
    );
  });

  it('classifies amendment owner-like roles and optional role loading exhaustively', async () => {
    const absent = createTx();
    await expect(
      amendmentServerMutatorInternals.amendmentRoleWithRights(absent as never, null)
    ).resolves.toBeNull();
    expect(absent.run).not.toHaveBeenCalled();

    const present = createTx();
    present.run.mockResolvedValueOnce({ id: 'role-1' });
    await expect(
      amendmentServerMutatorInternals.amendmentRoleWithRights(present as never, 'role-1')
    ).resolves.toEqual({ id: 'role-1' });

    expect(amendmentServerMutatorInternals.isAmendmentOwnerLikeRole(null)).toBe(false);
    expect(amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({ name: 'Author' })).toBe(true);
    expect(amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({ name: 'Owner' })).toBe(true);
    expect(amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({ name: 'Editor' })).toBe(
      false
    );
    expect(
      amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({
        name: 'Editor',
        action_rights: [{ resource: 'amendments', action: 'manage' }],
      })
    ).toBe(true);
    expect(
      amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({
        action_rights: [{ resource: 'notifications', action: 'manageNotifications' }],
      })
    ).toBe(true);
    expect(
      amendmentServerMutatorInternals.isAmendmentOwnerLikeRole({
        action_rights: [{ resource: 'notifications', action: 'read' }],
      })
    ).toBe(false);
  });

  it('notifies promotions, demotions, ordinary role changes, and early exits', async () => {
    const collaborator = {
      amendment_id: 'amendment-1',
      user_id: 'user-2',
      status: 'member',
    };

    const inactive = createTx();
    await amendmentServerMutatorInternals.notifyAmendmentCollaboratorRoleChange(
      inactive as never,
      'user-1',
      collaborator,
      undefined,
      undefined,
      undefined
    );
    expect(inactive.run).not.toHaveBeenCalled();

    const same = createTx();
    await amendmentServerMutatorInternals.notifyAmendmentCollaboratorRoleChange(
      same as never,
      'user-1',
      collaborator,
      null,
      undefined,
      'member'
    );
    expect(same.run).not.toHaveBeenCalled();

    const cases = [
      {
        previous: { name: 'Editor', action_rights: [] },
        next: { name: 'Author', action_rights: [] },
        notification: 'notifyAmendmentOwnerPromoted',
      },
      {
        previous: { name: 'Owner', action_rights: [] },
        next: { name: 'Editor', action_rights: [] },
        notification: 'notifyAmendmentOwnerDemoted',
      },
      {
        previous: { name: 'Viewer', action_rights: [] },
        next: { name: 'Editor', action_rights: [] },
        notification: 'notifyCollaborationRoleChanged',
      },
      {
        previous: { name: 'Viewer', action_rights: [] },
        next: null,
        notification: 'notifyCollaborationRoleChanged',
      },
    ];
    for (const [index, testCase] of cases.entries()) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(testCase.previous).mockResolvedValueOnce(testCase.next);
      await amendmentServerMutatorInternals.notifyAmendmentCollaboratorRoleChange(
        tx as never,
        'user-1',
        collaborator,
        `previous-${index}`,
        index === 3 ? null : `next-${index}`,
        'member'
      );
      expect(fireNotificationMock).toHaveBeenCalledWith(
        testCase.notification,
        expect.objectContaining({ amendmentId: 'amendment-1' })
      );
    }
  });

  it('completes pending and regular change-request creation without event assumptions', async () => {
    const pending = createTx();
    pending.run.mockResolvedValueOnce({ id: 'amendment-1', event_id: null });
    await amendmentServerMutatorInternals.completeChangeRequestCreation(
      pending as never,
      createCtx(),
      createChangeRequestArgs({ status: 'pending_submission' }) as never
    );

    const regular = createTx();
    regular.run.mockResolvedValueOnce({ id: 'amendment-1', document_id: null, event_id: null });
    await amendmentServerMutatorInternals.completeChangeRequestCreation(
      regular as never,
      createCtx(),
      createChangeRequestArgs({ process_branch_id: undefined }) as never
    );
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyChangeRequestCreated',
      expect.anything()
    );

    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await amendmentServerMutatorInternals.completeChangeRequestCreation(
      missing as never,
      createCtx(),
      createChangeRequestArgs() as never
    );
  });

  it('evaluates a process event with a missing status as active', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce([{ event_id: 'event-1', status: null }]);
    await expect(
      amendmentServerMutatorInternals.findCurrentProcessEventId(
        tx as never,
        { current_process_run_id: 'run-1', event_id: null } as never,
        null
      )
    ).resolves.toBe('event-1');
  });

  it('creates direct and cloned amendments across creator-role and counter branches', async () => {
    const direct = createAmendmentCreateTx();
    direct.run.mockResolvedValueOnce({ id: 'creator-collaborator' });
    await amendmentServerMutators.create.fn({
      tx: direct as never,
      ctx: createCtx(),
      args: createAmendmentArgs(),
    });
    expect(direct.mutate.amendment_collaborator.update).toHaveBeenCalledOnce();

    for (const title of ['Original title', null]) {
      const cloned = createAmendmentCreateTx();
      cloned.run
        .mockResolvedValueOnce({
          id: `source-${title ?? 'untitled'}`,
          title,
          origin_amendment_id: 'origin-1',
        })
        .mockResolvedValueOnce(null);
      await amendmentServerMutators.create.fn({
        tx: cloned as never,
        ctx: createCtx(),
        args: createAmendmentArgs({
          id: `clone-${title ?? 'untitled'}`,
          clone_source_id: `source-${title ?? 'untitled'}`,
          group_id: 'group-1',
        }),
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyAmendmentCloned',
        expect.objectContaining({ originalAmendmentTitle: title ?? 'Amendment' })
      );
    }

    const roleDefinitions = DEFAULT_AMENDMENT_ROLES as unknown as Record<string, any>[];
    const authorIndex = roleDefinitions.findIndex(role => role.name === 'Author');
    const originalAuthor = roleDefinitions[authorIndex];
    roleDefinitions[authorIndex] = { ...originalAuthor, name: 'Editor' };
    try {
      for (const existingAuthorRole of [{ id: 'existing-author' }, null]) {
        const fallback = createAmendmentCreateTx();
        fallback.run.mockResolvedValueOnce(existingAuthorRole).mockResolvedValueOnce(null);
        await amendmentServerMutators.create.fn({
          tx: fallback as never,
          ctx: createCtx(),
          args: createAmendmentArgs({ id: `fallback-${existingAuthorRole ? 'found' : 'missing'}` }),
        });
        expect(fallback.mutate.amendment_collaborator.insert).toHaveBeenCalledWith(
          expect.objectContaining({ role_id: existingAuthorRole?.id ?? null })
        );
      }
    } finally {
      roleDefinitions[authorIndex] = originalAuthor;
    }
  });

  it('orchestrates full amendment creation with and without optional collaborators and paths', async () => {
    const createSpy = vi.spyOn(amendmentServerMutators.create, 'fn').mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(amendmentServerMutators.update, 'fn').mockResolvedValue(undefined);
    const pathSpy = vi
      .spyOn(amendmentServerMutators.initializeProcessPath, 'fn')
      .mockResolvedValue(undefined);
    try {
      for (const includeOptional of [false, true]) {
        await amendmentServerMutators.createFull.fn({
          tx: createTx() as never,
          ctx: createCtx(),
          args: {
            amendment: createAmendmentArgs({ id: `full-${includeOptional}` }),
            document: { id: `document-${includeOptional}` },
            document_collaborator: includeOptional ? { id: 'document-collaborator' } : undefined,
            hashtags: [],
            process_path: includeOptional ? initializeProcessPathArgs() : undefined,
          } as never,
        });
      }
      expect(documentAddCollaboratorMock).toHaveBeenCalledOnce();
      expect(pathSpy).toHaveBeenCalledOnce();
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenCalledTimes(2);
    } finally {
      createSpy.mockRestore();
      updateSpy.mockRestore();
      pathSpy.mockRestore();
    }
  });

  it('updates amendments across missing rows, voting settings, profile fields, and targets', async () => {
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await amendmentServerMutators.update.fn({
      tx: missing as never,
      ctx: createCtx(),
      args: { id: 'missing' },
    });

    const base = {
      id: 'amendment-1',
      title: null,
      reason: null,
      category: null,
      preamble: null,
      visibility: 'public',
      tags: null,
      code: null,
      image_url: null,
      video_url: null,
      x: null,
      youtube: null,
      linkedin: null,
      website: null,
      group_id: 'group-1',
      event_id: 'event-1',
      current_process_run_id: null,
    };
    const profileFields = [
      'title',
      'reason',
      'category',
      'preamble',
      'visibility',
      'tags',
      'code',
      'image_url',
      'video_url',
      'x',
      'youtube',
      'linkedin',
      'website',
    ] as const;

    const equal = createTx();
    equal.run.mockResolvedValueOnce(base);
    await amendmentServerMutators.update.fn({
      tx: equal as never,
      ctx: createCtx(),
      args: Object.fromEntries([
        ['id', 'amendment-1'],
        ...profileFields.map(field => [field, base[field]]),
      ]) as never,
    });

    for (const [index, field] of profileFields.entries()) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ ...base, title: 'Existing' });
      const args: Record<string, unknown> = { id: 'amendment-1' };
      for (const preceding of profileFields.slice(0, index)) {
        args[preceding] = preceding === 'title' ? 'Existing' : base[preceding];
      }
      args[field] = field === 'visibility' ? 'private' : `changed-${field}`;
      await amendmentServerMutators.update.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: args as never,
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyAmendmentProfileUpdated',
        expect.anything()
      );
    }

    const voting = createTx();
    voting.run
      .mockResolvedValueOnce({ ...base, current_process_run_id: 'run-1' })
      .mockResolvedValueOnce([]);
    await amendmentServerMutators.update.fn({
      tx: voting as never,
      ctx: createCtx(),
      args: { id: 'amendment-1', internal_cr_voting_duration_minutes: 10 },
    });

    const triggerOnly = createTx();
    triggerOnly.run.mockResolvedValueOnce(base);
    await amendmentServerMutators.update.fn({
      tx: triggerOnly as never,
      ctx: createCtx(),
      args: { id: 'amendment-1', internal_cr_voting_close_trigger: 'after_minutes' },
    });

    for (const args of [
      { id: 'amendment-1', group_id: 'group-2' },
      { id: 'amendment-1', event_id: 'event-2' },
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ ...base, title: 'Targeted' });
      if (args.event_id) {
        tx.run.mockResolvedValueOnce({ id: args.event_id, amendment_deadline: null });
      }
      await amendmentServerMutators.update.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: args as never,
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyAmendmentTargetSet',
        expect.anything()
      );
    }
  });

  it('recomputes every optional relationship after deletion and tolerates a missing row', async () => {
    const complete = createTx();
    complete.run.mockResolvedValueOnce({
      created_by_id: 'user-2',
      group_id: 'group-1',
      event_id: 'event-1',
      clone_source_id: 'source-1',
    });
    await amendmentServerMutators.delete.fn({
      tx: complete as never,
      ctx: createCtx(),
      args: { id: 'amendment-1' },
    });

    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await amendmentServerMutators.delete.fn({
      tx: missing as never,
      ctx: createCtx(),
      args: { id: 'amendment-2' },
    });
  });

  it('covers collaborator removal notifications for every actor and status combination', async () => {
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      amendmentServerMutators.removeCollaborator.fn({
        tx: missing as never,
        ctx: createCtx(),
        args: { id: 'missing' },
      })
    ).rejects.toThrow('Amendment collaborator not found');

    const cases = [
      {
        user_id: 'user-1',
        status: 'requested',
        notification: 'notifyCollaborationRequestWithdrawn',
      },
      {
        user_id: 'user-1',
        status: 'invited',
        notification: 'notifyCollaborationInvitationDeclined',
      },
      { user_id: 'user-1', status: 'member', notification: 'notifyCollaborationWithdrawn' },
      { user_id: 'user-2', status: 'requested', notification: 'notifyCollaborationRejected' },
      { user_id: 'user-2', status: 'member', notification: 'notifyCollaborationRemoved' },
    ];
    for (const [index, testCase] of cases.entries()) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({
        id: `collaborator-${index}`,
        amendment_id: 'amendment-1',
        ...testCase,
      });
      await amendmentServerMutators.removeCollaborator.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `collaborator-${index}` },
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        testCase.notification,
        expect.objectContaining({ amendmentId: 'amendment-1' })
      );
    }
  });

  it('covers collaborator self-update gating, acceptance notifications, and role changes', async () => {
    const base = {
      id: 'collaborator-1',
      amendment_id: 'amendment-1',
      user_id: 'user-1',
      status: 'invited',
      role_id: 'role-old',
    };
    const gateCases = [
      { old: { ...base, user_id: 'user-2' }, args: { status: 'member' } },
      { old: base, args: { visibility: 'private' } },
      { old: base, args: { status: 'member', role_id: 'role-new' } },
      { old: base, args: { status: 'member', visibility: 'private' } },
      { old: base, args: { status: 'member' } },
    ];
    for (const [index, testCase] of gateCases.entries()) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ ...testCase.old, id: `collaborator-gate-${index}` });
      await amendmentServerMutators.updateCollaborator.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `collaborator-gate-${index}`, ...testCase.args } as never,
      });
    }

    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyCollaborationInvitationAccepted',
      expect.anything()
    );
    expect(fireNotificationMock).toHaveBeenCalledWith(
      'notifyCollaborationApproved',
      expect.anything()
    );

    const roleChanged = createTx();
    roleChanged.run
      .mockResolvedValueOnce({ ...base, user_id: 'user-2', status: null })
      .mockResolvedValueOnce({ name: 'Viewer', action_rights: [] })
      .mockResolvedValueOnce({ name: 'Editor', action_rights: [] });
    await amendmentServerMutators.updateCollaborator.fn({
      tx: roleChanged as never,
      ctx: createCtx(),
      args: { id: 'collaborator-1', role_id: 'role-new' } as never,
    });

    const sameRole = createTx();
    sameRole.run.mockResolvedValueOnce(base);
    await amendmentServerMutators.updateCollaborator.fn({
      tx: sameRole as never,
      ctx: createCtx(),
      args: { id: 'collaborator-1', role_id: 'role-old' } as never,
    });
  });

  it('handles empty collaborator amendment ids and non-invite statuses without notifications', async () => {
    const empty = createTx();
    await amendmentServerMutators.addCollaborator.fn({
      tx: empty as never,
      ctx: createCtx(),
      args: addCollaboratorArgs({ amendment_id: '' }),
    });

    const inactive = createTx();
    await amendmentServerMutators.addCollaborator.fn({
      tx: inactive as never,
      ctx: createCtx(),
      args: addCollaboratorArgs({ status: 'member' }),
    });
  });

  it('authorizes city-design mutations in direct and branch edit scopes', async () => {
    const direct = createTx();
    direct.run.mockResolvedValueOnce({ id: 'amendment-1', document_id: null });
    await amendmentServerMutators.createCityDesign.fn({
      tx: direct as never,
      ctx: createCtx(),
      args: { id: 'design-1', amendment_id: 'amendment-1' } as never,
    });

    const branch = createTx();
    branch.run
      .mockResolvedValueOnce({ id: 'amendment-1' })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'active',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });
    await amendmentServerMutators.createCityDesign.fn({
      tx: branch as never,
      ctx: createCtx(),
      args: { id: 'design-2', amendment_id: 'amendment-1', process_branch_id: 'branch-1' } as never,
    });

    const update = createTx();
    update.run
      .mockResolvedValueOnce({ id: 'design-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce({ id: 'amendment-1', document_id: null });
    await amendmentServerMutators.updateCityDesign.fn({
      tx: update as never,
      ctx: createCtx(),
      args: { id: 'design-1' } as never,
    });

    const remove = createTx();
    remove.run.mockResolvedValueOnce({ id: 'design-1', amendment_id: 'amendment-1' });
    await amendmentServerMutators.deleteCityDesign.fn({
      tx: remove as never,
      ctx: createCtx(),
      args: { id: 'design-1' },
    });
  });

  it('rejects legacy city scenes and short-circuits duplicate direct change requests', async () => {
    await expect(
      amendmentServerMutators.createChangeRequest.fn({
        tx: createTx() as never,
        ctx: createCtx(),
        args: createChangeRequestArgs({ source_type: ' CITY_DESIGN_SCENE ' }),
      })
    ).rejects.toThrow('no longer supported');

    createChangeRequestMock.mockResolvedValueOnce(false);
    const city = createTx();
    city.run.mockResolvedValueOnce({ id: 'amendment-1', document_id: null });
    await amendmentServerMutators.createChangeRequest.fn({
      tx: city as never,
      ctx: createCtx(),
      args: createChangeRequestArgs({
        process_branch_id: undefined,
        source_type: 'city_design_object',
      }),
    });
    expect(
      documentIntegrityMocks.assertPersistedDocumentChangeRequestIntegrity
    ).not.toHaveBeenCalled();

    createChangeRequestMock.mockResolvedValueOnce(false);
    const document = createTx();
    document.run.mockResolvedValueOnce({ id: 'amendment-1', document_id: null });
    await amendmentServerMutators.createChangeRequest.fn({
      tx: document as never,
      ctx: createCtx(),
      args: createChangeRequestArgs({ process_branch_id: undefined, source_type: null }),
    });
    expect(
      documentIntegrityMocks.assertPersistedDocumentChangeRequestIntegrity
    ).toHaveBeenCalledWith(expect.objectContaining({ processBranchId: null }));
  });

  it('short-circuits or completes document change-request creation after integrity checks', async () => {
    for (const wasCreated of [false, undefined]) {
      createDocumentChangeRequestMock.mockResolvedValueOnce(wasCreated);
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'amendment-1', document_id: null });
      if (wasCreated !== false) {
        tx.run.mockResolvedValueOnce(null);
      }
      await amendmentServerMutators.createDocumentChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          ...createChangeRequestArgs({ process_branch_id: undefined }),
          discussion_id: 'suggestion-1',
          document_content: [],
          discussions: [],
        } as never,
      });
    }
    expect(documentIntegrityMocks.assertDocumentSuggestionIntegrity).toHaveBeenCalledTimes(2);
  });

  it('validates empty City Design source types and both batch scope dimensions', async () => {
    const baseRequest = createChangeRequestArgs({
      source_type: 'city_design_object',
      amendment_id: 'amendment-1',
      process_branch_id: 'branch-1',
    });
    for (const request of [
      { ...baseRequest, source_type: undefined },
      { ...baseRequest, amendment_id: 'other-amendment' },
      { ...baseRequest, process_branch_id: undefined },
    ]) {
      await expect(
        amendmentServerMutators.createCityDesignChangeRequests.fn({
          tx: createTx() as never,
          ctx: createCtx(),
          args: {
            amendment_id: 'amendment-1',
            process_branch_id: 'branch-1',
            requests: [request],
          } as never,
        })
      ).rejects.toThrow();
    }
  });

  it('rejects voting after finalization and notifies other authors for explicit and cleared votes', async () => {
    const makeChangeRequest = (userId: string) => ({
      id: 'change-request-1',
      amendment_id: 'amendment-1',
      process_branch_id: 'branch-1',
      user_id: userId,
      status: 'open',
      voting_status: 'open',
    });

    const completed = createTx();
    completed.run
      .mockResolvedValueOnce(makeChangeRequest('user-2'))
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'vote_internal' })
      .mockResolvedValueOnce({ ...makeChangeRequest('user-2'), status: 'approved' });
    await expect(
      amendmentServerMutators.voteOnChangeRequest.fn({
        tx: completed as never,
        ctx: createCtx(),
        args: { id: 'vote-1', change_request_id: 'change-request-1', vote: 'accept' },
      })
    ).rejects.toThrow('already completed');

    for (const vote of ['reject', null] as const) {
      const tx = createTx();
      const changeRequest = makeChangeRequest('user-2');
      tx.run
        .mockResolvedValueOnce(changeRequest)
        .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'vote_internal' })
        .mockResolvedValueOnce(changeRequest);
      await amendmentServerMutators.voteOnChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `vote-${vote ?? 'cleared'}`, change_request_id: 'change-request-1', vote },
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyChangeRequestVoteCast',
        expect.objectContaining({ voteType: vote ?? 'vote' })
      );
    }
  });

  it('guards internal vote finalization modes and recomputes event counters on success', async () => {
    const changeRequest = {
      id: 'change-request-1',
      amendment_id: 'amendment-1',
      process_branch_id: 'branch-1',
      status: 'open',
      voting_status: 'in_progress',
    };
    const wrongMode = createTx();
    wrongMode.run
      .mockResolvedValueOnce(changeRequest)
      .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'edit' });
    await expect(
      amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
        tx: wrongMode as never,
        ctx: createCtx(),
        args: { change_request_id: 'change-request-1' },
      })
    ).rejects.toThrow(PermissionError);

    const completed = createTx();
    completed.run
      .mockResolvedValueOnce({ ...changeRequest, voting_status: 'completed' })
      .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'vote_internal' });
    await expect(
      amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
        tx: completed as never,
        ctx: createCtx(),
        args: { change_request_id: 'change-request-1' },
      })
    ).rejects.toThrow('already completed');

    const event = createTx();
    event.run
      .mockResolvedValueOnce(changeRequest)
      .mockResolvedValueOnce({ id: 'amendment-1', event_id: 'event-1' })
      .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'vote_internal' });
    await amendmentServerMutators.finalizeInternalChangeRequestVote.fn({
      tx: event as never,
      ctx: createCtx(),
      args: { change_request_id: 'change-request-1' },
    });
    expect(internalVotingMocks.resolveInternalChangeRequestVote).toHaveBeenCalledOnce();
  });

  it('finalizes and repairs internal votes with scoped and unscoped event counters', async () => {
    for (const [processBranchId, amendment] of [
      ['branch-1', { id: 'amendment-1', event_id: 'event-1' }],
      [undefined, null],
    ] as const) {
      const tx = createTx();
      tx.run
        .mockResolvedValueOnce({
          id: 'amendment-1',
          visibility: 'public',
          created_by_id: 'user-2',
        })
        .mockResolvedValueOnce(amendment);
      await amendmentServerMutators.finalizeExpiredInternalChangeRequestVotes.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { amendment_id: 'amendment-1', process_branch_id: processBranchId },
      });
    }

    for (const amendment of [{ id: 'amendment-1', event_id: 'event-1' }, null]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(amendment);
      await amendmentServerMutators.repairInternalChangeRequestResolution.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { amendment_id: 'amendment-1' },
      });
    }
  });

  it('creates support confirmations with absent and present event context', async () => {
    await amendmentServerMutators.createSupportConfirmation.fn({
      tx: createTx() as never,
      ctx: createCtx(),
      args: { id: 'confirmation-none', amendment_id: 'amendment-1', group_id: null } as never,
    });

    for (const eventId of [undefined, 'event-1']) {
      await amendmentServerMutators.createSupportConfirmation.fn({
        tx: createTx() as never,
        ctx: createCtx(),
        args: {
          id: `confirmation-${eventId ?? 'group'}`,
          amendment_id: 'amendment-1',
          group_id: 'group-1',
          event_id: eventId,
        } as never,
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifySupportConfirmationRequired',
        expect.objectContaining({ eventId })
      );
    }
  });

  it('covers support-confirmation early returns, no-event confirmation, and decline', async () => {
    const earlyCases = [
      { previous: null, args: { status: 'confirmed' } },
      { previous: { amendment_id: 'amendment-1', group_id: null }, args: { status: 'confirmed' } },
      {
        previous: { amendment_id: 'amendment-1', group_id: 'group-1', status: 'pending' },
        args: { status: undefined },
      },
      {
        previous: { amendment_id: 'amendment-1', group_id: 'group-1', status: 'pending' },
        args: { status: 'pending' },
      },
    ];
    for (const [index, testCase] of earlyCases.entries()) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(testCase.previous);
      await amendmentServerMutators.updateSupportConfirmation.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `confirmation-${index}`, ...testCase.args } as never,
      });
    }

    for (const status of ['confirmed', 'declined'] as const) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({
        id: 'confirmation-1',
        amendment_id: 'amendment-1',
        group_id: 'group-1',
        event_id: null,
        status: 'pending',
      });
      await amendmentServerMutators.updateSupportConfirmation.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'confirmation-1', status },
      });
    }
    expect(fireNotificationMock).toHaveBeenCalledWith('notifySupportDeclined', expect.anything());
  });

  it('blocks protected final resolutions in every automatic voting mode', async () => {
    for (const mode of ['suggest_event', 'vote_internal', 'event_final_closing_vote']) {
      const tx = createEventChangeRequestTx();
      tx.run
        .mockResolvedValueOnce({
          id: 'cr-1',
          amendment_id: 'amendment-1',
          process_branch_id: 'branch-1',
          user_id: 'user-2',
          status: 'open',
        })
        .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
        .mockResolvedValueOnce({ id: 'branch-1', editing_mode: mode });
      await expect(
        amendmentServerMutators.updateChangeRequest.fn({
          tx: tx as never,
          ctx: createCtx(),
          args: { id: 'cr-1', status: 'approved' },
        })
      ).rejects.toThrow(PermissionError);
    }
  });

  it('resolves and notifies accepted and rejected direct change requests', async () => {
    for (const status of ['approved', 'rejected'] as const) {
      const tx = createEventChangeRequestTx();
      tx.run
        .mockResolvedValueOnce({
          id: `cr-${status}`,
          amendment_id: 'amendment-1',
          process_branch_id: 'branch-1',
          user_id: 'user-2',
          title: 'CR',
          status: 'open',
        })
        .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
        .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'edit' });
      await amendmentServerMutators.updateChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `cr-${status}`, status },
      });
      expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: `cr-${status}`, resolution_method: 'direct_internal' })
      );
      expect(fireNotificationMock).toHaveBeenCalledWith(
        status === 'approved' ? 'notifyChangeRequestAccepted' : 'notifyChangeRequestRejected',
        expect.anything()
      );
    }
  });

  it('submits own and managed pending requests with amendment-event and null fallbacks', async () => {
    const cases = [
      { userId: 'user-1', eventId: 'event-1', votes_for: undefined },
      { userId: 'user-2', eventId: null, votes_for: 1 },
    ];
    for (const [index, testCase] of cases.entries()) {
      const tx = createEventChangeRequestTx();
      tx.run
        .mockResolvedValueOnce({
          id: `cr-pending-${index}`,
          amendment_id: 'amendment-1',
          process_branch_id: null,
          user_id: testCase.userId,
          title: 'Pending CR',
          status: 'pending_submission',
        })
        .mockResolvedValueOnce({
          id: 'amendment-1',
          document_id: null,
          event_id: testCase.eventId,
        });
      await amendmentServerMutators.updateChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: `cr-pending-${index}`,
          status: 'open',
          ...(testCase.votes_for === undefined ? {} : { votes_for: testCase.votes_for }),
        },
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyChangeRequestCreated',
        expect.anything()
      );
    }
  });

  it('skips submission and resolution notifications for unchanged or self-owned terminal states', async () => {
    const cases = [
      { previousStatus: 'open', nextStatus: undefined, userId: 'user-1' },
      { previousStatus: 'approved', nextStatus: 'approved', userId: 'user-2' },
      { previousStatus: 'open', nextStatus: 'approved', userId: 'user-1' },
      { previousStatus: 'rejected', nextStatus: 'rejected', userId: 'user-2' },
      { previousStatus: 'open', nextStatus: 'rejected', userId: 'user-1' },
    ];
    for (const [index, testCase] of cases.entries()) {
      const tx = createEventChangeRequestTx();
      tx.run
        .mockResolvedValueOnce({
          id: `cr-skip-${index}`,
          amendment_id: 'amendment-1',
          process_branch_id: 'branch-1',
          user_id: testCase.userId,
          title: 'CR',
          status: testCase.previousStatus,
        })
        .mockResolvedValueOnce({ id: 'amendment-1', event_id: null })
        .mockResolvedValueOnce({ id: 'branch-1', editing_mode: 'edit' });
      await amendmentServerMutators.updateChangeRequest.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: `cr-skip-${index}`,
          ...(testCase.nextStatus === undefined
            ? { description: 'updated' }
            : { status: testCase.nextStatus }),
        } as never,
      });
    }
  });

  it('requires management for deleting another author submission and tolerates no event', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'cr-1',
        amendment_id: 'amendment-1',
        user_id: 'user-2',
        status: 'pending_submission',
      })
      .mockResolvedValueOnce({ id: 'amendment-1', event_id: null });
    await amendmentServerMutators.deleteChangeRequest.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { id: 'cr-1' },
    });
    expect(canMock).toHaveBeenCalledWith(
      tx,
      createCtx(),
      expect.objectContaining({ action: 'manage' })
    );
  });

  it('updates process branches without a mode change and initializes internal voting on entry', async () => {
    const unchanged = createProcessBranchUpdateTx();
    unchanged.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'active',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });
    await amendmentServerMutators.updateProcessBranch.fn({
      tx: unchanged as never,
      ctx: createCtx(),
      args: { id: 'branch-1', title: 'Renamed' },
    });

    const voting = createProcessBranchUpdateTx();
    voting.run
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        editing_mode: 'edit',
        status: 'active',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'amendment-1' });
    await amendmentServerMutators.updateProcessBranch.fn({
      tx: voting as never,
      ctx: createCtx(),
      args: { id: 'branch-1', editing_mode: 'vote_internal' },
    });
    expect(
      internalVotingMocks.initializeInternalChangeRequestVotingForAmendment
    ).toHaveBeenCalledOnce();
  });

  it('persists both minimal and extended event-mode transitions when the workflow authorizes them', async () => {
    const policySpy = vi
      .spyOn(editingModePolicy, 'canManuallySelectEditingMode')
      .mockReturnValue(true);
    const transitionSpy = vi
      .spyOn(eventModeTransition, 'transitionProcessBranchToEventMode')
      .mockResolvedValue({ changed: true, finalizedInternalChangeRequests: false });
    try {
      for (const [index, extra] of [{}, { title: 'Event branch' }].entries()) {
        const tx = createProcessBranchUpdateTx();
        tx.run
          .mockResolvedValueOnce({
            id: `branch-${index}`,
            process_run_id: 'run-1',
            editing_mode: 'edit',
            status: 'active',
          })
          .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
          .mockResolvedValueOnce([]);
        await amendmentServerMutators.updateProcessBranch.fn({
          tx: tx as never,
          ctx: createCtx(),
          args: { id: `branch-${index}`, editing_mode: 'suggest_event', ...extra },
        });
        if (index === 0) {
          expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
        } else {
          expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: `branch-${index}`, title: 'Event branch' })
          );
        }
      }
      expect(transitionSpy).toHaveBeenCalledTimes(2);
    } finally {
      policySpy.mockRestore();
      transitionSpy.mockRestore();
    }
  });

  it('materializes handled process results and covers branchless resolutions', async () => {
    for (const resolution of [
      { handled: false },
      { handled: true },
      { handled: true, branchId: 'branch-1' },
    ]) {
      processEngineMocks.resolveAmendmentProcessVote.mockResolvedValueOnce(resolution);
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'agenda-1', event_id: 'event-1' });
      await amendmentServerMutators.resolveProcessVote.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { agenda_item_id: 'agenda-1' } as never,
      });
    }

    for (const handled of [false, true]) {
      processEngineMocks.completeProcessTaskWithEvent.mockResolvedValueOnce({
        handled,
        branchId: 'branch-1',
      });
      const tx = createTx();
      tx.run
        .mockResolvedValueOnce({ id: 'task-1', process_run_id: 'run-1', event_id: null })
        .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
        .mockResolvedValueOnce({ id: 'event-1', amendment_deadline: null });
      await amendmentServerMutators.completeProcessTaskWithEvent.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { process_task_id: 'task-1', event_id: 'event-1', description: null },
      });
    }

    processEngineMocks.replanProcessBranchEvents.mockResolvedValueOnce({
      handled: true,
      branchId: 'branch-1',
    });
    const replan = createTx();
    replan.run
      .mockResolvedValueOnce({ id: 'branch-1', process_run_id: 'run-1' })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });
    await amendmentServerMutators.replanProcessBranchEvents.fn({
      tx: replan as never,
      ctx: createCtx(),
      args: { branch_id: 'branch-1', event_updates: [] },
    });
  });

  it('uses fallback amendment titles and both support-vote directions', async () => {
    for (const vote of [undefined, -1]) {
      const tx = createTx();
      tx.run
        .mockResolvedValueOnce({
          id: 'amendment-1',
          title: null,
          visibility: 'public',
          created_by_id: 'user-2',
        })
        .mockResolvedValueOnce({ user_id: 'user-1' });
      await amendmentServerMutators.supportAmendment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: `support-${vote ?? 'default'}`, amendment_id: 'amendment-1', vote } as never,
      });
      expect(fireNotificationMock).toHaveBeenCalledWith(
        'notifyAmendmentVoted',
        expect.objectContaining({
          amendmentTitle: 'Amendment',
          voteType: vote === -1 ? 'downvote' : 'upvote',
        })
      );
    }
  });
});
