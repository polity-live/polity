import { type Transaction } from '@rocicorp/zero';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { amendmentTitle, eventTitle, groupName } from '../server-helpers';

type ZeroTransaction = Transaction<Schema>;

interface ProcessVoteResolution {
  handled: boolean;
  amendmentId?: string | null;
  terminalDecision?: 'accepted' | 'rejected' | null;
  supportedGroupId?: string | null;
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
  const needsEventTitle =
    Boolean(resolution.supportedGroupId) || resolution.terminalDecision === 'rejected';
  const resolvedEventTitle =
    needsEventTitle && agendaItem?.event_id ? await eventTitle(tx, agendaItem.event_id) : undefined;

  if (resolution.supportedGroupId) {
    fireNotification('notifyGroupAmendmentSupportConfirmed', {
      senderId,
      amendmentId,
      amendmentTitle: title,
      groupId: resolution.supportedGroupId,
      groupName: await groupName(tx, resolution.supportedGroupId),
      eventId: agendaItem?.event_id ?? undefined,
      eventTitle: resolvedEventTitle,
    });
  }

  if (resolution.terminalDecision === 'rejected') {
    fireNotification('notifyAmendmentRejected', {
      senderId,
      amendmentId,
      amendmentTitle: title,
      eventId: agendaItem?.event_id ?? undefined,
      eventTitle: resolvedEventTitle ?? 'Event',
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
