import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';

interface StudioTransactionContext {
  sql: postgres.TransactionSql;
  operationId: string;
  sequence: number;
}
const context = new AsyncLocalStorage<StudioTransactionContext>();
export function currentStudioTransaction() {
  return context.getStore()?.sql;
}
export function withStudioTransaction<T>(
  sql: postgres.TransactionSql,
  operationId: string,
  body: () => Promise<T>
) {
  return context.run({ sql, operationId, sequence: 0 }, body);
}
export function studioId(key?: string): string {
  const active = context.getStore();
  if (!active) return randomUUID();
  const hash = createHash('sha256')
    .update(`${active.operationId}:${key ?? active.sequence++}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
