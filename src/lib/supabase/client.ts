import { createBrowserClient } from '@supabase/ssr';
import { getRequiredEnvVar } from '@/lib/env';

export function createClient() {
  return createBrowserClient(
    getRequiredEnvVar(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
    getRequiredEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY')
  );
}
