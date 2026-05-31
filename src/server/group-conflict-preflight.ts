import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/start-server-core';
import { getSession } from '@/lib/supabase/server';
import { createZeroContext, executeZeroRead } from '@/server/zero-mutate';
import {
  groupConflictPreflightSchema,
  type GroupConflictPreflightInput,
} from '@/features/groups/logic/groupConflictPreflight';
import { resolveGroupConflictPreflight } from './group-conflict-validation';

export const groupConflictPreflightFn = createServerFn({ method: 'POST' })
  .validator(groupConflictPreflightSchema.parse)
  .handler(
    async ({ data }): Promise<Awaited<ReturnType<typeof executeGroupConflictPreflight>>> =>
      executeGroupConflictPreflight(data)
  );

async function executeGroupConflictPreflight(data: GroupConflictPreflightInput) {
  const request = getWebRequest();
  if (!request) {
    throw new Error('Request context unavailable.');
  }

  const session = await getSession(request);
  const ctx = createZeroContext(session?.user.id ?? 'anon', session?.user.email ?? '');

  return executeZeroRead(async tx => resolveGroupConflictPreflight(tx, ctx, data));
}
