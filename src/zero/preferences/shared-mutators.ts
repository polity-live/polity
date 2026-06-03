import { defineMutator } from '@rocicorp/zero';
import { createUserPreferenceSchema, updateUserPreferenceSchema } from './schema';
import { zql } from '../schema';

function isDuplicateUserPreferenceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('user_preference_user_id_key');
}

export const preferenceSharedMutators = {
  create: defineMutator(createUserPreferenceSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    const existing = await tx.run(zql.user_preference.where('user_id', userID).one());

    if (existing) {
      await tx.mutate.user_preference.update({
        id: existing.id,
        ...args,
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
        ...args,
        updated_at: now,
      });
    }
  }),

  update: defineMutator(updateUserPreferenceSchema, async ({ tx, args }) => {
    const { id, ...fields } = args;
    await tx.mutate.user_preference.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),
};
