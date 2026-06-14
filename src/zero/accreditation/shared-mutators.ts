import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { isPermissionError } from '../rbac/errors';
import { zql } from '../schema';
import { createAccreditationSchema, deleteAccreditationSchema } from './schema';

export const accreditationSharedMutators = {
  // Confirm accreditation (server verifies voting password)
  confirmAccreditation: defineMutator(createAccreditationSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'accreditations' });
    const now = Date.now();
    await tx.mutate.accreditation.insert({
      id: crypto.randomUUID(),
      event_id: args.event_id,
      agenda_item_id: args.agenda_item_id,
      user_id: userID,
      confirmed_at: now,
      created_at: now,
    });
  }),

  deleteAccreditation: defineMutator(deleteAccreditationSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const accreditation = await tx.run(zql.accreditation.where('id', args.id).one());
      if (!accreditation) {
        throw new Error('Accreditation not found');
      }

      try {
        requireOwner(tx, ctx, accreditation.user_id, {
          action: 'delete',
          resource: 'accreditations',
        });
      } catch (error) {
        if (!isPermissionError(error)) throw error;
        await can(tx, ctx, {
          action: 'manage_votes',
          resource: 'events',
          eventId: accreditation.event_id,
        });
      }
    }

    await tx.mutate.accreditation.delete({ id: args.id });
  }),
};
