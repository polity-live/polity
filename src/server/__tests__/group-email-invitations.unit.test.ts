import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  availableInvitationBudget,
  createInvitationProvider,
  invitationConfig,
  maskInvitationEmail,
  tokenHash,
  type InvitationConfig,
} from '../group-email-invitations';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const config: InvitationConfig = {
  production: false,
  baseUrl: 'http://localhost:3000',
  apiKey: 'test-api-key',
  from: 'Polity <team@polity.live>',
  limit: 50,
  allowedRecipients: ['delivered@resend.dev'],
};
describe('Resend invitation provider', () => {
  it('maps unavailable quota HTTP responses separately from delivery errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private quota', { status: 429 }))
    );
    await expect(createInvitationProvider(config).usage()).rejects.toMatchObject({
      code: 'quota_unavailable',
      status: 503,
    });
  });
  it.each([400, 500, 403])('maps sending HTTP %s to a safe delivery failure', async status => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private', { status }))
    );
    await expect(createInvitationProvider(config).send([], 'key')).rejects.toMatchObject({
      code:
        status === 400
          ? 'delivery_failed'
          : status === 403
            ? 'provider_access_denied'
            : 'delivery_unknown',
    });
  });
  it.each(['network', 'json', 'shape', 'count', 'missing-id'])(
    'rejects uncertain batch sending responses: %s',
    async kind => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          if (kind === 'network') throw new Error('offline');
          if (kind === 'json') return new Response('bad json');
          return Response.json(
            kind === 'shape' ? {} : kind === 'count' ? { data: [] } : { data: [{}] }
          );
        })
      );
      await expect(
        createInvitationProvider(config).send(
          [{ from: config.from, to: ['a@example.com'], subject: 'Invite', html: 'mail', tags: [] }],
          'key'
        )
      ).rejects.toMatchObject({ code: 'delivery_unknown' });
    }
  );
  it('preserves ordered provider IDs and the batch idempotency header', async () => {
    const fetch = vi.fn(async () => Response.json({ data: [{ id: 'mail-1' }] }));
    vi.stubGlobal('fetch', fetch);
    const mail = {
      from: config.from,
      to: ['a@example.com'],
      subject: 'Invite',
      html: 'mail',
      tags: [],
    };
    expect(await createInvitationProvider(config).send([mail], 'key')).toEqual(['mail-1']);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails/batch',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'key' }),
        body: JSON.stringify([mail]),
      })
    );
  });
  it('retrieves usage without requiring a sending address', async () => {
    const usage = {
      emails: { daily: { used: 10, limit: 100 }, monthly: { used: 100, limit: 3000 } },
    };
    const fetch = vi.fn(async () => Response.json(usage));
    vi.stubGlobal('fetch', fetch);
    expect(await createInvitationProvider({ ...config, from: '' }).usage()).toEqual(usage);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/usage',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      })
    );
    expect(availableInvitationBudget(usage, 0, 0, 50)).toBe(45);
  });
  it('rejects missing keys and missing sending addresses before calling Resend', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(createInvitationProvider({ ...config, apiKey: '' }).usage()).rejects.toMatchObject(
      { code: 'configuration' }
    );
    await expect(
      createInvitationProvider({ ...config, from: '' }).send([], 'batch')
    ).rejects.toMatchObject({ code: 'configuration' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403])(
    'reports HTTP %s as denied access without logging provider content',
    async status => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ message: 'private provider payload' }, { status }))
      );
      await expect(createInvitationProvider(config).usage()).rejects.toMatchObject({
        code: 'provider_access_denied',
        status: 503,
      });
      expect(warn).toHaveBeenCalledWith('group_invitation.provider_error', {
        code: 'provider_access_denied',
        status,
        operation: 'usage',
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private provider payload');
      expect(JSON.stringify(warn.mock.calls)).not.toContain(config.apiKey);
    }
  );
  it('distinguishes transient usage failures from missing configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timeout', 'TimeoutError');
      })
    );
    await expect(createInvitationProvider(config).usage()).rejects.toMatchObject({
      code: 'quota_unavailable',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid JSON', { status: 200 }))
    );
    await expect(createInvitationProvider(config).usage()).rejects.toMatchObject({
      code: 'quota_unavailable',
    });
  });
});
describe('email invitation security and budget', () => {
  it('uses safe environment defaults and rejects credentials, URL suffixes and invalid daily limits', () => {
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', '');
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(invitationConfig()).toMatchObject({
      production: true,
      baseUrl: 'https://www.polity.live',
    });
    vi.stubEnv('NODE_ENV', 'test');
    expect(invitationConfig()).toMatchObject({
      production: false,
      baseUrl: 'http://localhost:3000',
    });
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', 'invalid');
    expect(() => invitationConfig()).toThrow('configuration');
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', 'development');
    for (const url of [
      'http://user:password@localhost:3000',
      'http://localhost:3000/path',
      'http://localhost:3000/?query=1',
      'http://localhost:3000/#hash',
    ]) {
      vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', url);
      expect(() => invitationConfig()).toThrow('configuration');
    }
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', 'http://127.0.0.1:3000');
    for (const limit of ['0', '101', '1.5', 'NaN']) {
      vi.stubEnv('GROUP_EMAIL_INVITATIONS_DAILY_LIMIT', limit);
      expect(() => invitationConfig()).toThrow('configuration');
    }
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_DAILY_LIMIT', '3');
    expect(invitationConfig().limit).toBe(3);
  });
  it('reserves half the provider quota and subtracts outstanding batches', () => {
    const usage = {
      emails: { daily: { used: 40, limit: 100 }, monthly: { used: 2_980, limit: 3_000 } },
    };
    expect(availableInvitationBudget(usage, 5, 3, 50)).toBe(7);
    expect(availableInvitationBudget(usage, 50, 0, 50)).toBe(0);
    expect(
      availableInvitationBudget(
        { emails: { daily: { used: 0, limit: null }, monthly: { used: 0, limit: 3_000 } } },
        0,
        0,
        50
      )
    ).toBe(50);
  });
  it('hashes tokens and masks the recipient local part', () => {
    expect(tokenHash('secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(maskInvitationEmail('person@example.com')).toBe('p***@example.com');
  });
  it('rejects production preview origins and malformed environment configuration', () => {
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', 'production');
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', 'https://preview.vercel.app');
    expect(() => invitationConfig()).toThrow('configuration');
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_BASE_URL', 'https://www.polity.live');
    expect(invitationConfig().baseUrl).toBe('https://www.polity.live');
    vi.stubEnv('GROUP_EMAIL_INVITATIONS_ENVIRONMENT', 'development');
    expect(() => invitationConfig()).toThrow('configuration');
  });
});
