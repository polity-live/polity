import postgres from 'postgres';
let connection: ReturnType<typeof postgres> | undefined;
export function studioSql() {
  return (connection ??= postgres(
    process.env.STUDIO_DATABASE_URL || process.env.ZERO_UPSTREAM_DB || '',
    { max: 8, idle_timeout: 20, connect_timeout: 10 }
  ));
}
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400
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
  return studioSql().begin(async tx => {
    // Concurrent readers may share authority. Writers, including membership and
    // phase changes, retain the exclusive lock and cannot pass a live reader.
    if (options.readOnly) await tx`select pg_advisory_xact_lock_shared(1886351981)`;
    else await tx`select pg_advisory_xact_lock(1886351981)`;
    const result = await body(tx);
    return result;
  });
}
export function studioEnabled(userId: string) {
  const enabled =
    process.env.STUDIO_ENABLED === 'true' ||
    (process.env.STUDIO_ENABLED !== 'false' && process.env.NODE_ENV !== 'production');
  const pilot = (process.env.STUDIO_PILOT_USER_IDS || '').split(',').filter(Boolean);
  return enabled && (pilot.length === 0 || pilot.includes(userId));
}
export function studioV3Enabled(userId: string) {
  const configured = process.env.STUDIO_V3_ENABLED;
  if (configured === 'false') return false;
  if (configured === 'true') return studioEnabled(userId);
  return process.env.NODE_ENV !== 'production' && studioEnabled(userId);
}
export function canvasEnabled() {
  return (
    process.env.CANVAS_ENABLED === 'true' ||
    (process.env.CANVAS_ENABLED !== 'false' && process.env.NODE_ENV !== 'production')
  );
}
