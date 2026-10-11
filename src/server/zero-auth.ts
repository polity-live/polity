import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { getRequiredEnvVar } from '@/lib/env';

export interface ZeroAuthContext {
  userID: string;
  email: string;
}

let provider:
  | {
      url: string;
      key: string;
      client: ReturnType<typeof createSupabaseClient>;
      pending: Map<string, Promise<User | null>>;
    }
  | undefined;

function authProvider() {
  const url = getRequiredEnvVar(process.env.SUPABASE_URL, 'SUPABASE_URL');
  const key = getRequiredEnvVar(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY');
  if (!provider || provider.url !== url || provider.key !== key) {
    provider = {
      url,
      key,
      client: createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
      pending: new Map(),
    };
  }
  return provider;
}

/**
 * Extract the authenticated user from a request forwarded by zero-cache.
 * zero-cache forwards the auth token as an Authorization: Bearer header.
 * Falls back to anon if no valid auth is present.
 */
export async function getAuthFromRequest(request: Request): Promise<ZeroAuthContext> {
  const user = await getValidatedRequestUser(request);
  return user ? { userID: user.id, email: user.email ?? '' } : { userID: 'anon', email: '' };
}

/** Stateless validation shared by Query API and ordinary server functions. */
export async function getValidatedRequestUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const current = authProvider();
  const existing = current.pending.get(token);
  if (existing) return existing;
  // Only concurrent requests share work. Every later request checks Supabase again.
  const validation = current.client.auth
    .getUser(token)
    .then(({ data: { user }, error }) => {
      if (error || !user) {
        console.warn('[zero-auth] Token validation failed:', error?.message ?? 'no user returned');
        return null;
      }
      return user;
    })
    .finally(() => current.pending.delete(token));
  current.pending.set(token, validation);
  return validation;
}
