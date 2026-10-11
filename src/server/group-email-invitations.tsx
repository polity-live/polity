import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { render } from 'react-email';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import GroupInvitationEmail from '../../emails/group-invitation';
import {
  invitationManagementSchema,
  invitationTokenPattern,
  parseInvitationRecipients,
  type InvitationResult,
  type InvitationDeliveryStatus,
} from '@/features/groups/logic/emailInvitations';
import { getValidatedRequestUser } from './zero-auth';
import { createZeroContext, executeZeroTransaction, type ZeroTransaction } from './zero-mutate';
import { rows, sqlTransaction } from './transaction';
import { can } from '@/zero/rbac/can';
import { PermissionError } from '@/zero/rbac/errors';
import { zql } from '@/zero/schema';
import { groupSharedMutatorInternals } from '@/zero/groups/shared-mutators';
import { groupServerMutators } from '@/zero/groups/server-mutators';
import { mutators } from '@/zero/mutators';
import { loadGroupWithDerivedNetworkMeta } from '@/zero/groups/membership-helpers';
import { withDeferredNotifications } from '@/zero/server-notify';

const DAY = 86_400_000;
export class InvitationError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public details: Record<string, unknown> = {}
  ) {
    super(code);
  }
}
export interface InvitationConfig {
  production: boolean;
  baseUrl: string;
  from: string;
  apiKey: string;
  limit: number;
  allowedRecipients: string[];
}
interface Usage {
  emails: {
    daily: { used: number; limit: number | null };
    monthly: { used: number; limit: number };
  };
}
interface Mail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  tags: { name: string; value: string }[];
}
export interface InvitationProvider {
  usage(): Promise<Usage>;
  send(messages: Mail[], key: string): Promise<string[]>;
}
export interface InvitationDeps {
  config?: InvitationConfig;
  provider?: InvitationProvider;
  user?: (request: Request) => Promise<User | null>;
}

export function invitationConfig(): InvitationConfig {
  const environment =
    process.env.GROUP_EMAIL_INVITATIONS_ENVIRONMENT ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  if (!['production', 'development'].includes(environment))
    throw new InvitationError('configuration', 503);
  const production = environment === 'production';
  const baseUrl =
    process.env.GROUP_EMAIL_INVITATIONS_BASE_URL ||
    (production ? 'https://www.polity.live' : 'http://localhost:3000');
  const parsed = new URL(baseUrl);
  if (
    production
      ? parsed.origin !== 'https://www.polity.live'
      : !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  )
    throw new InvitationError('configuration', 503);
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
    throw new InvitationError('configuration', 503);
  const limit = Number(process.env.GROUP_EMAIL_INVITATIONS_DAILY_LIMIT || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new InvitationError('configuration', 503);
  return {
    production,
    baseUrl: parsed.origin,
    from: process.env.GROUP_EMAIL_INVITATIONS_FROM?.trim() || '',
    apiKey: process.env.RESEND_API_KEY?.trim() || '',
    limit,
    allowedRecipients: (process.env.GROUP_EMAIL_INVITATIONS_ALLOWED_RECIPIENTS || '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function createInvitationProvider(config: InvitationConfig): InvitationProvider {
  async function request(path: string, init: RequestInit = {}) {
    if (!config.apiKey) throw new InvitationError('configuration', 503);
    let response: Response;
    try {
      response = await fetch(`https://api.resend.com${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new InvitationError(path === '/usage' ? 'quota_unavailable' : 'delivery_unknown', 503);
    }
    if (!response.ok) {
      // Never log provider payloads: they may echo invitation HTML and tokens.
      const code =
        response.status === 401 || response.status === 403
          ? 'provider_access_denied'
          : path === '/usage'
            ? 'quota_unavailable'
            : response.status >= 500
              ? 'delivery_unknown'
              : 'delivery_failed';
      console.warn('group_invitation.provider_error', {
        code,
        status: response.status,
        operation: path === '/usage' ? 'usage' : 'send',
      });
      throw new InvitationError(code, 503);
    }
    try {
      return await response.json();
    } catch {
      throw new InvitationError(path === '/usage' ? 'quota_unavailable' : 'delivery_unknown', 503);
    }
  }
  return {
    usage: () => request('/usage'),
    send: async (messages, key) => {
      if (!config.from) throw new InvitationError('configuration', 503);
      const result = await request('/emails/batch', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify(messages),
      });
      if (
        !Array.isArray(result.data) ||
        result.data.length !== messages.length ||
        result.data.some((entry: { id?: string }) => !entry.id)
      )
        throw new InvitationError('delivery_unknown', 503);
      return result.data.map((entry: { id: string }) => entry.id);
    },
  };
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function maskInvitationEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}
export function availableInvitationBudget(
  usage: Usage,
  count: number,
  pending: number,
  limit: number
) {
  const day =
    usage.emails.daily.limit === null
      ? Infinity
      : Math.floor((usage.emails.daily.limit - usage.emails.daily.used) / 2) - pending;
  const month = Math.floor((usage.emails.monthly.limit - usage.emails.monthly.used) / 2) - pending;
  return Math.max(0, Math.min(limit - count, day, month));
}
async function budget(tx: ZeroTransaction, config: InvitationConfig, api: InvitationProvider) {
  let usage: Usage;
  try {
    usage = await api.usage();
  } catch (error) {
    if (error instanceof InvitationError) throw error;
    throw new InvitationError('quota_unavailable', 503);
  }
  if (
    !usage?.emails?.daily ||
    !usage.emails.monthly ||
    !Number.isFinite(usage.emails.daily.used) ||
    !Number.isFinite(usage.emails.monthly.used) ||
    !Number.isFinite(usage.emails.monthly.limit) ||
    (usage.emails.daily.limit !== null && !Number.isFinite(usage.emails.daily.limit))
  )
    throw new InvitationError('quota_unavailable', 503);
  const [counts] = await rows<{ count: string; pending: string }>(
    sqlTransaction(tx),
    `SELECT count(*) AS count, count(*) FILTER (WHERE status IN ('sending','unknown')) AS pending FROM group_invitations.group_email_invitation_delivery WHERE attempted_at > now() - interval '24 hours'`
  );
  return availableInvitationBudget(
    usage,
    Number(counts.count),
    Number(counts.pending),
    config.limit
  );
}
async function authorizeGroup(tx: ZeroTransaction, user: User, groupId: string) {
  await can(tx, createZeroContext(user.id, user.email), {
    action: 'manage',
    resource: 'groupMemberships',
    groupId,
  });
  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
  if (!group) throw new InvitationError('not_found', 404);
  if (
    group.group_type === 'hierarchical' ||
    groupSharedMutatorInternals.requiresGuestAccessFlow(group) ||
    (group.group_type === 'sibling' &&
      (group.primary_sibling_membership_mode !== 'none' || !group.connected_group_id))
  )
    throw new InvitationError('group_ineligible');
  return group;
}
async function validateRoles(tx: ZeroTransaction, groupId: string, roleIds: string[]) {
  const ids = [...new Set(roleIds)];
  if (!ids.length) throw new InvitationError('invalid_roles');
  try {
    if (
      (await groupSharedMutatorInternals.assertRolesAssignableToMembers(tx, ids, groupId)) === false
    )
      throw new Error();
  } catch {
    throw new InvitationError('invalid_roles');
  }
  return ids;
}
async function expireInvitations(tx: ZeroTransaction, groupId: string) {
  await rows(
    sqlTransaction(tx),
    `UPDATE group_invitations.group_email_invitation SET state='expired' WHERE group_id=$1 AND state='pending' AND expires_at <= now()`,
    [groupId]
  );
}
async function recipients(
  tx: ZeroTransaction,
  groupId: string,
  emails: string[]
): Promise<InvitationResult[]> {
  await expireInvitations(tx, groupId);
  const matches = await rows<{ email: string; status: string }>(
    sqlTransaction(tx),
    `
    SELECT lower(a.email) AS email, m.status FROM auth.users a JOIN public.group_membership m ON m.user_id=a.id
    WHERE m.group_id=$1 AND lower(a.email)=ANY($2::text[]) AND a.email_confirmed_at IS NOT NULL AND m.status IN ('active','member','admin','invited')`,
    [groupId, emails]
  );
  const open = await rows<{ email: string }>(
    sqlTransaction(tx),
    `SELECT email FROM group_invitations.group_email_invitation WHERE group_id=$1 AND state='pending' AND email=ANY($2::text[])`,
    [groupId, emails]
  );
  return emails.map(email => ({
    email,
    status: matches.some(row => row.email === email && row.status !== 'invited')
      ? 'member'
      : open.some(row => row.email === email) || matches.some(row => row.email === email)
        ? 'invited'
        : 'ready',
  }));
}
interface InvitationRecord {
  id: string;
  group_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_by_id: string;
  language: 'de' | 'en';
  role_count: number;
  state: string;
  expires_at: string | null;
  accepted_by_id: string | null;
  role_ids: string[];
  role_names: string[];
}
async function invitation(tx: ZeroTransaction, where: string, args: unknown[]) {
  const [row] = await rows<InvitationRecord>(
    sqlTransaction(tx),
    `SELECT i.*, ARRAY(SELECT r.role_id::text FROM group_invitations.group_email_invitation_role r WHERE r.invitation_id=i.id ORDER BY r.role_id) AS role_ids, ARRAY(SELECT COALESCE(r.name,'') FROM group_invitations.group_email_invitation_role ir JOIN public.role r ON r.id=ir.role_id WHERE ir.invitation_id=i.id ORDER BY r.id) AS role_names FROM group_invitations.group_email_invitation i WHERE ${where} FOR UPDATE OF i`,
    args
  );
  if (!row) throw new InvitationError('not_found', 404);
  return row;
}
async function currentBatchResult(
  tx: ZeroTransaction,
  batchId: string,
  result: { results: InvitationResult[]; available: number }
) {
  const deliveries = await rows<{
    invitation_id: string;
    status: InvitationDeliveryStatus;
    attempted_at: string;
  }>(
    sqlTransaction(tx),
    `SELECT invitation_id,status,attempted_at FROM group_invitations.group_email_invitation_delivery WHERE batch_id=$1`,
    [batchId]
  );
  return {
    available: result.available,
    results: result.results.map(row => {
      const delivery = deliveries.find(item => item.invitation_id === row.invitationId);
      return delivery
        ? {
            ...row,
            status:
              delivery.status === 'sending' &&
              Date.now() - Date.parse(delivery.attempted_at) > 120_000
                ? ('unknown' as const)
                : delivery.status,
          }
        : row;
    }),
  };
}
async function listInvitations(tx: ZeroTransaction, groupId: string) {
  await expireInvitations(tx, groupId);
  return rows(
    sqlTransaction(tx),
    `SELECT i.id,i.email,i.first_name,i.last_name,i.state,i.expires_at,i.accepted_at,
    ARRAY(SELECT COALESCE(r.name,'') FROM group_invitations.group_email_invitation_role ir JOIN public.role r ON r.id=ir.role_id WHERE ir.invitation_id=i.id ORDER BY r.id) AS role_names,
    CASE WHEN d.status='sending' AND d.attempted_at < now()-interval '2 minutes' THEN 'unknown' ELSE COALESCE(d.status,'failed') END AS delivery_status, d.attempted_at AS last_attempt_at
    FROM group_invitations.group_email_invitation i LEFT JOIN LATERAL (SELECT status,attempted_at FROM group_invitations.group_email_invitation_delivery WHERE invitation_id=i.id ORDER BY attempted_at DESC LIMIT 1) d ON true
    WHERE i.group_id=$1 ORDER BY i.created_at DESC`,
    [groupId]
  );
}

export async function handleGroupEmailInvitations(
  request: Request,
  groupId: string,
  deps: InvitationDeps = {}
) {
  return invitationResponse(async () => {
    if (!z.uuid().safeParse(groupId).success) throw new InvitationError('invalid_request');
    const user = await (deps.user ?? getValidatedRequestUser)(request);
    if (!user) throw new InvitationError('unauthenticated', 401);
    const config = deps.config ?? invitationConfig();
    const api = deps.provider ?? createInvitationProvider(config);
    const ctx = createZeroContext(user.id, user.email);
    if (request.method === 'GET')
      return executeZeroTransaction(ctx, async tx => {
        await authorizeGroup(tx, user, groupId);
        return { invitations: await listInvitations(tx, groupId) };
      });
    let input: z.infer<typeof invitationManagementSchema>;
    try {
      input = invitationManagementSchema.parse(await request.json());
    } catch {
      throw new InvitationError('invalid_request');
    }
    const body = input;
    const prepared = await executeZeroTransaction(ctx, async tx => {
      const group = await authorizeGroup(tx, user, groupId);
      if (body.action === 'revoke') {
        const item = await invitation(tx, 'i.id=$1 AND i.group_id=$2', [
          body.invitationId,
          groupId,
        ]);
        if (item.state === 'accepted') throw new InvitationError('already_accepted');
        await rows(
          sqlTransaction(tx),
          `UPDATE group_invitations.group_email_invitation SET state='revoked',revoked_at=now() WHERE id=$1`,
          [item.id]
        );
        return { response: { revoked: true } };
      }
      const fingerprint = tokenHash(
        JSON.stringify({ groupId, ...body, idempotencyKey: undefined })
      );
      if (body.action !== 'preview') {
        if (!body.idempotencyKey) throw new InvitationError('invalid_request');
        const [prior] = await rows<{
          id: string;
          fingerprint: string;
          result: { results: InvitationResult[]; available: number };
        }>(
          sqlTransaction(tx),
          `SELECT id,fingerprint,result FROM group_invitations.group_email_invitation_batch WHERE requested_by_id=$1 AND idempotency_key=$2`,
          [user.id, body.idempotencyKey]
        );
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new InvitationError('idempotency_conflict', 409);
          const previousResult =
            typeof prior.result === 'string' ? JSON.parse(prior.result) : prior.result;
          return { response: await currentBatchResult(tx, prior.id, previousResult) };
        }
      }
      let results: InvitationResult[],
        roleIds: string[],
        language: 'de' | 'en',
        resend: InvitationRecord | undefined;
      if (body.action === 'resend') {
        resend = await invitation(tx, 'i.id=$1 AND i.group_id=$2', [body.invitationId, groupId]);
        if (resend.state === 'accepted' || resend.state === 'revoked')
          throw new InvitationError('invalid_state');
        const [recent] = await rows<{ recent: boolean }>(
          sqlTransaction(tx),
          `SELECT EXISTS(SELECT 1 FROM group_invitations.group_email_invitation_delivery WHERE invitation_id=$1 AND attempted_at>now()-interval '10 minutes') AS recent`,
          [resend.id]
        );
        if (recent.recent) throw new InvitationError('resend_cooldown', 429);
        const others = await rows(
          sqlTransaction(tx),
          `SELECT id FROM group_invitations.group_email_invitation WHERE group_id=$1 AND email=$2 AND state='pending' AND id<>$3`,
          [groupId, resend.email, resend.id]
        );
        if (others.length) throw new InvitationError('already_invited', 409);
        if (resend.role_ids.length !== resend.role_count)
          throw new InvitationError('invalid_roles');
        roleIds = await validateRoles(tx, groupId, resend.role_ids);
        language = resend.language;
        const [recipient] = await recipients(tx, groupId, [resend.email]);
        results = [
          {
            email: resend.email,
            firstName: resend.first_name ?? undefined,
            lastName: resend.last_name ?? undefined,
            status: recipient.status === 'member' ? 'member' : 'ready',
          },
        ];
      } else {
        const parsed = parseInvitationRecipients(body);
        if (parsed.conflictingNames.length) throw new InvitationError('invalid_names');
        if (parsed.invalid.length || !parsed.recipients.length || parsed.recipients.length > 100)
          throw new InvitationError('invalid_emails', 400, { invalid: parsed.invalid });
        roleIds = await validateRoles(tx, groupId, body.roleIds);
        language = body.language;
        const statuses = await recipients(
          tx,
          groupId,
          parsed.recipients.map(row => row.email)
        );
        results = statuses.map(row => ({
          ...parsed.recipients.find(person => person.email === row.email),
          ...row,
        }));
      }
      const ready = results.filter(row => row.status === 'ready');
      if (group.group_type === 'sibling') {
        // External accounts cannot yet satisfy a connected-group membership.
        for (const row of ready) {
          const [known] = await rows<{ id: string }>(
            sqlTransaction(tx),
            `SELECT id FROM auth.users WHERE lower(email)=$1 AND email_confirmed_at IS NOT NULL`,
            [row.email]
          );
          if (!known) throw new InvitationError('group_ineligible');
          try {
            await groupSharedMutatorInternals.assertCanDirectlyMutateOfficialMembership(
              tx,
              groupId,
              known.id
            );
          } catch {
            throw new InvitationError('group_ineligible');
          }
        }
      }
      if (!config.production && ready.some(row => !config.allowedRecipients.includes(row.email)))
        throw new InvitationError('recipient_not_allowed');
      if (!config.apiKey || !config.from) throw new InvitationError('configuration', 503);
      const available = await budget(tx, config, api);
      if (body.action === 'preview') return { response: { available, results } };
      if (ready.length > available) throw new InvitationError('quota_exceeded', 429, { available });
      const batchId = randomUUID();
      const messages: Mail[] = [];
      const deliveryIds: string[] = [];
      const [sender] = await rows<{ name: string }>(
        sqlTransaction(tx),
        `SELECT COALESCE(NULLIF(trim(concat_ws(' ',first_name,last_name)),''),handle,'Polity') AS name FROM public."user" WHERE id=$1`,
        [user.id]
      );
      const roles = await tx.run(zql.role.where('id', 'IN', roleIds));
      // Render before committing, so rendering/configuration failures cannot leave a reserved batch.
      for (const result of ready) {
        const id = resend?.id ?? randomUUID();
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 30 * DAY).toISOString();
        const html = await render(
          <GroupInvitationEmail
            language={language}
            groupName={group.name ?? 'Polity'}
            inviterName={sender?.name ?? 'Polity'}
            firstName={result.firstName}
            lastName={result.lastName}
            roles={roles.map(role => role.name ?? '')}
            inviteUrl={`${config.baseUrl}/invite/${token}`}
            expiresAt={expiresAt}
          />
        );
        if (resend)
          await rows(
            sqlTransaction(tx),
            `UPDATE group_invitations.group_email_invitation SET token_hash=$2,state='pending',expires_at=$3,invited_by_id=$4 WHERE id=$1`,
            [id, tokenHash(token), expiresAt, user.id]
          );
        else {
          await rows(
            sqlTransaction(tx),
            `INSERT INTO group_invitations.group_email_invitation(id,group_id,email,invited_by_id,token_hash,language,role_count,expires_at,first_name,last_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              id,
              groupId,
              result.email,
              user.id,
              tokenHash(token),
              language,
              roleIds.length,
              expiresAt,
              result.firstName ?? null,
              result.lastName ?? null,
            ]
          );
          for (const roleId of roleIds)
            await rows(
              sqlTransaction(tx),
              `INSERT INTO group_invitations.group_email_invitation_role(invitation_id,role_id) VALUES($1,$2)`,
              [id, roleId]
            );
        }
        result.invitationId = id;
        result.status = 'sending';
        const deliveryId = randomUUID();
        deliveryIds.push(deliveryId);
        messages.push({
          from: config.from,
          to: [result.email],
          subject:
            language === 'de'
              ? `Einladung zur Gruppe ${group.name ?? 'Polity'}`
              : `Invitation to ${group.name ?? 'Polity'}`,
          html,
          tags: [{ name: 'group_invitation_delivery', value: deliveryId }],
        });
      }
      const response = { results, available: available - ready.length };
      await rows(
        sqlTransaction(tx),
        `INSERT INTO group_invitations.group_email_invitation_batch(id,requested_by_id,group_id,idempotency_key,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
        [batchId, user.id, groupId, body.idempotencyKey, fingerprint, JSON.stringify(response)]
      );
      for (let index = 0; index < ready.length; index++)
        await rows(
          sqlTransaction(tx),
          `INSERT INTO group_invitations.group_email_invitation_delivery(id,invitation_id,batch_id) VALUES($1,$2,$3)`,
          [deliveryIds[index], ready[index].invitationId, batchId]
        );
      return { response, messages, deliveryIds, batchId };
    });
    if (!('messages' in prepared) || !prepared.messages?.length) return prepared.response;
    let ids: string[] = [],
      status: InvitationDeliveryStatus = 'sent';
    try {
      ids = await api.send(prepared.messages, `group-invitation/${prepared.batchId}`);
    } catch (error) {
      status =
        error instanceof InvitationError &&
        ['delivery_failed', 'provider_access_denied', 'configuration'].includes(error.code)
          ? 'failed'
          : 'unknown';
    }
    await executeZeroTransaction(ctx, async tx => {
      for (let index = 0; index < prepared.deliveryIds.length; index++)
        await rows(
          sqlTransaction(tx),
          `UPDATE group_invitations.group_email_invitation_delivery SET resend_email_id=$2,status=$3,error_code=$4 WHERE id=$1 AND status='sending'`,
          [
            prepared.deliveryIds[index],
            ids[index] ?? null,
            status,
            status === 'sent' ? null : `delivery_${status}`,
          ]
        );
    });
    console.info('group_invitation.delivery', {
      batchId: prepared.batchId,
      count: prepared.messages.length,
      status,
    });
    return {
      ...prepared.response,
      results: (prepared.response as { results: InvitationResult[] }).results.map(row =>
        row.status === 'sending' ? { ...row, status } : row
      ),
    };
  });
}

export async function handlePublicGroupInvitation(
  request: Request,
  token: string,
  deps: InvitationDeps = {}
) {
  return invitationResponse(async () => {
    if (!invitationTokenPattern.test(token)) throw new InvitationError('not_found', 404);
    const user = await (deps.user ?? getValidatedRequestUser)(request);
    if (request.method === 'POST' && !user) throw new InvitationError('unauthenticated', 401);
    const ctx = createZeroContext(user?.id ?? 'anon', user?.email);
    return withDeferredNotifications(() =>
      executeZeroTransaction(ctx, async tx => {
        const item = await invitation(tx, 'i.token_hash=$1', [tokenHash(token)]);
        const expired = item.expires_at !== null && Date.parse(item.expires_at) <= Date.now();
        const matchesEmail = !!user?.email && user.email.trim().toLowerCase() === item.email;
        const emailConfirmed = !!user?.email_confirmed_at;
        const account = user ? await tx.run(zql.user.where('id', user.id).one()) : null;
        if (request.method === 'GET') {
          const group = await tx.run(zql.group.where('id', item.group_id).one());
          const sender = await tx.run(zql.user.where('id', item.invited_by_id).one());
          return {
            groupName: group?.name ?? 'Polity',
            inviterName:
              [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') ||
              sender?.handle ||
              'Polity',
            maskedEmail: maskInvitationEmail(item.email),
            roles: item.role_names,
            expiresAt: item.expires_at,
            state: item.state === 'pending' && expired ? 'expired' : item.state,
            matchesEmail,
            emailConfirmed,
          };
        }
        if (!user) throw new InvitationError('unauthenticated', 401);
        // Return the original recipient's result even after an account email change.
        if (item.state === 'accepted' && item.accepted_by_id === user.id)
          return { accepted: true, groupId: item.group_id, needsOnboarding: !account?.first_name };
        if (!matchesEmail) throw new InvitationError('email_mismatch', 403);
        if (!emailConfirmed) throw new InvitationError('email_unconfirmed', 403);
        if (item.state !== 'pending' || expired)
          throw new InvitationError(
            expired || item.state === 'expired' ? 'expired' : 'revoked',
            410
          );
        const sender = { id: item.invited_by_id } as User;
        await authorizeGroup(tx, sender, item.group_id);
        if (item.role_ids.length !== item.role_count) throw new InvitationError('invalid_roles');
        await validateRoles(tx, item.group_id, item.role_ids);
        try {
          await groupSharedMutatorInternals.assertCanDirectlyMutateOfficialMembership(
            tx,
            item.group_id,
            user.id
          );
        } catch {
          throw new InvitationError('group_ineligible');
        }
        const senderCtx = createZeroContext(item.invited_by_id);
        let membership = await tx.run(
          zql.group_membership.where('group_id', item.group_id).where('user_id', user.id).one()
        );
        try {
          if (!membership) {
            const id = randomUUID();
            // Shared create avoids sending an additional in-app invite just before acceptance.
            await mutators.groups.inviteMember.fn({
              tx,
              ctx: senderCtx,
              args: {
                id,
                group_id: item.group_id,
                user_id: user.id,
                visibility: 'public',
                status: 'invited',
                initial_role_id: item.role_ids[0],
              },
            });
            membership = await tx.run(zql.group_membership.where('id', id).one());
          }
          if (!membership) throw new InvitationError('membership_conflict', 409);
          if (!['active', 'member', 'admin'].includes(membership.status ?? '')) {
            if (
              !['requested', 'invited'].includes(membership.status ?? '') ||
              membership.is_auto_managed ||
              membership.source !== 'direct'
            )
              throw new InvitationError('membership_conflict', 409);
            await mutators.groups.syncMembershipRoles.fn({
              tx,
              ctx: senderCtx,
              args: {
                group_membership_id: membership.id,
                role_ids: item.role_ids,
                assigned_by_id: item.invited_by_id,
              },
            });
            await groupServerMutators.acceptInvitation.fn({ tx, ctx, args: { id: membership.id } });
          }
        } catch (error) {
          if (error instanceof InvitationError || error instanceof PermissionError) throw error;
          throw new InvitationError('membership_conflict', 409);
        }
        await rows(
          sqlTransaction(tx),
          `UPDATE group_invitations.group_email_invitation SET state='accepted',accepted_at=now(),accepted_by_id=$2 WHERE id=$1`,
          [item.id, user.id]
        );
        console.info('group_invitation.accepted', { invitationId: item.id });
        return { accepted: true, groupId: item.group_id, needsOnboarding: !account?.first_name };
      })
    );
  });
}

const deliveryRanks: Record<string, number> = {
  sending: 0,
  unknown: 0,
  failed: 3,
  sent: 1,
  delivered: 2,
  bounced: 3,
  complained: 4,
};
export async function processInvitationWebhook(event: {
  type: string;
  created_at: string;
  data: unknown;
}) {
  const status = (
    {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.failed': 'failed',
    } as const
  )[event.type as 'email.sent'];
  if (!status) return;
  const data = event.data as {
    email_id?: string;
    tags?: { name: string; value: string }[] | Record<string, string>;
  };
  if (!data.email_id || !Number.isFinite(Date.parse(event.created_at))) return;
  await executeZeroTransaction(createZeroContext('anon'), async tx => {
    const tag = Array.isArray(data.tags)
      ? data.tags.find(tag => tag.name === 'group_invitation_delivery')?.value
      : data.tags?.group_invitation_delivery;
    const [delivery] = await rows<{ id: string; status: string; event_at: string | null }>(
      sqlTransaction(tx),
      `SELECT id,status,event_at FROM group_invitations.group_email_invitation_delivery WHERE resend_email_id=$1 OR (resend_email_id IS NULL AND id=$2::uuid AND status IN ('sending','unknown')) ORDER BY attempted_at DESC LIMIT 1 FOR UPDATE`,
      [data.email_id, z.uuid().safeParse(tag).success ? tag : null]
    );
    if (
      !delivery ||
      deliveryRanks[status] < deliveryRanks[delivery.status] ||
      (delivery.event_at && Date.parse(event.created_at) < Date.parse(delivery.event_at))
    )
      return;
    await rows(
      sqlTransaction(tx),
      `UPDATE group_invitations.group_email_invitation_delivery SET status=$2,event_at=$3,resend_email_id=$4 WHERE id=$1`,
      [delivery.id, status, event.created_at, data.email_id]
    );
  });
}
async function invitationResponse(work: () => Promise<unknown>) {
  try {
    return Response.json(await work(), {
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch (error) {
    const failure =
      error instanceof InvitationError
        ? error
        : error instanceof PermissionError
          ? new InvitationError('permission_denied', 403)
          : new InvitationError('server_error', 500);
    console.warn('group_invitation.error', { code: failure.code });
    return Response.json(
      { error: failure.code, ...failure.details },
      { status: failure.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
