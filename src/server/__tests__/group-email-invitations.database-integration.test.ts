import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isLocalTestDatabase } from '@/test/local-database';
import { executeZeroTransaction, createZeroContext } from '../zero-mutate';
import { rows, sqlTransaction } from '../transaction';
import {
  handleGroupEmailInvitations,
  handlePublicGroupInvitation,
  InvitationError,
  processInvitationWebhook,
  tokenHash,
  type InvitationConfig,
  type InvitationProvider,
} from '../group-email-invitations';

const notifications = vi.hoisted(() => ({ accepted: vi.fn(async () => undefined) }));
vi.mock('@/features/notifications/utils/notification-helpers.ts', () => ({
  notifyGroupInvitationAccepted: notifications.accepted,
}));
if (!isLocalTestDatabase(process.env.ZERO_UPSTREAM_DB ?? ''))
  throw new Error('Invitation tests require isolated local PostgreSQL');
const actor = crypto.randomUUID(),
  recipient = crypto.randomUUID(),
  outsider = crypto.randomUUID();
let group: string, role: string, adminRole: string, recipientEmail: string;
let messages: Parameters<InvitationProvider['send']>[0];
let config: InvitationConfig;
let detachedDeliveryIds: string[];
let api: InvitationProvider;
const user = (id: string, email?: string, confirmed = true) =>
  ({ id, email, email_confirmed_at: confirmed ? new Date().toISOString() : undefined }) as User;
const query = (text: string, values: unknown[] = []) =>
  executeZeroTransaction(createZeroContext(actor), tx => rows(sqlTransaction(tx), text, values));
const adminRequest = (body: unknown, key: string = crypto.randomUUID(), id: string = actor) =>
  handleGroupEmailInvitations(
    new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: key, ...(body as object) }),
    }),
    group,
    { config, provider: api, user: async () => user(id) }
  );
const invite = (emails = [recipientEmail], key?: string) =>
  adminRequest({ action: 'create', emails, roleIds: [role], language: 'de' }, key);
const getToken = (index = 0) => messages[index].html.match(/\/invite\/([A-Za-z0-9_-]{43})/)![1];
const accept = (token: string, id = recipient, email = recipientEmail, confirmed = true) =>
  handlePublicGroupInvitation(new Request('http://localhost/api', { method: 'POST' }), token, {
    config,
    user: async () => user(id, email, confirmed),
  });

beforeEach(async () => {
  detachedDeliveryIds = [];
  group = crypto.randomUUID();
  role = crypto.randomUUID();
  adminRole = crypto.randomUUID();
  recipientEmail = `${recipient}@example.com`;
  messages = [];
  config = {
    production: false,
    baseUrl: 'http://localhost:3000',
    from: 'Polity <invites@example.com>',
    apiKey: 'fake',
    limit: 50,
    allowedRecipients: [recipientEmail, `${outsider}@example.com`],
  };
  api = {
    usage: vi.fn(async () => ({
      emails: { daily: { used: 0, limit: 100 }, monthly: { used: 0, limit: 3_000 } },
    })),
    send: vi.fn(async mails => {
      messages = mails;
      return mails.map(() => crypto.randomUUID());
    }),
  };
  await query(
    "INSERT INTO public.\"user\"(id,first_name) VALUES($1,'Admin'),($2,'Outsider') ON CONFLICT(id) DO NOTHING",
    [actor, outsider]
  );
  await query(
    "INSERT INTO public.\"group\"(id,name,group_type) VALUES($1,'Email invitations','base')",
    [group]
  );
  await query(
    "INSERT INTO public.role(id,group_id,scope,name) VALUES($1,$3,'group','Member'),($2,$3,'group','Admin')",
    [role, adminRole, group]
  );
  await query(
    "INSERT INTO public.group_membership(id,group_id,user_id,status) VALUES($1,$2,$3,'active')",
    [crypto.randomUUID(), group, actor]
  );
  await query(
    'INSERT INTO public.group_membership_role(group_membership_id,role_id) SELECT id,$2 FROM public.group_membership WHERE group_id=$1 AND user_id=$3',
    [group, adminRole, actor]
  );
  await query(
    "INSERT INTO public.action_right(id,role_id,group_id,resource,action) VALUES($1,$2,$3,'groupMemberships','manage')",
    [crypto.randomUUID(), adminRole, group]
  );
  notifications.accepted.mockClear();
});
afterEach(async () => {
  await query(
    'DELETE FROM group_invitations.group_email_invitation_delivery d USING group_invitations.group_email_invitation i WHERE d.invitation_id=i.id AND i.group_id=$1',
    [group]
  );
  await query(
    'DELETE FROM group_invitations.group_email_invitation_delivery WHERE id=ANY($1::uuid[])',
    [detachedDeliveryIds]
  );
  await query('DELETE FROM public."group" WHERE id=$1', [group]);
  await query('DELETE FROM auth.users WHERE id=$1', [recipient]);
  await query('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [[actor, recipient, outsider]]);
});
async function registerRecipient() {
  await query(
    'INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),\'{"language":"de"}\'::jsonb)',
    [recipient, recipientEmail]
  );
}

describe('group email invitation database integration', () => {
  it('stores optional recipient names, personalizes mail and preserves names on resend without leaking them publicly', async () => {
    const body = {
      action: 'create',
      recipients: [
        { email: recipientEmail.toUpperCase(), firstName: ' Ada ', lastName: ' Lovelace ' },
      ],
      roleIds: [role],
      language: 'en',
    };
    const key = crypto.randomUUID();
    const result = await (await adminRequest(body, key)).json();
    expect(result.results[0]).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      status: 'sent',
    });
    expect(messages[0].html).toContain('Hello Ada Lovelace,');
    const stored = await query(
      'SELECT first_name,last_name FROM group_invitations.group_email_invitation WHERE group_id=$1',
      [group]
    );
    expect(stored).toEqual([{ first_name: 'Ada', last_name: 'Lovelace' }]);
    const list = await handleGroupEmailInvitations(new Request('http://localhost/api'), group, {
      config,
      provider: api,
      user: async () => user(actor),
    });
    expect((await list.json()).invitations[0]).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    const publicPreview = await handlePublicGroupInvitation(
      new Request('http://localhost/api'),
      getToken(),
      { user: async () => null }
    );
    expect(JSON.stringify(await publicPreview.json())).not.toContain('Ada');
    expect(
      await (
        await adminRequest(
          { ...body, recipients: [{ email: recipientEmail, firstName: 'Grace' }] },
          key
        )
      ).json()
    ).toMatchObject({ error: 'idempotency_conflict' });
    const id = result.results[0].invitationId;
    await query(
      "UPDATE group_invitations.group_email_invitation_delivery SET attempted_at=now()-interval '11 minutes' WHERE invitation_id=$1",
      [id]
    );
    expect((await adminRequest({ action: 'resend', invitationId: id })).status).toBe(200);
    expect(messages[0].html).toContain('Hello Ada Lovelace,');
    await registerRecipient();
    await query('UPDATE public."user" SET first_name=$1,last_name=$2 WHERE id=$3', [
      'Existing',
      'Profile',
      recipient,
    ]);
    const accepted = await handlePublicGroupInvitation(
      new Request('http://localhost/api', { method: 'POST' }),
      getToken(),
      { user: async () => user(recipient, recipientEmail) }
    );
    expect(accepted.status).toBe(200);
    expect(
      await query('SELECT first_name,last_name FROM public."user" WHERE id=$1', [recipient])
    ).toEqual([{ first_name: 'Existing', last_name: 'Profile' }]);
  });
  it('rejects conflicting duplicate names and oversized fields before sending', async () => {
    const common = { action: 'create', roleIds: [role] };
    expect(
      await (
        await adminRequest({
          ...common,
          recipients: [
            { email: recipientEmail, firstName: 'Ada' },
            { email: recipientEmail.toUpperCase(), firstName: 'Grace' },
          ],
        })
      ).json()
    ).toMatchObject({ error: 'invalid_names' });
    expect(
      (
        await adminRequest({
          ...common,
          recipients: [{ email: recipientEmail, lastName: 'a'.repeat(101) }],
        })
      ).status
    ).toBe(400);
    expect(api.send).not.toHaveBeenCalled();
    expect(
      await query('SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1', [
        group,
      ])
    ).toHaveLength(0);
  });
  it.each(['apiKey', 'from'] as const)(
    'reports missing %s before reserving invitations or querying usage',
    async field => {
      config[field] = '';
      expect(await (await invite()).json()).toEqual({ error: 'configuration' });
      expect(api.usage).not.toHaveBeenCalled();
      expect(api.send).not.toHaveBeenCalled();
      expect(
        await query('SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1', [
          group,
        ])
      ).toHaveLength(0);
    }
  );
  it('preserves provider access errors and rejects malformed quota responses without reservations', async () => {
    api.usage = vi.fn(async () => {
      throw new InvitationError('provider_access_denied', 503);
    });
    expect(await (await invite()).json()).toEqual({ error: 'provider_access_denied' });
    api.usage = vi.fn(async () => ({
      emails: { daily: { used: 0, limit: 100 }, monthly: { used: 0, limit: NaN } },
    }));
    expect(await (await invite()).json()).toEqual({ error: 'quota_unavailable' });
    expect(api.send).not.toHaveBeenCalled();
    expect(
      await query('SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1', [
        group,
      ])
    ).toHaveLength(0);
  });
  it('preserves anonymous budget reservations when a group is deleted', async () => {
    await invite();
    const deliveries = await query(
      'SELECT d.id FROM group_invitations.group_email_invitation_delivery d JOIN group_invitations.group_email_invitation i ON i.id=d.invitation_id WHERE i.group_id=$1',
      [group]
    );
    detachedDeliveryIds = deliveries.map(row => String(row.id));
    await query('DELETE FROM public."group" WHERE id=$1', [group]);
    expect(
      await query(
        'SELECT invitation_id,batch_id FROM group_invitations.group_email_invitation_delivery WHERE id=ANY($1::uuid[])',
        [detachedDeliveryIds]
      )
    ).toEqual([{ invitation_id: null, batch_id: null }]);
  });
  it('expires links and rejects group rules that no longer allow direct membership', async () => {
    await invite();
    const token = getToken();
    await registerRecipient();
    await query(
      "UPDATE group_invitations.group_email_invitation SET expires_at=now()-interval '1 second' WHERE group_id=$1",
      [group]
    );
    expect(await (await accept(token)).json()).toMatchObject({ error: 'expired' });
    await query(
      "UPDATE group_invitations.group_email_invitation SET expires_at=now()+interval '1 day' WHERE group_id=$1",
      [group]
    );
    await query('UPDATE public."group" SET group_type=\'hierarchical\' WHERE id=$1', [group]);
    expect(await (await accept(token)).json()).toMatchObject({ error: 'group_ineligible' });
    expect(
      await query('SELECT id FROM public.group_membership WHERE user_id=$1', [recipient])
    ).toHaveLength(0);
  });
  it('activates an existing request once when acceptance races and preserves its identifier', async () => {
    await invite();
    const token = getToken();
    await registerRecipient();
    const membershipId = crypto.randomUUID();
    await query(
      "INSERT INTO public.group_membership(id,group_id,user_id,status) VALUES($1,$2,$3,'requested')",
      [membershipId, group, recipient]
    );
    const responses = await Promise.all([accept(token), accept(token)]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(
      await query(
        'SELECT id,status FROM public.group_membership WHERE group_id=$1 AND user_id=$2',
        [group, recipient]
      )
    ).toEqual([{ id: membershipId, status: 'active' }]);
    expect(notifications.accepted).toHaveBeenCalledTimes(1);
  });
  it('skips independent active membership on both new batches and resend', async () => {
    await invite();
    await registerRecipient();
    const [item] = await query(
      'SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1',
      [group]
    );
    await query(
      "INSERT INTO public.group_membership(id,group_id,user_id,status) VALUES($1,$2,$3,'active')",
      [crypto.randomUUID(), group, recipient]
    );
    await query(
      "UPDATE group_invitations.group_email_invitation_delivery SET attempted_at=now()-interval '11 minutes' WHERE invitation_id=$1",
      [item.id]
    );
    expect(await (await invite()).json()).toMatchObject({ results: [{ status: 'member' }] });
    expect(
      await (await adminRequest({ action: 'resend', invitationId: item.id })).json()
    ).toMatchObject({ results: [{ status: 'member' }] });
    expect(api.send).toHaveBeenCalledTimes(1);
  });
  it('reconciles provider callbacks arriving before send returns using the specific delivery attempt', async () => {
    api.send = vi.fn(async batch => {
      messages = batch;
      const ids = batch.map(() => crypto.randomUUID());
      await processInvitationWebhook({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: ids[0], tags: batch[0].tags },
      });
      return ids;
    });
    await invite();
    expect(
      await query(
        'SELECT d.status FROM group_invitations.group_email_invitation_delivery d JOIN group_invitations.group_email_invitation i ON i.id=d.invitation_id WHERE i.group_id=$1',
        [group]
      )
    ).toEqual([{ status: 'delivered' }]);
  });
  it('invites external users, previews without consumption and accepts atomically after registration', async () => {
    const response = await invite([recipientEmail, `${outsider}@example.com`]);
    expect(response.status).toBe(200);
    expect(messages).toHaveLength(2);
    expect(messages.map(mail => mail.to)).toEqual([[recipientEmail], [`${outsider}@example.com`]]);
    const token = getToken();
    const persisted = await query(
      'SELECT token_hash,expires_at,created_at FROM group_invitations.group_email_invitation WHERE email=$1',
      [recipientEmail]
    );
    expect(persisted[0].token_hash).toBe(tokenHash(token));
    expect(
      Date.parse(String(persisted[0].expires_at)) - Date.parse(String(persisted[0].created_at))
    ).toBeCloseTo(30 * 86_400_000, -4);
    const preview = await handlePublicGroupInvitation(new Request('http://localhost/api'), token, {
      config,
      user: async () => null,
    });
    expect(await preview.json()).toMatchObject({
      state: 'pending',
      maskedEmail: `${recipientEmail[0]}***@example.com`,
      matchesEmail: false,
    });
    expect(
      await query('SELECT id FROM public.group_membership WHERE user_id=$1', [recipient])
    ).toHaveLength(0);
    await registerRecipient();
    expect((await accept(token)).status).toBe(200);
    expect(
      await query('SELECT status FROM public.group_membership WHERE group_id=$1 AND user_id=$2', [
        group,
        recipient,
      ])
    ).toEqual([{ status: 'active' }]);
    const memberships = await query(
      'SELECT mr.role_id FROM public.group_membership_role mr JOIN public.group_membership m ON m.id=mr.group_membership_id WHERE m.group_id=$1 AND m.user_id=$2',
      [group, recipient]
    );
    expect(memberships).toEqual([{ role_id: role }]);
    expect(
      await query(
        'SELECT state,accepted_by_id FROM group_invitations.group_email_invitation WHERE email=$1',
        [recipientEmail]
      )
    ).toEqual([{ state: 'accepted', accepted_by_id: recipient }]);
    expect(notifications.accepted).toHaveBeenCalledTimes(1);
    expect((await accept(token)).status).toBe(200);
    expect((await accept(token, recipient, 'changed@example.com')).status).toBe(200);
    expect(notifications.accepted).toHaveBeenCalledTimes(1);
    expect(
      await query('SELECT id FROM public.conversation_participant WHERE user_id=$1', [recipient])
    ).not.toHaveLength(0);
  });
  it('rejects wrong/unconfirmed accounts and preserves a pending invitation', async () => {
    await invite();
    const token = getToken();
    await registerRecipient();
    expect((await accept(token, outsider, 'different@example.com')).status).toBe(403);
    expect((await accept(token, recipient, recipientEmail, false)).status).toBe(403);
    expect(
      await query('SELECT state FROM group_invitations.group_email_invitation WHERE email=$1', [
        recipientEmail,
      ])
    ).toEqual([{ state: 'pending' }]);
  });
  it('rejects missing rights, foreign roles and invalid email input before reserving or sending', async () => {
    expect(
      (
        await adminRequest(
          { action: 'create', emails: [recipientEmail], roleIds: [role] },
          undefined,
          outsider
        )
      ).status
    ).toBe(403);
    expect(
      (
        await adminRequest({
          action: 'create',
          emails: [recipientEmail],
          roleIds: [crypto.randomUUID()],
        })
      ).status
    ).toBe(400);
    expect((await invite(['invalid'])).status).toBe(400);
    expect(
      await query('SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1', [
        group,
      ])
    ).toHaveLength(0);
    expect(api.send).not.toHaveBeenCalled();
  });
  it('deduplicates batches and prevents repeated execution for the same request key', async () => {
    const key = crypto.randomUUID();
    expect((await invite([recipientEmail, recipientEmail.toUpperCase()], key)).status).toBe(200);
    expect((await invite([recipientEmail, recipientEmail.toUpperCase()], key)).status).toBe(200);
    expect(api.send).toHaveBeenCalledTimes(1);
    const duplicate = await invite();
    expect(await duplicate.json()).toMatchObject({
      results: [{ email: recipientEmail, status: 'invited' }],
    });
    expect(api.send).toHaveBeenCalledTimes(1);
  });
  it('reserves concurrent budgets and rejects oversized lists without partial creation', async () => {
    const [existing] = await query(
      "SELECT count(*)::int AS count FROM group_invitations.group_email_invitation_delivery WHERE attempted_at > now()-interval '24 hours'"
    );
    config.limit = Number(existing.count) + 1;
    const oversized = await invite([recipientEmail, `${outsider}@example.com`]);
    expect(oversized.status).toBe(429);
    expect(
      await query('SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1', [
        group,
      ])
    ).toHaveLength(0);
    const responses = await Promise.all([invite(), invite([`${outsider}@example.com`])]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 429]);
    expect(api.send).toHaveBeenCalledTimes(1);
  });
  it('blocks unavailable usage and distinguishes failed from uncertain delivery', async () => {
    api.usage = vi.fn(async () => {
      throw new Error('network');
    });
    expect((await invite()).status).toBe(503);
    expect(api.send).not.toHaveBeenCalled();
    api.usage = vi.fn(async () => ({
      emails: { daily: { used: 0, limit: 100 }, monthly: { used: 0, limit: 3_000 } },
    }));
    api.send = vi.fn(async () => {
      throw new InvitationError('delivery_failed', 503);
    });
    expect(await (await invite()).json()).toMatchObject({ results: [{ status: 'failed' }] });
    api.send = vi.fn(async () => {
      throw new Error('timeout');
    });
    expect(await (await invite([`${outsider}@example.com`])).json()).toMatchObject({
      results: [{ status: 'unknown' }],
    });
  });
  it('rotates expired links on resend, enforces cooldown and rejects revoked links', async () => {
    await invite();
    const oldToken = getToken();
    const [item] = await query(
      'SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1',
      [group]
    );
    expect((await adminRequest({ action: 'resend', invitationId: item.id })).status).toBe(429);
    await query(
      "UPDATE group_invitations.group_email_invitation_delivery SET attempted_at=now()-interval '11 minutes' WHERE invitation_id=$1",
      [item.id]
    );
    expect((await adminRequest({ action: 'resend', invitationId: item.id })).status).toBe(200);
    const newToken = getToken();
    expect(newToken).not.toBe(oldToken);
    await registerRecipient();
    expect((await accept(oldToken)).status).toBe(404);
    expect((await adminRequest({ action: 'revoke', invitationId: item.id })).status).toBe(200);
    expect((await accept(newToken)).status).toBe(410);
  });
  it('rolls back membership and notifications when group rules or roles change', async () => {
    await invite();
    const token = getToken();
    await registerRecipient();
    await query('DELETE FROM public.action_right WHERE role_id=$1', [adminRole]);
    expect((await accept(token)).status).toBe(403);
    expect(
      await query('SELECT id FROM public.group_membership WHERE user_id=$1', [recipient])
    ).toHaveLength(0);
    expect(notifications.accepted).not.toHaveBeenCalled();
    await query(
      "INSERT INTO public.action_right(id,role_id,group_id,resource,action) VALUES($1,$2,$3,'groupMemberships','manage')",
      [crypto.randomUUID(), adminRole, group]
    );
    await query('DELETE FROM public.role WHERE id=$1', [role]);
    expect((await accept(token)).status).toBe(400);
    expect(
      await query('SELECT state FROM group_invitations.group_email_invitation WHERE group_id=$1', [
        group,
      ])
    ).toEqual([{ state: 'pending' }]);
  });
  it('does not overwrite roles if the recipient became an active member independently', async () => {
    await invite();
    const token = getToken();
    await registerRecipient();
    const membershipId = crypto.randomUUID();
    await query(
      "INSERT INTO public.group_membership(id,group_id,user_id,status) VALUES($1,$2,$3,'active')",
      [membershipId, group, recipient]
    );
    await query(
      'INSERT INTO public.group_membership_role(group_membership_id,role_id) VALUES($1,$2)',
      [membershipId, adminRole]
    );
    expect((await accept(token)).status).toBe(200);
    expect(
      await query('SELECT role_id FROM public.group_membership_role WHERE group_membership_id=$1', [
        membershipId,
      ])
    ).toEqual([{ role_id: adminRole }]);
  });
  it('keeps private tables outside public replication and anonymous grants', async () => {
    expect(
      await query(
        "SELECT tablename FROM pg_publication_tables WHERE schemaname='group_invitations'"
      )
    ).toHaveLength(0);
    expect(
      await query("SELECT has_schema_privilege('anon','group_invitations','USAGE') AS allowed")
    ).toEqual([{ allowed: false }]);
  });
  it('handles out-of-order signed-dispatch events without regressing delivery state', async () => {
    await invite();
    const [delivery] = await query(
      'SELECT resend_email_id FROM group_invitations.group_email_invitation_delivery d JOIN group_invitations.group_email_invitation i ON i.id=d.invitation_id WHERE i.group_id=$1',
      [group]
    );
    await processInvitationWebhook({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: delivery.resend_email_id },
    });
    await processInvitationWebhook({
      type: 'email.sent',
      created_at: new Date(Date.now() + 1_000).toISOString(),
      data: { email_id: delivery.resend_email_id },
    });
    expect(
      await query(
        'SELECT status FROM group_invitations.group_email_invitation_delivery WHERE resend_email_id=$1',
        [delivery.resend_email_id]
      )
    ).toEqual([{ status: 'delivered' }]);
  });
});
