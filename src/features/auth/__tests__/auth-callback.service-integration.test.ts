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

describe('auth callback service integration', () => {
  let gateway: ReturnType<typeof createGateway>;

  beforeEach(() => {
    gateway = createGateway();
  });

  it('parses a valid callback, exchanges the code and synchronizes the pending language', async () => {
    await expect(
      completeAuthCallback({
        gateway,
        pendingLanguage: 'de',
        search: '?code=valid&next=/auth/reset-password',
        now: NOW,
      })
    ).resolves.toEqual({
      ok: true,
      destination: '/auth/reset-password',
      isNewUser: false,
      languageSynchronized: true,
    });

    expect(gateway.exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(gateway.updateLanguage).toHaveBeenCalledWith('de');
  });

  it('fails closed for an expired code when no fallback session exists', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    gateway.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });
    gateway.getUser.mockResolvedValue({ user: null, error: { message: 'missing session' } });

    await expect(
      completeAuthCallback({
        gateway,
        pendingLanguage: null,
        search: '?code=expired',
        now: NOW,
      })
    ).resolves.toEqual({
      ok: false,
      destination: '/auth/sign-in',
      reason: 'missing-session',
    });
    expect(gateway.getUser).toHaveBeenCalledTimes(2);
  });

  it('normalizes an external redirect to the repository-safe home destination', async () => {
    const outcome = await completeAuthCallback({
      gateway,
      pendingLanguage: null,
      search: '?code=valid&next=https://attacker.invalid/collect',
      now: NOW,
    });

    expect(outcome).toMatchObject({ ok: true, destination: '/' });
    expect(gateway.updateLanguage).not.toHaveBeenCalled();
  });

  it('accepts URLSearchParams and falls back to the existing session when exchange throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    gateway.exchangeCodeForSession.mockRejectedValue('network unavailable');

    await expect(
      completeAuthCallback({
        gateway,
        pendingLanguage: null,
        search: new URLSearchParams('code=valid&next=/'),
        now: NOW,
      })
    ).resolves.toMatchObject({ ok: true, destination: '/' });

    expect(console.warn).toHaveBeenCalledWith(
      'Code exchange threw, falling back to an existing session:',
      'network unavailable'
    );
  });
});
