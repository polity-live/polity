import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { userUpdateSchema } from './schema';
import { followCreateSchema, followDeleteSchema } from '../network/schema';
import { normalizeUserPrimaryMediaUpdate } from '../shared/primaryMedia';

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const userSharedMutators = {
  updateProfile: defineMutator(userUpdateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'update', resource: '$users' });
    await tx.mutate.user.update({
      ...normalizeUserPrimaryMediaUpdate(args),
      id: userID,
      updated_at: Date.now(),
    });
  }),

  follow: defineMutator(followCreateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'follows' });
    const now = Date.now();
    await tx.mutate.follow.insert({
      ...args,
      follower_id: userID,
      created_at: now,
    });
  }),

  unfollow: defineMutator(followDeleteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const follow = await tx.run(zql.follow.where('id', args.id).one());
      requireOwner(tx, ctx, follow?.follower_id, { action: 'delete', resource: 'follows' });
    }
    await tx.mutate.follow.delete({ id: args.id });
  }),
};
