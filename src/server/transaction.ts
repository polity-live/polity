import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { currentAiTrace, traceAiOperation } from './ai-trace';
import { AiAccessError } from '@/lib/ai/errors';

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
  if (!currentAiTrace()) return tx.dbTransaction;
  return {
    query: async (sql, args) => {
      if (/\bai_(?:run|tool_call|trace|context_snapshot|change_set)\b/i.test(sql))
        return tx.dbTransaction.query(sql, args);
      return traceAiOperation(
        'database',
        sql.match(/(?:from|into|update)\s+([\w"]+)/i)?.[1] ?? 'query',
        {
          statement: sql,
          parameters: args.map((value, index) => ({
            index: index + 1,
            type: value === null ? 'null' : typeof value,
            empty: value === '',
          })),
        },
        async () => {
          for (const match of sql.matchAll(/\$(\d+)::uuid\b/g)) {
            if (args[Number(match[1]) - 1] === '')
              throw new AiAccessError('ai_invalid_identifier', `Empty UUID parameter ${match[1]}`);
          }
          return Array.from(await tx.dbTransaction.query(sql, args));
        }
      );
    },
  };
}
