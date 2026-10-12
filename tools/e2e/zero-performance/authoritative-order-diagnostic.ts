import assert from 'node:assert/strict';
import type { Sql } from 'postgres';
import { schema } from '../../../src/zero/schema';
import { primaryKeys, resultIDs, rootSQL, type AST } from './oracle';

const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;

export function diagnosticRootSQL(ast: AST, columns: Parameters<typeof rootSQL>[1]) {
  // rootSQL remains revision-owned. Change only its outer SELECT projection;
  // its complete predicates, cursor, ordering, limit and bindings stay intact.
  const query = rootSQL(ast, columns);
  const table = (schema.tables as any)[ast.table];
  const fields = [
    ...new Set([...primaryKeys(ast.table), ...(ast.orderBy ?? []).map(([field]) => field)]),
  ];
  const projection = fields.flatMap(field => {
    const physical = table.columns[field]?.serverName ?? field;
    const raw = `t0.${identifier(physical)}`;
    const type = columns.get(table.serverName ?? ast.table)?.get(physical)?.type;
    return /timestamp/.test(type ?? '')
      ? [
          `${raw}::text AS ${identifier(`${field}__timestamp`)}`,
          `(extract(epoch from ${raw}) * 1000)::text AS ${identifier(`${field}__epoch_ms_exact`)}`,
          `(extract(epoch from ${raw}) * 1000)::double precision AS ${identifier(field)}`,
        ]
      : [`${raw} AS ${identifier(field)}`];
  });
  return {
    text: `SELECT ${projection.join(', ')}${query.text.slice(query.text.indexOf(' FROM public.'))}`,
    values: query.values,
  };
}

// Capture only a failed oracle's ordering inputs. Diagnostic I/O must never
// replace the original assertion or change the successful measurement path.
export async function assertAuthoritativeRootResult(
  sql: Sql,
  ast: AST,
  columns: Parameters<typeof rootSQL>[1],
  result: unknown,
  expected: string[],
  message: string,
  save: (diagnostic: unknown) => Promise<unknown>
) {
  try {
    assert.deepEqual(resultIDs(result, ast.table), expected, message);
  } catch (error) {
    try {
      const query = diagnosticRootSQL(ast, columns);
      const fields = [
        ...new Set([...primaryKeys(ast.table), ...(ast.orderBy ?? []).map(([field]) => field)]),
      ];
      const actualRows = (result == null ? [] : Array.isArray(result) ? result : [result]).map(
        row =>
          Object.fromEntries(fields.map(field => [field, (row as Record<string, unknown>)[field]]))
      );
      const sqlRows = await sql.unsafe(query.text, query.values as never[]);
      await save({
        protocol: 'zero-authoritative-order-diagnostic/v1',
        ast,
        query,
        expectedIDs: expected,
        actualIDs: resultIDs(result, ast.table),
        actualRows,
        sqlRows,
      });
    } catch {
      // Keep the authoritative assertion even if SQL or artifact capture fails.
    }
    throw error;
  }
}
