import type { Page } from '@playwright/test';

import { db } from '../db';
import { deterministicE2EUuid } from '../run';

export interface CommunicationBoundaryLedger {
  pushSubscriptions: number;
  pushDeliveries: number;
  resendEvents: number;
  aiRequests: number;
}

export async function installCommunicationBoundaryFakes(page: Page) {
  const ledger: CommunicationBoundaryLedger = {
    pushSubscriptions: 0,
    pushDeliveries: 0,
    resendEvents: 0,
    aiRequests: 0,
  };

  await page.route('**/api/push/subscription', async route => {
    ledger.pushSubscriptions += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, subscriptionId: 'push-e2e-local' }),
    });
  });
  await page.route('**/api/push/test**', async route => {
    ledger.pushDeliveries += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'push-job-local', status: 'sent' }),
    });
  });
  await page.route('**/api/resend/webhook', async route => {
    ledger.resendEvents += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ received: true }),
    });
  });
  await page.route('**/api/ai/chat', async route => {
    ledger.aiRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body:
        [
          JSON.stringify({ type: 'text-delta', text: 'The dataset can be archived.' }),
          JSON.stringify({
            type: 'tool-call',
            toolName: 'archiveDataset',
            args: { id: 'dataset-e2e-local' },
          }),
          JSON.stringify({ type: 'tool-result', toolName: 'archiveDataset' }),
        ].join('\n') + '\n',
    });
  });

  return ledger;
}

export async function seedMessageFlow(prefix: string, senderId: string, recipientId: string) {
  const sql = db();
  const conversationId = deterministicE2EUuid(`${prefix}:communication:conversation`);
  const senderParticipantId = deterministicE2EUuid(`${prefix}:communication:sender-participant`);
  const recipientParticipantId = deterministicE2EUuid(
    `${prefix}:communication:recipient-participant`
  );
  const messageId = deterministicE2EUuid(`${prefix}:communication:message`);
  const content = `${prefix} cross-actor message`;

  await sql`
    insert into public.conversation (id, type, name, status, pinned, created_at)
    values (${conversationId}::uuid, 'direct', ${`${prefix} conversation`}, 'active', false, now())
    on conflict (id) do nothing
  `;
  await sql`
    insert into public.conversation_participant (id, conversation_id, user_id, last_read_at)
    values
      (${senderParticipantId}::uuid, ${conversationId}::uuid, ${senderId}::uuid, now()),
      (${recipientParticipantId}::uuid, ${conversationId}::uuid, ${recipientId}::uuid, null)
    on conflict (conversation_id, user_id) do nothing
  `;
  await sql`
    insert into public.message (id, conversation_id, sender_id, content, is_read, created_at, updated_at)
    values (${messageId}::uuid, ${conversationId}::uuid, ${senderId}::uuid, ${content}, false, now(), now())
    on conflict (id) do nothing
  `;

  return { conversationId, messageId, content };
}

export async function seedNotificationFlow(prefix: string, recipientId: string, actionUrl: string) {
  const notificationId = deterministicE2EUuid(`${prefix}:communication:notification`);
  const title = `${prefix} persisted notification`;
  await db()`
    insert into public.notification (
      id, recipient_id, title, message, type, action_url, is_read, created_at, updated_at
    ) values (
      ${notificationId}::uuid, ${recipientId}::uuid, ${title}, 'Open the persisted target',
      'system_notification', ${actionUrl}, false, now(), now()
    )
    on conflict (id) do nothing
  `;
  return { notificationId, title, actionUrl };
}

export async function cleanupCommunicationFlow(ids: {
  conversationId?: string;
  notificationId?: string;
}) {
  const sql = db();
  if (ids.notificationId) {
    await sql`delete from public.notification where id = ${ids.notificationId}::uuid`;
  }
  if (ids.conversationId) {
    await sql`delete from public.conversation where id = ${ids.conversationId}::uuid`;
  }
}
