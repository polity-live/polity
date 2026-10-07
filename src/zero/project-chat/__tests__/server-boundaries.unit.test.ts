import { beforeEach, expect, it, vi } from 'vitest';
import { ProjectToolError } from '@/features/project-chat/logic/contracts';
const io = vi.hoisted(() => ({ undo: vi.fn(), apply: vi.fn() }));
vi.mock('@rocicorp/zero', async original => ({
  ...(await original<typeof import('@rocicorp/zero')>()),
  defineMutator: (_schema: unknown, fn: unknown) => ({ fn }),
}));
vi.mock('@/server/project-chat/tools', () => ({ undoProjectChange: io.undo }));
vi.mock('@/server/studio/operations', () => ({ applyStudioOperation: io.apply }));
import { projectChatServerMutators } from '../server-mutators';
import { studioServerMutators } from '../../communication-studio/server-mutators';
import { studioSharedMutators } from '../../communication-studio/shared-mutators';
const actor = crypto.randomUUID();
const operation = {
  projectId: crypto.randomUUID(),
  operationId: crypto.randomUUID(),
  expectedRevision: 0,
  changes: [
    {
      path: ['title'],
      before: { exists: true, value: 'Before' },
      after: { exists: true, value: 'After' },
    },
  ],
};
const transaction = { location: 'server' };
const context = { userID: actor, email: '' };
const undoArgs = { changeSetId: crypto.randomUUID() };
const invoke = (
  mutator: { fn: unknown },
  userID: string = actor,
  args: unknown = operation,
  tx: unknown = transaction
) => (mutator.fn as any)({ tx, ctx: { ...context, userID }, args });
beforeEach(() => vi.resetAllMocks());

it.each(['', 'anon'])(
  'rejects unauthenticated %s Studio operations on both client and server boundaries',
  async userID => {
    await expect(invoke(studioSharedMutators.apply, userID)).rejects.toThrow(
      'Authentication required'
    );
    await expect(invoke(studioServerMutators.apply, userID)).rejects.toThrow(
      'Authentication required'
    );
    expect(io.apply).not.toHaveBeenCalled();
  }
);

it('keeps shared drafts optimistic and delegates canonical edits only to the server operation service', async () => {
  await invoke(studioSharedMutators.apply, actor, operation, { location: 'client' });
  expect(io.apply).not.toHaveBeenCalled();
  await invoke(studioServerMutators.apply);
  expect(io.apply).toHaveBeenCalledOnce();
  expect(io.apply).toHaveBeenCalledWith(transaction, actor, operation);
});

it('delegates undo using the authoritative transaction, current actor and selected change identity', async () => {
  await invoke(projectChatServerMutators.undo, actor, undoArgs);
  expect(io.undo).toHaveBeenCalledWith(transaction, actor, undoArgs.changeSetId);
});

it('maps an undo conflict to the stable application error code', async () => {
  io.undo.mockRejectedValueOnce(new ProjectToolError('undo_conflict'));
  await expect(invoke(projectChatServerMutators.undo, actor, undoArgs)).rejects.toMatchObject({
    payload: { code: 'project_undo_conflict' },
  });
});

it.each([new Error('Storage failure'), new ProjectToolError('permission_denied')])(
  'retains other undo failures without rewriting their identity (%s)',
  async error => {
    io.undo.mockRejectedValueOnce(error);
    await expect(invoke(projectChatServerMutators.undo, actor, undoArgs)).rejects.toBe(error);
  }
);
