import { z } from 'zod';

import type { Language } from '@/features/shared/global-state/language.store';
import { normalizeAuthLanguage } from './authLanguage';
import { getSafeAuthRedirect, type AllowedAuthRedirect } from './authRedirects';

const authCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).nullable(),
  next: z.string().nullable(),
});

export interface AuthCallbackUser {
  id: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
  identities?: { provider: string }[];
}

export interface AuthCallbackGateway {
  exchangeCodeForSession: (code: string) => Promise<{ error: { message: string } | null }>;
  getUser: () => Promise<{ user: AuthCallbackUser | null; error: { message: string } | null }>;
  updateLanguage: (language: Language) => Promise<{ error: { message: string } | null }>;
}

export type AuthCallbackOutcome =
  | {
      ok: true;
      destination: AllowedAuthRedirect;
      isNewUser: boolean;
      languageSynchronized: boolean;
    }
  | {
      ok: false;
      destination: '/auth/sign-in';
      reason: 'missing-session' | 'oauth-denied' | 'code-exchange-failed' | 'identity-mismatch';
    };

export async function completeAuthCallback(options: {
  gateway: AuthCallbackGateway;
  pendingLanguage: Language | null;
  search: string | URLSearchParams;
  now?: number;
  expectedLinkUserId?: string | null;
}): Promise<AuthCallbackOutcome> {
  const searchParams =
    typeof options.search === 'string' ? new URLSearchParams(options.search) : options.search;
  const query = authCallbackQuerySchema.parse({
    code: searchParams.get('code'),
    next: searchParams.get('next'),
  });
  const destination = getSafeAuthRedirect(query.next);
  const chatGptMode = searchParams.get('chatgpt');
  const strictChatGpt = chatGptMode === 'login' || chatGptMode === 'link';
  const failed = (
    reason: 'oauth-denied' | 'code-exchange-failed' | 'identity-mismatch'
  ): AuthCallbackOutcome => ({ ok: false, destination: '/auth/sign-in', reason });
  if (strictChatGpt && searchParams.has('error')) return failed('oauth-denied');
  if (strictChatGpt && !query.code) return failed('code-exchange-failed');

  if (query.code) {
    try {
      const exchange = await options.gateway.exchangeCodeForSession(query.code);
      if (exchange.error) {
        if (strictChatGpt) return failed('code-exchange-failed');
        console.warn(
          'Code exchange failed, falling back to an existing session:',
          exchange.error.message
        );
      }
    } catch (error) {
      if (strictChatGpt) return failed('code-exchange-failed');
      console.warn(
        'Code exchange threw, falling back to an existing session:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  let result = await options.gateway.getUser();
  if (!result.user?.id) {
    await new Promise(resolve => setTimeout(resolve, 500));
    result = await options.gateway.getUser();
  }
  const user = result.user;
  if (!user?.id || (strictChatGpt && result.error)) {
    return { ok: false, destination: '/auth/sign-in', reason: 'missing-session' };
  }
  if (
    strictChatGpt &&
    (!user.identities?.some(identity => identity.provider === 'custom:openai') ||
      (chatGptMode === 'link' &&
        (!options.expectedLinkUserId || user.id !== options.expectedLinkUserId)))
  )
    return failed('identity-mismatch');

  let languageSynchronized = false;
  if (
    options.pendingLanguage &&
    normalizeAuthLanguage(user.user_metadata.language) !== options.pendingLanguage
  ) {
    const update = await options.gateway.updateLanguage(options.pendingLanguage);
    if (update.error) {
      console.warn('Failed to synchronize Google auth language:', update.error.message);
    } else {
      languageSynchronized = true;
    }
  }

  const createdAt = new Date(user.created_at).getTime();
  const now = options.now ?? Date.now();
  return {
    ok: true,
    destination,
    isNewUser: Number.isFinite(createdAt) && now - createdAt < 300_000,
    languageSynchronized,
  };
}
