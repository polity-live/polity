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
