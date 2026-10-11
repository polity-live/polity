import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  call: vi.fn(),
  receipt: vi.fn(),
  apply: vi.fn(),
  presentation: vi.fn(),
}));
vi.mock('@/server/studio/command-receipts', () => ({ studioCommandResult: io.receipt }));
vi.mock('@/server/studio/operations', () => ({ applyStudioOperation: io.apply }));
vi.mock('@/server/studio/presentation', () => ({ applyPresentationCommand: io.presentation }));
vi.mock('@/server/studio/service', () =>
  Object.fromEntries(
    ['createProjectFromSelection', 'duplicateProject', 'beginUpload', 'finishUpload'].map(name => [
      name,
      (...args: unknown[]) => io.call(name, ...args),
    ])
  )
);
vi.mock('@/server/studio/collaborators', () =>
  Object.fromEntries(
    ['inviteStudioCollaborators', 'respondStudioInvitation', 'removeStudioCollaborator'].map(
      name => [name, (...args: unknown[]) => io.call(name, ...args)]
    )
  )
);
vi.mock('@/server/studio/elements', () =>
  Object.fromEntries(
    [
      'createElementSet',
      'instantiateElementSetForProject',
      'renameElementSet',
      'archiveElementSet',
      'publishElementSetRevision',
      'synchronizeProjectElementInstances',
    ].map(name => [name, (...args: unknown[]) => io.call(name, ...args)])
  )
);
vi.mock('@/server/studio/project-commands', () =>
  Object.fromEntries(
    [
      'setProjectVisibility',
      'setProjectTemplate',
      'deleteStudioProject',
      'cancelStudioExport',
      'claimEditorActions',
      'completeEditorAction',
    ].map(name => [name, (...args: unknown[]) => io.call(name, ...args)])
  )
);
vi.mock('@/server/studio/export', () => ({
  queueCommittedExport: (...args: unknown[]) => io.call('queueCommittedExport', ...args),
}));
vi.mock('@/server/studio/governance', () => ({
  canvasCommand: (...args: unknown[]) => io.call('canvasCommand', ...args),
}));
import { studioServerMutators } from '../server-mutators';
import { studioSharedMutators } from '../shared-mutators';
import { studioCommandSchemas, canvasCommandSchema } from '../commands';
import { presentationCommandSchema } from '../presentation-schema';
import { encodeAppError } from '@/features/shared/errors/app-error';
const id = crypto.randomUUID();
const input = {
  id,
  operationId: id,
  projectId: id,
  destinationId: id,
  groupId: null,
  visibility: 'private',
  title: 'Project',
  kind: 'single',
  themeId: id,
  themeMode: 'light',
  template: { kind: 'builtin', id: 'blank' },
  userIds: [id],
  invitationId: id,
  accept: true,
  userId: id,
  workspaceId: id,
  name: 'Media',
  mime: 'image/png',
  size: 1,
  format: 'png',
  pageIds: [id],
  revision: 0,
  selectedIds: [id],
  setId: id,
  instanceId: id,
  clientId: id,
  value: true,
  result: { status: 'completed' },
};
beforeEach(() => {
  vi.clearAllMocks();
  io.call.mockResolvedValue({ ok: true });
  io.presentation.mockReset().mockResolvedValue(undefined);
  io.receipt.mockImplementation(async (_tx, _actor, _command, _input, body) => body());
});
it('keeps presentation device registration optimistic without writing canonical state, including anonymous viewers', async () => {
  const tx = { mutate: vi.fn(), query: vi.fn() };
  const args = presentationCommandSchema.parse({
    operationId: id,
    eventId: id,
    deviceId: id,
    action: 'device',
    name: ' Audience screen ',
  });
  expect(args).toMatchObject({ name: 'Audience screen', takeover: false });
  for (const userID of ['actor', '', 'anon']) {
    await studioSharedMutators.presentation.fn({
      tx: tx as never,
      ctx: { userID, email: '' },
      args,
    });
  }
  expect(tx.mutate).not.toHaveBeenCalled();
  expect(tx.query).not.toHaveBeenCalled();
  expect(io.presentation).not.toHaveBeenCalled();
  expect(io.receipt).not.toHaveBeenCalled();
  expect(presentationCommandSchema.safeParse({ ...args, deviceId: 'invalid' }).success).toBe(false);
});
it('awaits the authoritative presentation command with its transaction, identity, revision, and operation receipt ID', async () => {
  const tx = { location: 'server' };
  const args = presentationCommandSchema.parse({
    operationId: id,
    eventId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    action: 'control',
    expectedRevision: 3,
    mode: 'studio',
    frameId: crypto.randomUUID(),
    followAgenda: false,
    resultsVisible: true,
    running: true,
    audioDeviceId: null,
    audio: { builtin: 'test-tone', status: 'playing', position: 0, volume: 0.5 },
  });
  let confirm!: () => void;
  io.presentation.mockReturnValueOnce(
    new Promise<void>(resolve => {
      confirm = resolve;
    })
  );
  const mutation = studioServerMutators.presentation.fn({
    tx: tx as never,
    ctx: { userID: 'manager', email: '' },
    args,
  });
  const completed = vi.fn();
  void mutation.then(completed);
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  expect(io.presentation).toHaveBeenCalledExactlyOnceWith(tx, 'manager', args);
  // The presentation service owns event-specific replay receipts and authorization.
  expect(io.receipt).not.toHaveBeenCalled();
  confirm();
  await expect(mutation).resolves.toBeUndefined();
  expect(completed).toHaveBeenCalledOnce();
});
it.each([
  ['', encodeAppError('permission_denied')],
  ['anon', encodeAppError('permission_denied')],
  ['viewer', encodeAppError('permission_denied')],
  ['manager', 'Operation ID reused'],
  ['manager', 'Presentation unavailable'],
])('propagates the authoritative presentation rejection for %s: %s', async (userID, message) => {
  const tx = { location: 'server' };
  const args = presentationCommandSchema.parse({
    operationId: id,
    eventId: id,
    deviceId: id,
    action: 'claim',
    takeover: true,
  });
  const rejection = new Error(message);
  io.presentation.mockRejectedValueOnce(rejection);
  await expect(
    studioServerMutators.presentation.fn({
      tx: tx as never,
      ctx: { userID, email: '' },
      args,
    })
  ).rejects.toBe(rejection);
  expect(io.presentation).toHaveBeenCalledExactlyOnceWith(tx, userID, args);
  expect(io.receipt).not.toHaveBeenCalled();
  expect(io.call).not.toHaveBeenCalled();
});
it('routes every typed command to its domain service and receipt in the supplied transaction', async () => {
  const tx = { location: 'server' };
  for (const [name, schema] of Object.entries(studioCommandSchemas)) {
    const args = schema.parse(input);
    await (studioServerMutators as any)[name].fn({ tx, ctx: { userID: 'actor' }, args });
    expect(io.receipt).toHaveBeenLastCalledWith(tx, 'actor', name, args, expect.any(Function));
    expect(io.call.mock.lastCall?.[1]).toBe('actor');
    expect(schema.safeParse({ ...input, operationId: 'invalid' }).success).toBe(false);
    for (const actor of ['', 'anon'])
      await expect(
        (studioSharedMutators as any)[name].fn({
          tx: { location: 'client' },
          ctx: { userID: actor },
          args,
        })
      ).rejects.toThrow(encodeAppError('permission_denied'));
    await (studioSharedMutators as any)[name].fn({
      tx: { location: 'client' },
      ctx: { userID: 'actor' },
      args,
    });
  }
  expect(
    io.call.mock.calls.find(
      ([name, _actor, _id, cancel]) => name === 'finishUpload' && cancel === true
    )
  ).toBeTruthy();
  expect(io.call.mock.calls.find(([name]) => name === 'duplicateProject')?.at(-1)).toBe(id);
});
it('requires action-specific canvas inputs and keeps every client write free of canonical changes', async () => {
  const common = {
    projectId: id,
    operationId: id,
    generation: id,
    revision: 1,
    workspaceId: id,
    title: 'Draft',
    reason: '',
    changes: [],
    phase: 'edit',
    userIds: [],
    choice: 'accept',
    minutes: 5,
    groupId: id,
    body: 'Comment',
    elementId: null,
    commentId: id,
    historyId: id,
    library: [],
    roleId: id,
    capability: 'vote',
    allowed: false,
  };
  for (const action of [
    'phase',
    'createDraft',
    'resolveDraft',
    'saveDraft',
    'share',
    'submit',
    'withdraw',
    'startVote',
    'vote',
    'finalize',
    'reapply',
    'acceptPrivate',
    'rejectPrivate',
    'adopt',
    'comment',
    'editComment',
    'resolveComment',
    'restore',
    'saveLibrary',
    'setCapability',
  ]) {
    const args = canvasCommandSchema.parse({ ...common, action });
    await studioServerMutators.canvas.command.fn({
      tx: {} as never,
      ctx: { userID: 'actor', email: '' },
      args,
    });
    expect(io.call).toHaveBeenLastCalledWith('canvasCommand', 'actor', args);
    await studioSharedMutators.canvas.command.fn({
      tx: {} as never,
      ctx: { userID: 'actor', email: '' },
      args,
    });
    expect(canvasCommandSchema.safeParse({ ...common, action, generation: 'bad' }).success).toBe(
      false
    );
  }
  expect(canvasCommandSchema.safeParse({ ...common, action: 'session' }).success).toBe(false);
  for (const userID of ['', 'anon'])
    await expect(
      studioSharedMutators.canvas.command.fn({
        tx: {} as never,
        ctx: { userID, email: '' },
        args: common as never,
      })
    ).rejects.toThrow();
});
it('retains document apply server confirmation and authentication', async () => {
  const args = { projectId: id, operationId: id, generation: id, expectedRevision: 0, changes: [] };
  for (const registry of [studioSharedMutators, studioServerMutators]) {
    for (const userID of ['', 'anon'])
      await expect(
        registry.apply.fn({ tx: {} as never, ctx: { userID, email: '' }, args })
      ).rejects.toThrow('Authentication required');
    await registry.apply.fn({ tx: {} as never, ctx: { userID: 'actor', email: '' }, args });
  }
  expect(io.apply).toHaveBeenCalledExactlyOnceWith({}, 'actor', args);
});
