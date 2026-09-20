import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { CollaborationError } from '@/features/collaboration/logic/types';

export interface SqlTransaction {
  query(sql: string, args: unknown[]): Promise<Iterable<Record<string, unknown>>>;
}
export async function rows<T extends object = Record<string, unknown>>(
  tx: SqlTransaction,
  sql: string,
  args: unknown[] = []
): Promise<T[]> {
  return Array.from(await tx.query(sql, args)) as T[];
}
// First release serializes authority changes and commits. This intentionally favors
// correctness over throughput; finer grained locks require the same race tests.
export const AUTHORITY_LOCK = 1886351981;
export async function lockAuthority(tx: SqlTransaction) {
  await tx.query('select pg_advisory_xact_lock($1)', [AUTHORITY_LOCK]);
}
export function sqlTransaction(tx: Transaction<Schema>): SqlTransaction {
  if (tx.location !== 'server') throw new CollaborationError('server_required', 403);
  return tx.dbTransaction;
}
export async function migrationState(tx: SqlTransaction) {
  const [state] = await rows<{ phase: 'legacy' | 'maintenance' | 'active' }>(
    tx,
    'select phase from collaboration_control where singleton=true'
  );
  if (!state) throw new CollaborationError('collaboration_not_initialized', 503);
  return state.phase;
}
export async function assertActive(tx: SqlTransaction) {
  if ((await migrationState(tx)) !== 'active')
    throw new CollaborationError('collaboration_unavailable', 503);
}

/** A text entity belongs to at most one branch. Never select an arbitrary
 * branch: its phase and visibility determine both access and decision scope. */
export async function documentBranch(
  tx: SqlTransaction,
  entityId: string,
  requested: string | null = null
) {
  const branches = await rows<{ id: string }>(
    tx,
    'select id from amendment_process_branch where document_id=$1',
    [entityId]
  );
  if (branches.length > 1) throw new CollaborationError('ambiguous_document_branches');
  const branchId = branches[0]?.id ?? null;
  if (requested && requested !== branchId) throw new CollaborationError('invalid_branch', 403);
  return branchId;
}
