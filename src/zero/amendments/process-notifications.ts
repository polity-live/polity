import { type Transaction } from '@rocicorp/zero';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { amendmentTitle, eventTitle } from '../server-helpers';

type ZeroTransaction = Transaction<Schema>;

interface ProcessVoteResolution {
  handled: boolean;
  amendmentId?: string | null;
  terminalDecision?: 'accepted' | 'rejected' | null;
}

export async function notifyProcessVoteResolution(
  tx: ZeroTransaction,
  senderId: string,
  agendaItemId: string,
  resolution: ProcessVoteResolution
) {
  if (!resolution.handled || !resolution.amendmentId) {
    return;
  }

  const amendmentId = resolution.amendmentId;
  const [title, agendaItem] = await Promise.all([
    amendmentTitle(tx, amendmentId),
    tx.run(zql.agenda_item.where('id', agendaItemId).one()),
  ]);

  if (resolution.terminalDecision === 'rejected') {
    fireNotification('notifyAmendmentRejected', {
      senderId,
      amendmentId,
      amendmentTitle: title,
      eventId: agendaItem?.event_id ?? undefined,
      eventTitle: agendaItem?.event_id ? await eventTitle(tx, agendaItem.event_id) : 'Event',
    });
  }

  if (resolution.terminalDecision === 'accepted') {
    fireNotification('notifyWorkflowChanged', {
      senderId,
      amendmentId,
      amendmentTitle: title,
      newStatus: 'accepted',
    });
  }
}
