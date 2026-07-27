import { createClient } from '@/lib/supabase/client';
import { throwAppError, toAppError } from '@/features/shared/errors/app-error';

export async function pushApiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (!session?.access_token) throwAppError('permission_denied');

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: unknown };
  if (!response.ok) throw toAppError(body, 'push_operation_failed');
  return body;
}
