import { createHmac, randomBytes } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { Resend } from 'resend';
import { handleResendWebhook, type NewsletterServiceDeps } from '../newsletter-service';

it('verifies real Resend signatures before invitation dispatch, rejects tampering and deduplicates replay', async () => {
  const secret = randomBytes(32);
  const event = {
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { email_id: 'invitation-mail' },
  };
  const rawBody = JSON.stringify(event);
  const svixId = 'msg_invitation_test';
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest('base64');
  const recorded = new Set<string>();
  const insert = vi.fn(async (row: { svix_id: string }) => {
    if (recorded.has(row.svix_id)) return { error: { code: '23505' } };
    recorded.add(row.svix_id);
    return { error: null };
  });
  const supabase = { from: () => ({ insert }) } as unknown as NonNullable<
    NewsletterServiceDeps['supabase']
  >;
  const processInvitationEvent = vi.fn(async () => undefined);
  const deps = {
    supabase,
    resend: new Resend('re_test'),
    processInvitationEvent,
    config: {
      apiKey: 're_test',
      topicId: 'topic-test',
      webhookSecret: `whsec_${secret.toString('base64')}`,
    },
  };
  const input = { rawBody, svixId, svixTimestamp, svixSignature: `v1,${signature}` };
  await expect(handleResendWebhook(input, deps)).resolves.toEqual({
    duplicate: false,
    type: event.type,
  });
  await expect(handleResendWebhook(input, deps)).resolves.toEqual({ duplicate: true });
  await expect(
    handleResendWebhook({ ...input, rawBody: rawBody.replace('delivered', 'bounced') }, deps)
  ).rejects.toMatchObject({ status: 400 });
  expect(processInvitationEvent).toHaveBeenCalledExactlyOnceWith(event);
  expect(insert).toHaveBeenCalledTimes(2);
});
