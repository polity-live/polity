import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeAuthCallback,
  type AuthCallbackGateway,
  type AuthCallbackUser,
} from '../logic/authCallbackService';

const NOW = Date.parse('2026-08-12T12:00:00.000Z');

function callbackUser(language = 'en'): AuthCallbackUser {
  return {
    id: 'callback-user',
    created_at: new Date(NOW - 600_000).toISOString(),
    user_metadata: { language },
  };
}

function createGateway(): AuthCallbackGateway & {
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  updateLanguage: ReturnType<typeof vi.fn>;
} {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ user: callbackUser(), error: null }),
    updateLanguage: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('ChatGPT callback service integration', () => {
  let gateway: ReturnType<typeof createGateway>;
  beforeEach(() => {
    gateway = createGateway();
  });
  it.each([
    '?chatgpt=login&error=access_denied',
    '?chatgpt=login',
    '?chatgpt=link&error=access_denied',
  ])(
    'rejects an aborted ChatGPT callback despite an existing Polity session (%s)',
    async search => {
      const result = await completeAuthCallback({ gateway, pendingLanguage: null, search });
      expect(result.ok).toBe(false);
      expect(gateway.getUser).not.toHaveBeenCalled();
      expect(gateway.exchangeCodeForSession).not.toHaveBeenCalled();
    }
  );

  it('never falls back to an old session after a failed ChatGPT code exchange', async () => {
    gateway.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });
    expect(
      await completeAuthCallback({
        gateway,
        pendingLanguage: null,
        search: '?chatgpt=login&code=expired',
      })
    ).toMatchObject({ ok: false, reason: 'code-exchange-failed' });
    expect(gateway.getUser).not.toHaveBeenCalled();
  });

  it('requires the verified ChatGPT identity and retains the original Polity account when linking', async () => {
    gateway.getUser.mockResolvedValue({
      user: { ...callbackUser(), identities: [{ provider: 'custom:openai' }] },
      error: null,
    });
    const options = { gateway, pendingLanguage: null, search: '?chatgpt=link&code=valid' };
    expect(
      await completeAuthCallback({ ...options, expectedLinkUserId: 'callback-user' })
    ).toMatchObject({ ok: true });
    expect(
      await completeAuthCallback({ ...options, expectedLinkUserId: 'different-user' })
    ).toMatchObject({ ok: false, reason: 'identity-mismatch' });
    expect(await completeAuthCallback(options)).toMatchObject({
      ok: false,
      reason: 'identity-mismatch',
    });
    gateway.getUser.mockResolvedValue({ user: callbackUser(), error: null });
    expect(
      await completeAuthCallback({
        gateway,
        pendingLanguage: null,
        search: '?chatgpt=login&code=valid',
      })
    ).toMatchObject({ ok: false, reason: 'identity-mismatch' });
  });
});
