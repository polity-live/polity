// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeChatGptLinkUser, isChatGptLoginEnabled, startChatGptAuth } from '../chatgptAuth';

describe('ChatGPT identity-only authentication', () => {
  const auth = { signInWithOAuth: vi.fn(), linkIdentity: vi.fn(), getUser: vi.fn() };
  const client = { auth } as unknown as SupabaseClient;
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    auth.linkIdentity.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'existing-polity-user' } }, error: null });
    vi.stubEnv('VITE_CHATGPT_LOGIN_ENABLED', 'false');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled by default and does not start an OAuth request', async () => {
    expect(isChatGptLoginEnabled()).toBe(false);
    await expect(startChatGptAuth(client, { mode: 'login', language: 'de' })).rejects.toThrow(
      'not enabled'
    );
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });
  it('requests identity scopes only and keeps the existing Supabase callback', async () => {
    vi.stubEnv('VITE_CHATGPT_LOGIN_ENABLED', 'true');
    await startChatGptAuth(client, { mode: 'login', language: 'de' });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'custom:openai',
      options: {
        scopes: 'openid profile email',
        redirectTo: `${window.location.origin}/auth/callback?chatgpt=login`,
      },
    });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });
  it('links a different-email identity to the authenticated Polity account', async () => {
    await startChatGptAuth(client, { mode: 'link', language: 'en', enabled: true });
    expect(auth.getUser).toHaveBeenCalledOnce();
    expect(auth.linkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'custom:openai' })
    );
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(consumeChatGptLinkUser()).toBe('existing-polity-user');
    expect(consumeChatGptLinkUser()).toBeNull();
  });
  it('does not link without a verified session and clears failed linking attempts', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(
      startChatGptAuth(client, { mode: 'link', language: 'en', enabled: true })
    ).rejects.toThrow('Sign in');
    expect(auth.linkIdentity).not.toHaveBeenCalled();
    auth.linkIdentity.mockResolvedValueOnce({ error: new Error('denied') });
    await expect(
      startChatGptAuth(client, { mode: 'link', language: 'en', enabled: true })
    ).rejects.toThrow('denied');
    expect(consumeChatGptLinkUser()).toBeNull();
  });
  it('clears a pending identity link when the OAuth gateway rejects before returning a result', async () => {
    auth.linkIdentity.mockRejectedValueOnce(new Error('Gateway unavailable'));
    await expect(
      startChatGptAuth(client, { mode: 'link', language: 'en', enabled: true })
    ).rejects.toThrow('Gateway unavailable');
    expect(consumeChatGptLinkUser()).toBeNull();
  });
});
