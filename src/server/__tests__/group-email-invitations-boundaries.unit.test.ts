import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { PermissionError } from '@/zero/rbac/errors';
import { invitationManagementSchema } from '@/features/groups/logic/emailInvitations';

const io = vi.hoisted(() => ({
  query: vi.fn(),
  run: vi.fn(),
  authorize: vi.fn(),
  group: vi.fn(),
  roles: vi.fn(),
  membership: vi.fn(),
  invite: vi.fn(),
  accept: vi.fn(),
  sync: vi.fn(),
  render: vi.fn(),
  user: vi.fn(),
  guest: vi.fn(),
}));
vi.mock('react-email', () => ({ render: io.render }));
vi.mock('@/server/zero-auth', () => ({ getValidatedRequestUser: io.user }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: (userID: string, email?: string) => ({ userID, email }),
  executeZeroTransaction: async (_: unknown, work: (tx: unknown) => unknown) =>
    work({ run: io.run }),
}));
vi.mock('@/server/transaction', () => ({
  sqlTransaction: (tx: unknown) => tx,
  rows: (_: unknown, sql: string, args: unknown[]) => io.query(sql, args),
}));
vi.mock('@/zero/rbac/can', () => ({ can: io.authorize }));
vi.mock('@/zero/groups/membership-helpers', () => ({ loadGroupWithDerivedNetworkMeta: io.group }));
vi.mock('@/zero/groups/shared-mutators', () => ({
  groupSharedMutatorInternals: {
    requiresGuestAccessFlow: io.guest,
    assertRolesAssignableToMembers: io.roles,
    assertCanDirectlyMutateOfficialMembership: io.membership,
  },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: { groups: { inviteMember: { fn: io.invite }, syncMembershipRoles: { fn: io.sync } } },
}));
vi.mock('@/zero/groups/server-mutators', () => ({
  groupServerMutators: { acceptInvitation: { fn: io.accept } },
}));
vi.mock('@/zero/server-notify', () => ({
  withDeferredNotifications: (body: () => unknown) => body(),
}));
vi.mock('@/zero/schema', () => {
  const table = (name: string) => ({
    table: name,
    where() {
      return this;
    },
    one() {
      return this;
    },
  });
  return {
    zql: {
      role: table('role'),
      user: table('user'),
      group: table('group'),
      group_membership: table('membership'),
    },
  };
});
import {
  handleGroupEmailInvitations,
  handlePublicGroupInvitation,
  InvitationError,
  processInvitationWebhook,
  tokenHash,
  type InvitationConfig,
} from '../group-email-invitations';

const [groupId, roleId, invitationId, actorId, key, deliveryId] = Array.from({ length: 6 }, () =>
  crypto.randomUUID()
);
const token = 'a'.repeat(43);
const actor = {
  id: actorId,
  email: 'recipient@example.com',
  email_confirmed_at: '2026-10-11',
} as User;
let config: InvitationConfig,
  item: any,
  group: any,
  prior: any,
  known: any[],
  matches: any[],
  others: any[],
  deliveries: any[],
  member: any;
const usage = vi.fn(),
  send = vi.fn();
const body = (extra: Record<string, unknown> = {}) => ({
  action: 'create',
  emails: ['recipient@example.com'],
  roleIds: [roleId],
  language: 'en',
  idempotencyKey: key,
  ...extra,
});
const admin = (input: unknown = body(), method = 'POST', id: string = groupId) =>
  handleGroupEmailInvitations(
    new Request('http://localhost/api', {
      method,
      ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
    }),
    id,
    { config, provider: { usage, send }, user: io.user }
  );
const publicRequest = (method = 'POST') =>
  handlePublicGroupInvitation(new Request('http://localhost/api', { method }), token, {
    user: io.user,
  });
async function fails(response: Promise<Response>, code: string, status = 400) {
  const result = await response;
  expect(result.status).toBe(status);
  expect(await result.json()).toMatchObject({ error: code });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  config = {
    production: true,
    baseUrl: 'https://www.polity.live',
    apiKey: 'fake',
    from: 'Sender',
    limit: 50,
    allowedRecipients: [],
  };
  item = {
    id: invitationId,
    group_id: groupId,
    email: actor.email,
    first_name: null,
    last_name: null,
    invited_by_id: actorId,
    language: 'en',
    role_count: 1,
    state: 'pending',
    expires_at: null,
    accepted_by_id: null,
    role_ids: [roleId],
    role_names: ['Member'],
  };
  group = { name: 'Group', group_type: 'base' };
  prior = null;
  known = [];
  matches = [];
  others = [];
  deliveries = [];
  member = { id: crypto.randomUUID(), status: 'active', source: 'direct' };
  io.user.mockResolvedValue(actor);
  io.guest.mockReturnValue(false);
  io.authorize.mockResolvedValue(undefined);
  io.group.mockImplementation(async () => group);
  io.roles.mockResolvedValue(true);
  io.membership.mockResolvedValue(undefined);
  io.render.mockResolvedValue('rendered-mail');
  usage.mockResolvedValue({
    emails: { daily: { used: 0, limit: 100 }, monthly: { used: 0, limit: 3000 } },
  });
  send.mockResolvedValue(['mail']);
  io.run.mockImplementation(async (query: { table: string }) =>
    query.table === 'role'
      ? [{ id: roleId, name: null }]
      : query.table === 'membership'
        ? member
        : query.table === 'user'
          ? { first_name: 'Recipient' }
          : group
  );
  io.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT i.*, ARRAY')) return item ? [item] : [];
    if (sql.startsWith('SELECT id,fingerprint,result')) return prior ? [prior] : [];
    if (sql.startsWith('SELECT invitation_id,status')) return deliveries;
    if (sql.includes('count(*) AS count')) return [{ count: '0', pending: '0' }];
    if (sql.includes('FROM auth.users a JOIN')) return matches;
    if (sql.startsWith('SELECT email FROM')) return [];
    if (sql.startsWith('SELECT EXISTS')) return [{ recent: false }];
    if (sql.startsWith('SELECT id FROM group_invitations')) return others;
    if (sql.startsWith('SELECT id FROM auth.users')) return known;
    return [];
  });
});

it.each(['hierarchical', 'guest', 'sibling-mode', 'sibling-disconnected'])(
  'rejects structurally ineligible groups before sending: %s',
  async reason => {
    if (reason === 'hierarchical') group.group_type = 'hierarchical';
    if (reason === 'guest') io.guest.mockReturnValue(true);
    if (reason.startsWith('sibling'))
      group = {
        group_type: 'sibling',
        primary_sibling_membership_mode: reason === 'sibling-mode' ? 'connected' : 'none',
        connected_group_id: reason === 'sibling-disconnected' ? null : groupId,
      };
    await fails(admin(), 'group_ineligible');
    expect(send).not.toHaveBeenCalled();
  }
);
it('recognizes an outstanding email invitation without an account membership', async () => {
  const query = io.query.getMockImplementation()!;
  io.query.mockImplementation(async (sql: string) =>
    sql.startsWith('SELECT email FROM') ? [{ email: actor.email }] : query(sql)
  );
  expect(await (await admin(body({ action: 'preview' }))).json()).toMatchObject({
    results: [{ status: 'invited' }],
  });
});
it('blocks resend cooldown and returns unnamed members without sending', async () => {
  io.query.mockReset().mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT i.*, ARRAY')) return [item];
    if (sql.startsWith('SELECT EXISTS')) return [{ recent: true }];
    return [];
  });
  await fails(
    admin({ action: 'resend', invitationId, idempotencyKey: key }),
    'resend_cooldown',
    429
  );
  io.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT i.*, ARRAY')) return [item];
    if (sql.startsWith('SELECT EXISTS')) return [{ recent: false }];
    if (sql.includes('FROM auth.users a JOIN')) return [{ email: actor.email, status: 'member' }];
    if (sql.includes('count(*) AS count')) return [{ count: '0', pending: '0' }];
    return [];
  });
  expect(
    await (await admin({ action: 'resend', invitationId, idempotencyKey: key })).json()
  ).toMatchObject({ results: [{ status: 'member' }] });
  expect(send).not.toHaveBeenCalled();
});
it('returns fresh delivery status from an idempotent receipt', async () => {
  prior = {
    id: key,
    fingerprint: tokenHash(
      JSON.stringify({
        groupId,
        ...invitationManagementSchema.parse(body()),
        idempotencyKey: undefined,
      })
    ),
    result: { results: [{ email: actor.email, invitationId, status: 'sent' }], available: 2 },
  };
  deliveries = [
    { invitation_id: invitationId, status: 'delivered', attempted_at: new Date().toISOString() },
  ];
  expect(await (await admin()).json()).toMatchObject({ results: [{ status: 'delivered' }] });
  expect(send).not.toHaveBeenCalled();
});
it.each(['active', 'invited', 'new'])(
  'accepts authorized invitations and records canonical membership: %s',
  async mode => {
    if (mode === 'invited') member.status = 'invited';
    if (mode === 'new') {
      io.run.mockImplementation(async (query: { table: string }) => {
        if (query.table === 'user') return null;
        if (query.table === 'membership')
          return io.invite.mock.calls.length
            ? { id: invitationId, status: 'requested', source: 'direct' }
            : null;
        return group;
      });
    }
    expect(await (await publicRequest()).json()).toEqual({
      accepted: true,
      groupId,
      needsOnboarding: mode === 'new',
    });
    expect(io.query).toHaveBeenCalledWith(expect.stringContaining("SET state='accepted'"), [
      invitationId,
      actorId,
    ]);
    expect(io.accept).toHaveBeenCalledTimes(mode === 'active' ? 0 : 1);
    expect(io.invite).toHaveBeenCalledTimes(mode === 'new' ? 1 : 0);
  }
);
it('replays acceptance for the original recipient after their email changes', async () => {
  item.state = 'accepted';
  item.accepted_by_id = actorId;
  item.email = 'old@example.com';
  expect(await (await publicRequest()).json()).toEqual({
    accepted: true,
    groupId,
    needsOnboarding: false,
  });
  expect(io.authorize).not.toHaveBeenCalled();
});
it.each([
  'wrong-recipient',
  'unconfirmed',
  'expired-time',
  'expired-state',
  'revoked',
  'accepted-other',
])('rejects public acceptance before membership mutation: %s', async mode => {
  if (mode === 'wrong-recipient') item.email = 'other@example.com';
  if (mode === 'unconfirmed') io.user.mockResolvedValue({ ...actor, email_confirmed_at: null });
  if (mode === 'expired-time') item.expires_at = new Date(Date.now() - 1).toISOString();
  if (mode === 'expired-state') item.state = 'expired';
  if (mode === 'revoked') item.state = 'revoked';
  if (mode === 'accepted-other') {
    item.state = 'accepted';
    item.accepted_by_id = key;
  }
  await fails(
    publicRequest(),
    mode === 'wrong-recipient'
      ? 'email_mismatch'
      : mode === 'unconfirmed'
        ? 'email_unconfirmed'
        : mode.startsWith('expired')
          ? 'expired'
          : 'revoked',
    ['wrong-recipient', 'unconfirmed'].includes(mode) ? 403 : 410
  );
  expect(io.accept).not.toHaveBeenCalled();
});
it.each([
  { tags: [] },
  {
    tags: [
      { name: 'other', value: 'ignored' },
      { name: 'group_invitation_delivery', value: deliveryId },
    ],
  },
])('applies ranked delivery webhooks with validated array tags: %j', async ({ tags }) => {
  io.query.mockResolvedValueOnce([{ id: deliveryId, status: 'sent', event_at: null }]);
  await processInvitationWebhook({
    type: 'email.delivered',
    created_at: '2026-10-11T00:00:00Z',
    data: { email_id: 'mail', tags },
  });
  expect(io.query.mock.calls[0][1]).toEqual(['mail', tags.length ? deliveryId : null]);
  expect(io.query).toHaveBeenLastCalledWith(expect.stringContaining('SET status=$2'), [
    deliveryId,
    'delivered',
    '2026-10-11T00:00:00Z',
    'mail',
  ]);
});

it('rejects invalid groups, absent accounts and malformed JSON before a transaction can send', async () => {
  await fails(admin(body(), 'POST', 'bad'), 'invalid_request');
  io.user.mockResolvedValueOnce(null);
  await fails(admin(), 'unauthenticated', 401);
  await fails(
    handleGroupEmailInvitations(
      new Request('http://localhost/api', { method: 'POST', body: 'bad-json' }),
      groupId,
      { config, provider: { usage, send }, user: io.user }
    ),
    'invalid_request'
  );
  expect(send).not.toHaveBeenCalled();
});
it.each([new Error('down'), new PermissionError('manage', 'groupMemberships')])(
  'maps authorization failures without sending provider content: %s',
  async error => {
    io.authorize.mockRejectedValueOnce(error);
    await fails(
      admin(),
      error instanceof PermissionError ? 'permission_denied' : 'server_error',
      error instanceof PermissionError ? 403 : 500
    );
    expect(send).not.toHaveBeenCalled();
  }
);
it('rejects groups removed after permission checks', async () => {
  group = null;
  await fails(admin(), 'not_found', 404);
});
it.each([
  {},
  { emails: ['bad'] },
  { emails: Array.from({ length: 101 }, (_, i) => `a${i}@example.com`) },
  {
    emails: undefined,
    recipients: [
      { email: 'a@example.com', firstName: 'A' },
      { email: 'a@example.com', firstName: 'B' },
    ],
  },
])('rejects invalid recipient batches %j', async extra => {
  const input = body(extra);
  if (!Object.keys(extra).length) input.emails = [];
  await fails(admin(input), 'recipients' in extra ? 'invalid_names' : 'invalid_emails');
  expect(send).not.toHaveBeenCalled();
});
it('requires an idempotency key for sending', async () => {
  await fails(admin(body({ idempotencyKey: undefined })), 'invalid_request');
});
it.each([new Error('provider unavailable'), new InvitationError('quota_unavailable', 503)])(
  'rejects unavailable usage without reserving a batch: %s',
  async error => {
    usage.mockRejectedValueOnce(error);
    await fails(admin(), 'quota_unavailable', 503);
    expect(send).not.toHaveBeenCalled();
  }
);
it.each([
  undefined,
  { emails: {} },
  { emails: { daily: { used: 0, limit: Infinity }, monthly: { used: 0, limit: 100 } } },
  { emails: { daily: { used: 0, limit: null }, monthly: { used: 0, limit: Infinity } } },
])('rejects malformed quota telemetry %j', async value => {
  usage.mockResolvedValueOnce(value);
  await fails(admin(), 'quota_unavailable', 503);
});
it.each(['apiKey', 'from'] as const)('blocks missing sending configuration %s', async field => {
  config[field] = '';
  await fails(admin(), 'configuration', 503);
});
it('does not send batches beyond the reserved provider budget', async () => {
  usage.mockResolvedValueOnce({
    emails: { daily: { used: 100, limit: 100 }, monthly: { used: 0, limit: 3000 } },
  });
  await fails(admin(), 'quota_exceeded', 429);
  expect(send).not.toHaveBeenCalled();
});
it.each([false, true])(
  'requires confirmed connected-group membership for sibling recipients, membership rejected=%s',
  async rejected => {
    group = {
      group_type: 'sibling',
      primary_sibling_membership_mode: 'none',
      connected_group_id: groupId,
    };
    if (rejected) {
      known = [{ id: actorId }];
      io.membership.mockRejectedValueOnce(new Error('ineligible'));
    }
    await fails(admin(), 'group_ineligible');
    expect(send).not.toHaveBeenCalled();
  }
);
it('replays a JSON-stored batch and turns stale sending deliveries into unknown without resending', async () => {
  const input = body();
  prior = {
    id: key,
    fingerprint: tokenHash(
      JSON.stringify({
        groupId,
        ...invitationManagementSchema.parse(input),
        idempotencyKey: undefined,
      })
    ),
    result: JSON.stringify({
      available: 4,
      results: [
        { email: actor.email, invitationId, status: 'sending' },
        { email: 'unchanged@example.com', status: 'member' },
      ],
    }),
  };
  deliveries = [
    {
      invitation_id: invitationId,
      status: 'sending',
      attempted_at: new Date(Date.now() - 121000).toISOString(),
    },
  ];
  expect(await (await admin(input)).json()).toMatchObject({
    available: 4,
    results: [{ status: 'unknown' }, { status: 'member' }],
  });
  expect(send).not.toHaveBeenCalled();
});
it.each(['delivery_failed', 'provider_access_denied', 'unknown'])(
  'records final delivery status for send failure %s',
  async code => {
    send.mockRejectedValueOnce(
      code === 'unknown' ? new Error('connection lost') : new InvitationError(code)
    );
    const result = await (await admin()).json();
    expect(result.results[0].status).toBe(code === 'unknown' ? 'unknown' : 'failed');
    expect(io.query).toHaveBeenCalledWith(
      expect.stringContaining("status='sending'"),
      expect.arrayContaining([null, code === 'unknown' ? 'unknown' : 'failed'])
    );
  }
);
it('uses safe fallback names when creating a German invitation and preserves non-ready results', async () => {
  group.name = null;
  matches = [{ email: 'member@example.com', status: 'active' }];
  await admin(body({ emails: ['recipient@example.com', 'member@example.com'], language: 'de' }));
  expect(send.mock.calls[0][0][0]).toMatchObject({ subject: 'Einladung zur Gruppe Polity' });
  expect(io.render.mock.calls[0][0].props).toMatchObject({
    groupName: 'Polity',
    inviterName: 'Polity',
    roles: [''],
  });
});
it.each(['other-invite', 'wrong-roles'])('rejects invalid resend state %s', async reason => {
  if (reason === 'other-invite') others = [{ id: key }];
  else item.role_count = 2;
  await fails(
    admin(body({ action: 'resend', invitationId })),
    reason === 'other-invite' ? 'already_invited' : 'invalid_roles',
    reason === 'other-invite' ? 409 : 400
  );
});
it('resends an existing named invitation without losing its names', async () => {
  item.first_name = 'Ada';
  item.last_name = 'Lovelace';
  expect(
    await (await admin({ action: 'resend', invitationId, idempotencyKey: key })).json()
  ).toMatchObject({ results: [{ firstName: 'Ada', lastName: 'Lovelace', status: 'sent' }] });
});
it('reports unavailable public invitation records and unauthenticated methods', async () => {
  await fails(
    handlePublicGroupInvitation(new Request('http://localhost/api'), 'invalid', { user: io.user }),
    'not_found',
    404
  );
  item = null;
  await fails(publicRequest('GET'), 'not_found', 404);
  io.user.mockResolvedValue(null);
  await fails(publicRequest(), 'unauthenticated', 401);
  item = { id: invitationId, expires_at: null };
  await fails(publicRequest('PUT'), 'unauthenticated', 401);
});
it('provides privacy-safe fallback public names and marks expired pending invitations', async () => {
  io.user.mockResolvedValue(null);
  io.run.mockResolvedValue(null);
  item.expires_at = new Date(Date.now() - 1).toISOString();
  expect(await (await publicRequest('GET')).json()).toMatchObject({
    groupName: 'Polity',
    inviterName: 'Polity',
    state: 'expired',
    matchesEmail: false,
    emailConfirmed: false,
  });
});
it.each(['roles', 'membership', 'lost-member', 'unknown-status', 'mutator-error', 'permission'])(
  'fails closed when acceptance loses authority or membership: %s',
  async reason => {
    if (reason === 'roles') item.role_count = 2;
    if (reason === 'membership') io.membership.mockRejectedValueOnce(new Error('revoked'));
    if (reason === 'lost-member') member = null;
    if (reason === 'unknown-status') member.status = null;
    if (reason === 'mutator-error' || reason === 'permission') {
      member.status = 'invited';
      io.accept.mockRejectedValueOnce(
        reason === 'permission'
          ? new PermissionError('manage', 'groupMemberships')
          : new Error('conflict')
      );
    }
    await fails(
      publicRequest(),
      reason === 'roles'
        ? 'invalid_roles'
        : reason === 'membership'
          ? 'group_ineligible'
          : reason === 'permission'
            ? 'permission_denied'
            : 'membership_conflict',
      reason === 'permission' ? 403 : ['roles', 'membership'].includes(reason) ? 400 : 409
    );
    expect(io.query.mock.calls.some(([sql]) => sql.includes("SET state='accepted'"))).toBe(false);
  }
);
it.each([{}, { email_id: 'mail' }, { email_id: 'mail', tags: [] }])(
  'ignores webhook events without a usable timestamp or identity %j',
  async data => {
    await processInvitationWebhook({ type: 'email.sent', created_at: 'invalid', data });
    expect(io.query).not.toHaveBeenCalled();
  }
);
it('ignores an out-of-order webhook for the same delivery', async () => {
  io.query.mockResolvedValueOnce([
    { id: deliveryId, status: 'sent', event_at: '2026-10-12T00:00:00Z' },
  ]);
  await processInvitationWebhook({
    type: 'email.delivered',
    created_at: '2026-10-11T00:00:00Z',
    data: { email_id: 'mail' },
  });
  expect(io.query).toHaveBeenCalledTimes(1);
});

it('lists invitations through default configured authentication and provider boundaries', async () => {
  vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', 'production');
  vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', 'https://www.polity.live');
  vi.stubEnv('RESEND_API_KEY', 'fake');
  try {
    const response = await handleGroupEmailInvitations(
      new Request('http://localhost/api'),
      groupId
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invitations: [] });
    expect(io.query.mock.calls.some(([sql]) => sql.includes("state='expired'"))).toBe(true);
    expect(io.authorize).toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
it.each(['accepted', 'pending'])(
  'revoke refuses accepted invitations and persists pending revocation: %s',
  async state => {
    item.state = state;
    const response = admin({ action: 'revoke', invitationId });
    if (state === 'accepted') await fails(response, 'already_accepted');
    else {
      expect(await (await response).json()).toEqual({ revoked: true });
      expect(io.query).toHaveBeenCalledWith(expect.stringContaining("state='revoked'"), [
        invitationId,
      ]);
    }
    expect(send).not.toHaveBeenCalled();
  }
);
it.each(['accepted', 'revoked'])('rejects terminal resend states %s', async state => {
  item.state = state;
  await fails(admin({ action: 'resend', invitationId, idempotencyKey: key }), 'invalid_state');
});
it.each(['empty', 'rejected', 'throw'])(
  'rejects unassignable saved resend roles: %s',
  async reason => {
    if (reason === 'empty') {
      item.role_ids = [];
      item.role_count = 0;
    } else if (reason === 'rejected') io.roles.mockResolvedValueOnce(false);
    else io.roles.mockRejectedValueOnce(new Error('removed role'));
    await fails(admin({ action: 'resend', invitationId, idempotencyKey: key }), 'invalid_roles');
    expect(send).not.toHaveBeenCalled();
  }
);
it('returns preview classifications without sending and enforces development recipient allowlisting', async () => {
  matches = [{ email: actor.email, status: 'invited' }];
  expect(await (await admin(body({ action: 'preview' }))).json()).toMatchObject({
    results: [{ status: 'invited' }],
  });
  matches = [];
  config.production = false;
  await fails(admin(), 'recipient_not_allowed');
  config.allowedRecipients = [actor.email!];
  group.name = null;
  expect((await admin()).status).toBe(200);
  expect(send.mock.calls[0][0][0].subject).toBe('Invitation to Polity');
});
it('rejects reused idempotency keys with different inputs and accepts stored object receipts unchanged', async () => {
  prior = { id: key, fingerprint: 'wrong', result: { results: [], available: 1 } };
  await fails(admin(), 'idempotency_conflict', 409);
  prior.fingerprint = tokenHash(
    JSON.stringify({
      groupId,
      ...invitationManagementSchema.parse(body()),
      idempotencyKey: undefined,
    })
  );
  expect(await (await admin()).json()).toEqual({ results: [], available: 1 });
  expect(send).not.toHaveBeenCalled();
});
it('supports public default authentication and ignores unsupported webhook types', async () => {
  expect(
    (await handlePublicGroupInvitation(new Request('http://localhost/api'), token)).status
  ).toBe(200);
  io.query.mockClear();
  await processInvitationWebhook({
    type: 'email.unsubscribed',
    created_at: '2026-10-11',
    data: { email_id: 'mail' },
  });
  expect(io.query).not.toHaveBeenCalled();
});
