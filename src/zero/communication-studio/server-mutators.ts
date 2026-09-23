import { defineMutator } from '@rocicorp/zero';
import { studioOperationSchema } from '@/features/communication-studio/logic/operations';
import { applyStudioOperation } from '@/server/studio/operations';
export const studioServerMutators = {
  apply: defineMutator(studioOperationSchema, async ({ tx, ctx, args }) => {
    if (!ctx.userID || ctx.userID === 'anon') throw new Error('Authentication required');
    await applyStudioOperation(tx, ctx.userID, args);
  }),
};
