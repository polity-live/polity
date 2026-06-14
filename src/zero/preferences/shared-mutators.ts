import { defineMutator } from '@rocicorp/zero';
import { createUserPreferenceSchema, updateUserPreferenceSchema } from './schema';
import { zql } from '../schema';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';

function isDuplicateUserPreferenceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('user_preference_user_id_key');
}

export const preferenceSharedMutators = {
  create: defineMutator(createUserPreferenceSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'preferences' });
    const now = Date.now();
    const { id: createdPreferenceId, ...preferenceFields } = args;
    void createdPreferenceId;
    const existing = await tx.run(zql.user_preference.where('user_id', userID).one());

    if (existing) {
      await tx.mutate.user_preference.update({
        id: existing.id,
        ...preferenceFields,
        updated_at: now,
      });
      return;
    }

    try {
      await tx.mutate.user_preference.insert({
        ...args,
        user_id: userID,
        created_at: now,
        updated_at: now,
      });
    } catch (error: unknown) {
      // Handle parallel create calls racing on the unique user_id constraint.
      if (!isDuplicateUserPreferenceError(error)) throw error;

      const row = await tx.run(zql.user_preference.where('user_id', userID).one());

      if (!row) throw error;

      await tx.mutate.user_preference.update({
        id: row.id,
        ...preferenceFields,
        updated_at: now,
      });
    }
  }),

  update: defineMutator(updateUserPreferenceSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const row = await tx.run(zql.user_preference.where('id', args.id).one());
      requireOwner(tx, ctx, row?.user_id, { action: 'update', resource: 'preferences' });
    }

    const { id, ...fields } = args;
    await tx.mutate.user_preference.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),
};
