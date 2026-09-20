import postgres from 'postgres';
let connection: ReturnType<typeof postgres> | undefined;
export function studioSql() {
  return (connection ??= postgres(
    process.env.STUDIO_DATABASE_URL || process.env.ZERO_UPSTREAM_DB || '',
    { max: 3, idle_timeout: 20, connect_timeout: 10 }
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
  userId: string,
  projectId: string,
  edit = false,
  sql: ReturnType<typeof postgres> | postgres.TransactionSql = studioSql()
) {
  const [row] =
    await sql`select public.studio_access(${userId}::uuid,${projectId}::uuid,${edit}) as allowed`;
  if (!row?.allowed) throw new StudioError('No access to this studio project', 403);
}
export async function assertStudioGroup(
  userId: string,
  groupId: string,
  sql: ReturnType<typeof postgres> | postgres.TransactionSql = studioSql()
) {
  const [row] =
    await sql`select public.studio_group_access(${userId}::uuid,${groupId}::uuid,false) as allowed`;
  if (!row?.allowed) throw new StudioError('No access to this group', 403);
}
export async function studioTransaction<T>(body: (tx: postgres.TransactionSql) => Promise<T>) {
  return studioSql().begin(async tx => {
    await tx`select pg_advisory_xact_lock(1886351981)`;
    const [control] = await tx`select phase from collaboration_control where singleton`;
    if (control?.phase === 'maintenance') throw new StudioError('collaboration_maintenance', 503);
    const result = await body(tx);
    const { initializeTransactionDocuments } = await import('@/server/collaboration/finalize');
    await initializeTransactionDocuments({
      query: async (statement, args) =>
        Array.from(
          await tx.unsafe(
            statement,
            args.map(value =>
              value !== null && typeof value === 'object' && !(value instanceof Uint8Array)
                ? tx.json(value as postgres.JSONValue)
                : value
            ) as postgres.ParameterOrJSON<never>[]
          )
        ),
    });
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
