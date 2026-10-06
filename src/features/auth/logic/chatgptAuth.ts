import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthRedirectUrl } from './authRedirects';
import { storePendingGoogleLanguage } from './authLanguage';
import type { Language } from '@/features/shared/global-state/language.store';

export const CHATGPT_AUTH_PROVIDER = 'custom:openai' as const;
const LINK_USER_KEY = 'polity_chatgpt_link_user';

export function isChatGptLoginEnabled(): boolean {
  return import.meta.env.VITE_CHATGPT_LOGIN_ENABLED === 'true';
}

export function consumeChatGptLinkUser(): string | null {
  const userId = window.sessionStorage.getItem(LINK_USER_KEY);
  window.sessionStorage.removeItem(LINK_USER_KEY);
  return userId;
}

/** Identity only: never requests or stores inference credentials. */
export async function startChatGptAuth(
  supabase: SupabaseClient,
  options: { mode: 'login' | 'link'; language: Language; enabled?: boolean }
) {
  if (!(options.enabled ?? isChatGptLoginEnabled()))
    throw new Error('ChatGPT sign-in is not enabled.');
  if (options.mode === 'link') {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error('Sign in to Polity before linking ChatGPT.');
    window.sessionStorage.setItem(LINK_USER_KEY, data.user.id);
  } else {
    window.sessionStorage.removeItem(LINK_USER_KEY);
  }
  storePendingGoogleLanguage(options.language);
  const request = {
    provider: CHATGPT_AUTH_PROVIDER,
    options: {
      scopes: 'openid profile email',
      redirectTo: getAuthRedirectUrl(`/auth/callback?chatgpt=${options.mode}`),
    },
  };
  try {
    const result =
      options.mode === 'link'
        ? await supabase.auth.linkIdentity(request)
        : await supabase.auth.signInWithOAuth(request);
    if (result.error) throw result.error;
  } catch (error) {
    window.sessionStorage.removeItem(LINK_USER_KEY);
    throw error;
  }
}
