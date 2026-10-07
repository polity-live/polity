import { beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ call: vi.fn(), receipt: vi.fn(), apply: vi.fn() }));
vi.mock('@/server/studio/command-receipts', () => ({ studioCommandResult: io.receipt }));
vi.mock('@/server/studio/operations', () => ({ applyStudioOperation: io.apply }));
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
  io.receipt.mockImplementation(async (_tx, _actor, _command, _input, body) => body());
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
