import type { Transaction } from '@rocicorp/zero';
import { zql, type Schema } from '../schema';
import { canReadVisibility, requireAuthenticated } from './authorize';
import { PermissionError } from './errors';

type AmendmentAccessTx = Transaction<Schema>;

interface AmendmentAccessCtx {
  readonly userID: string;
}

export interface ViewableAmendment {
  id: string;
  title?: string | null;
  visibility?: string | null;
  created_by_id?: string | null;
  group_id?: string | null;
  event_id?: string | null;
}

export async function assertCanViewAmendment(
  tx: AmendmentAccessTx,
  ctx: AmendmentAccessCtx,
  amendmentId: string
): Promise<ViewableAmendment> {
  if (tx.location === 'client') {
    return { id: amendmentId };
  }

  requireAuthenticated(tx, ctx, { action: 'view', resource: 'amendments' });

  const amendment = await tx.run(zql.amendment.where('id', amendmentId).one());
  if (!amendment) {
    throw new Error('Amendment not found');
  }

  if (canReadVisibility(amendment.visibility, ctx, amendment.created_by_id === ctx.userID)) {
    return amendment;
  }

  const collaborator = await tx.run(
    zql.amendment_collaborator
      .where('amendment_id', amendmentId)
      .where('user_id', ctx.userID)
      .where('status', 'IN', ['active', 'collaborator', 'member', 'admin'])
      .one()
  );
  if (collaborator) {
    return amendment;
  }

  if (amendment.group_id) {
    const [group, membership, guestAccess] = await Promise.all([
      tx.run(zql.group.where('id', amendment.group_id).where('owner_id', ctx.userID).one()),
      tx.run(
        zql.group_membership
          .where('group_id', amendment.group_id)
          .where('user_id', ctx.userID)
          .where('status', 'IN', ['active', 'member', 'admin'])
          .one()
      ),
      tx.run(
        zql.group_guest_access
          .where('group_id', amendment.group_id)
          .where('user_id', ctx.userID)
          .where('status', 'active')
          .one()
      ),
    ]);
    if (group || membership || guestAccess) {
      return amendment;
    }
  }

  if (amendment.event_id) {
    const participation = await tx.run(
      zql.event_participant
        .where('event_id', amendment.event_id)
        .where('user_id', ctx.userID)
        .where('status', 'IN', ['active', 'confirmed', 'member', 'admin'])
        .one()
    );
    if (participation) {
      return amendment;
    }
  }

  throw new PermissionError('view', 'amendments', `amendment:${amendmentId}`);
}
