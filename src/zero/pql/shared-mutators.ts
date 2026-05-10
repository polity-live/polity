import { defineMutator } from '@rocicorp/zero';
import { createPqlFilterSchema, deletePqlFilterSchema, updatePqlFilterSchema } from './schema';

export const pqlSharedMutators = {
  create: defineMutator(createPqlFilterSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();

    await tx.mutate.pql_filter.insert({
      ...args,
      user_id: userID,
      group_id: args.group_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  update: defineMutator(updatePqlFilterSchema, async ({ tx, args }) => {
    const { id, ...fields } = args;

    await tx.mutate.pql_filter.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  delete: defineMutator(deletePqlFilterSchema, async ({ tx, args }) => {
    await tx.mutate.pql_filter.delete({ id: args.id });
  }),
};
