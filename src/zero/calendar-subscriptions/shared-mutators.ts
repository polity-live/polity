import { defineMutator } from '@rocicorp/zero';
import {
  calendarSubscriptionCreateSchema,
  calendarSubscriptionUpdateSchema,
  calendarSubscriptionDeleteSchema,
} from './schema';
import { zql } from '../schema';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';

export const calendarSubscriptionSharedMutators = {
  subscribe: defineMutator(calendarSubscriptionCreateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'calendarSubscriptions' });
    const now = Date.now();
    await tx.mutate.calendar_subscription.insert({
      ...args,
      user_id: userID,
      created_at: now,
    });
  }),

  update: defineMutator(calendarSubscriptionUpdateSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.calendar_subscription.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, {
        action: 'update',
        resource: 'calendarSubscriptions',
      });
    }

    await tx.mutate.calendar_subscription.update(args);
  }),

  unsubscribe: defineMutator(calendarSubscriptionDeleteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.calendar_subscription.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, {
        action: 'delete',
        resource: 'calendarSubscriptions',
      });
    }

    await tx.mutate.calendar_subscription.delete({ id: args.id });
  }),
};
