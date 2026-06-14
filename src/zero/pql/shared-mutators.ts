import { defineMutator } from '@rocicorp/zero';
import { createPqlFilterSchema, deletePqlFilterSchema, updatePqlFilterSchema } from './schema';
import { can } from '../rbac/can';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { zql } from '../schema';

export const pqlSharedMutators = {
  create: defineMutator(createPqlFilterSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'pqlFilters' });
    if (args.group_id) {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
    }

    const now = Date.now();

    await tx.mutate.pql_filter.insert({
      ...args,
      user_id: userID,
      group_id: args.group_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  update: defineMutator(updatePqlFilterSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.pql_filter.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, { action: 'update', resource: 'pqlFilters' });
    }

    const { id, ...fields } = args;

    await tx.mutate.pql_filter.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  delete: defineMutator(deletePqlFilterSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.pql_filter.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, { action: 'delete', resource: 'pqlFilters' });
    }

    await tx.mutate.pql_filter.delete({ id: args.id });
  }),
};
