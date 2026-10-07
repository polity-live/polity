import postgres from 'postgres';
import { z } from 'zod';
import type { AppErrorCode } from '@/features/shared/errors/app-error';
import { currentStudioTransaction } from './context';
let connection: ReturnType<typeof postgres> | undefined;
export function studioSql() {
  const active = currentStudioTransaction();
  if (active) return active as unknown as ReturnType<typeof postgres>;
  return (connection ??= postgres(
    process.env.STUDIO_DATABASE_URL || process.env.ZERO_UPSTREAM_DB || '',
    { max: 8, idle_timeout: 20, connect_timeout: 10 }
  ));
}
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: AppErrorCode
  ) {
    super(message);
  }
}
export async function assertStudioAccess(
  userId: string | null,
  projectId: string,
  edit = false,
  sql: ReturnType<typeof postgres> | postgres.TransactionSql = studioSql()
) {
  const [row] =
    await sql`select public.studio_access(${userId}::uuid,${projectId}::uuid,${edit}) as allowed`;
  if (!row?.allowed) throw new StudioError('No access to this studio project', 403);
}
export async function assertStudioCollaborationAccess(
  userId: string,
  projectId: string,
  sql: ReturnType<typeof postgres> | postgres.TransactionSql = studioSql()
) {
  if (
    !z.string().uuid().safeParse(userId).success ||
    !z.string().uuid().safeParse(projectId).success
  )
    throw new StudioError('Invalid Studio identifier', 400, 'ai_invalid_identifier');
  const [row] =
    await sql`select public.studio_collaboration_access(${userId}::uuid,${projectId}::uuid) as allowed`;
  if (!row?.allowed) throw new StudioError('No access to this studio workspace', 403);
}
export async function assertStudioGroup(
  userId: string,
  groupId: string,
  sql: ReturnType<typeof postgres> | postgres.TransactionSql = studioSql(),
  edit = false
) {
  const [row] =
    await sql`select public.studio_group_access(${userId}::uuid,${groupId}::uuid,${edit}) as allowed`;
  if (!row?.allowed) throw new StudioError('No access to this group', 403);
}
export async function studioTransaction<T>(
  body: (tx: postgres.TransactionSql) => Promise<T>,
  options: { readOnly?: boolean } = {}
) {
  const active = currentStudioTransaction();
  if (active) return body(active);
  return studioSql().begin(async tx => {
    // Concurrent readers may share authority. Writers, including membership and
    // phase changes, retain the exclusive lock and cannot pass a live reader.
    if (options.readOnly) await tx`select pg_advisory_xact_lock_shared(1886351981)`;
    else await tx`select pg_advisory_xact_lock(1886351981)`;
    const result = await body(tx);
    return result;
  });
}
