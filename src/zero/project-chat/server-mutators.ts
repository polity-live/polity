import { throwAppError } from '@/features/shared/errors/app-error';
import { ProjectToolError } from '@/features/project-chat/logic/contracts';
import { defineMutator } from '@rocicorp/zero';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { undoProjectChangeSchema } from './shared-mutators';

export const projectChatServerMutators = {
  undo: defineMutator(undoProjectChangeSchema, async ({ tx, ctx, args }) => {
    try {
      const { undoProjectChange } = await import('@/server/project-chat/tools');
      await undoProjectChange(tx as unknown as ZeroTransaction, ctx.userID, args.changeSetId);
    } catch (error) {
      if (error instanceof ProjectToolError && error.code === 'undo_conflict')
        throwAppError('project_undo_conflict');
      throw error;
    }
  }),
};
