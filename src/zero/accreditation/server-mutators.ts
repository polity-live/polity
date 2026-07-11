import { defineMutator, type Transaction } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated } from '../rbac/authorize';
import { zql } from '../schema';
import {
  decideAccreditationSchema,
  requestAccreditationSchema,
  type AccreditationStatus,
} from './schema';
import { verifyPassword } from '../voting-password/server-mutators';
import type { Schema } from '../schema';

const ACTIVE_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];

type AccreditationTx = Transaction<Schema>;

async function appendAudit(
  tx: AccreditationTx,
  row: { id: string; event_id: string; user_id: string; status?: string | null },
  toStatus: AccreditationStatus,
  actorId: string | null,
  reason?: string
) {
  await tx.mutate.accreditation_audit.insert({
    id: crypto.randomUUID(),
    accreditation_id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    from_status: row.status ?? null,
    to_status: toStatus,
    actor_id: actorId,
    reason: reason ?? null,
    created_at: Date.now(),
  });
}

const requestAccreditation = defineMutator(
  requestAccreditationSchema,
  async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'accreditations' });
    const userID = ctx.userID;

    const [agendaItem, participant, votingPassword, existing] = await Promise.all([
      tx.run(zql.agenda_item.where('id', args.agenda_item_id).one()),
      tx.run(
        zql.event_participant
          .where('event_id', args.event_id)
          .where('user_id', userID)
          .where('status', 'IN', ACTIVE_PARTICIPANT_STATUSES)
          .one()
      ),
      tx.run(zql.voting_password.where('user_id', userID).one()),
      tx.run(zql.accreditation.where('event_id', args.event_id).where('user_id', userID).one()),
    ]);

    if (
      !agendaItem ||
      agendaItem.event_id !== args.event_id ||
      agendaItem.type !== 'accreditation'
    ) {
      throw new Error('Accreditation agenda item does not belong to this event.');
    }
    if (!participant) throw new Error('Only active event participants can request accreditation.');
    if (!votingPassword)
      throw new Error('No voting password set. Please set your voting PIN first.');
    if (!(await verifyPassword(args.password, votingPassword.password_hash))) {
      throw new Error('Invalid voting password.');
    }
    if (existing?.status === 'approved') throw new Error('Already accredited for this event.');

    const now = Date.now();
    if (existing) {
      await tx.mutate.accreditation.update({
        id: existing.id,
        agenda_item_id: args.agenda_item_id,
        status: 'pending',
        requested_at: now,
        decided_at: null,
        decided_by: null,
        decision_reason: null,
        confirmed_at: null,
      });
      await appendAudit(tx, existing, 'pending', userID, 'self_request');
      return;
    }

    const accreditation = {
      id: crypto.randomUUID(),
      event_id: args.event_id,
      agenda_item_id: args.agenda_item_id,
      user_id: userID,
      status: 'pending' as const,
    };
    await tx.mutate.accreditation.insert({
      ...accreditation,
      requested_at: now,
      decided_at: null,
      decided_by: null,
      decision_reason: null,
      confirmed_at: null,
      created_at: now,
    });
    await appendAudit(tx, { ...accreditation, status: null }, 'pending', userID, 'self_request');
  }
);

function decisionMutator(fromStatus: AccreditationStatus, toStatus: AccreditationStatus) {
  return defineMutator(decideAccreditationSchema, async ({ tx, ctx, args }) => {
    const row = await tx.run(zql.accreditation.where('id', args.accreditation_id).one());
    if (!row) throw new Error('Accreditation not found.');
    await can(tx, ctx, {
      action: 'manage_participants',
      resource: 'events',
      eventId: row.event_id,
    });
    if (row.status !== fromStatus) {
      throw new Error(`Accreditation must be ${fromStatus} before it can become ${toStatus}.`);
    }
    const now = Date.now();
    await tx.mutate.accreditation.update({
      id: row.id,
      status: toStatus,
      decided_at: now,
      decided_by: ctx.userID,
      decision_reason: args.reason ?? null,
      confirmed_at: toStatus === 'approved' ? now : null,
    });
    await appendAudit(tx, row, toStatus, ctx.userID, args.reason);
  });
}

export const accreditationServerMutators = {
  requestAccreditation,
  confirmAccreditation: requestAccreditation,
  approveAccreditation: decisionMutator('pending', 'approved'),
  rejectAccreditation: decisionMutator('pending', 'rejected'),
  revokeAccreditation: decisionMutator('approved', 'revoked'),
};
