import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';

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
  if (tx.location !== 'server') throw new Error('server_required');
  return tx.dbTransaction;
}
