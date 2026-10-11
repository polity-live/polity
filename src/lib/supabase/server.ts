import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getRequiredEnvVar } from '@/lib/env';
import { getValidatedRequestUser } from '@/server/zero-auth';

/**
 * Create a Supabase server client for use in TanStack Start server functions.
 * Uses service role key for admin operations.
 */
export function createClient() {
  return createSupabaseClient(
    getRequiredEnvVar(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    getRequiredEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  );
}

/**
 * Get session from request headers (for TanStack Start server functions).
 */
export async function getSession(request: Request) {
  const user = await getValidatedRequestUser(request);
  return user ? { user } : null;
}
