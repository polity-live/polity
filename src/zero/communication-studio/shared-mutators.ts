import { defineMutator } from '@rocicorp/zero';
import { studioOperationSchema } from '@/features/communication-studio/logic/operations';
// The editor owns its recoverable optimistic draft. Only a server-confirmed
// operation becomes canonical; conflicts are returned as durable receipts.
export const studioSharedMutators = {
  apply: defineMutator(studioOperationSchema, async ({ ctx }) => {
    if (!ctx.userID || ctx.userID === 'anon') throw new Error('Authentication required');
  }),
};
