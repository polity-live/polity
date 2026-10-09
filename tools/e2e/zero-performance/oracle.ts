import { required } from './required';
import type { Sql } from 'postgres';
import { schema } from '../../../src/zero/schema';

// Structural AST adapter for the pinned Zero 1.9. Never imports private modules.
export interface AST {
  table: string;
  where?: any;
  orderBy?: readonly (readonly [string, string])[];
  limit?: number;
  start?: { row: Record<string, unknown>; exclusive: boolean };
  related?: { subquery: AST; correlation: { parentField: string[]; childField: string[] } }[];
}
export function queryAST(query: unknown): AST {
  const ast = (query as { ast?: AST }).ast;
  if (!ast?.table) throw new Error('Zero AST adapter is incompatible with the installed version');
  return ast;
}
export function primaryKeys(table: string): readonly string[] {
  const keys = (schema.tables as any)[table]?.primaryKey;
  if (!keys?.length) throw new Error(`Missing primary key for ${table}`);
  return keys;
}
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
export function rootSQL(ast: AST, columns: Map<string, Map<string, { type: string }>>) {
  const values: unknown[] = [];
  let nextAlias = 0;
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const table = (name: string) => {
    const entry = (schema.tables as any)[name];
    if (!entry) throw new Error(`Unknown table ${name}`);
    return entry.serverName ?? name;
  };
  const column = (name: string, alias: string, field: string) => {
    const physical = (schema.tables as any)[name].columns[field]?.serverName ?? field;
    const type = columns.get(table(name))?.get(physical)?.type;
    const sql = `${alias}.${identifier(physical)}`;
    return /timestamp/.test(type ?? '')
      ? `(extract(epoch from ${sql}) * 1000)`
      : type === 'uuid'
        ? `${sql}::text`
        : sql;
  };
  function predicate(condition: any, name: string, alias: string): string {
    if (!condition) return 'TRUE';
    if (condition.type === 'and' || condition.type === 'or')
      return `(${condition.conditions.map((c: any) => predicate(c, name, alias)).join(condition.type === 'and' ? ' AND ' : ' OR ') || (condition.type === 'and' ? 'TRUE' : 'FALSE')})`;
    if (condition.type === 'correlatedSubquery') {
      const related = condition.related;
      const child = `t${++nextAlias}`;
      const correlations = related.correlation.parentField.map(
        (f: string, i: number) =>
          `${column(name, alias, f)} = ${column(related.subquery.table, child, related.correlation.childField[i])}`
      );
      const exists = `EXISTS (SELECT 1 FROM public.${identifier(table(related.subquery.table))} ${child} WHERE ${[...correlations, predicate(related.subquery.where, related.subquery.table, child)].join(' AND ')})`;
      if (!['EXISTS', 'NOT EXISTS'].includes(condition.op))
        throw new Error(`Unsupported exists operator ${condition.op}`);
      return condition.op === 'NOT EXISTS' ? `NOT ${exists}` : exists;
    }
    if (condition.type !== 'simple') throw new Error(`Unsupported AST condition ${condition.type}`);
    const operand = (value: any) =>
      value.type === 'column'
        ? column(name, alias, value.name)
        : value.type === 'literal'
          ? bind(value.value ?? null)
          : (() => {
              throw new Error(`Unsupported operand ${value.type}`);
            })();
    const left = operand(condition.left);
    const right = condition.right.value;
    const op = condition.op;
    if (op === 'IN' || op === 'NOT IN') {
      if (!Array.isArray(right)) throw new Error('IN requires an array');
      return right.length
        ? `${left} ${op} (${right.map(bind).join(', ')})`
        : op === 'IN'
          ? 'FALSE'
          : 'TRUE';
    }
    if (op === 'IS' || op === 'IS NOT')
      return `${left} ${op === 'IS' ? 'IS NOT DISTINCT FROM' : 'IS DISTINCT FROM'} ${operand(condition.right)}`;
    if (!['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'NOT LIKE', 'ILIKE', 'NOT ILIKE'].includes(op))
      throw new Error(`Unsupported operator ${op}`);
    return `${left} ${op} ${operand(condition.right)}`;
  }
  const alias = 't0';
  // Zero appends missing primary-key columns in ascending order, including unordered limits.
  const effectiveOrder = [...(ast.orderBy ?? [])];
  for (const key of primaryKeys(ast.table))
    if (!effectiveOrder.some(([field]) => field === key)) effectiveOrder.push([key, 'asc']);
  let where = predicate(ast.where, ast.table, alias);
  if (ast.start) {
    const order = effectiveOrder;
    const branches = order.map(([field, direction], i) => {
      const equal = order
        .slice(0, i)
        .map(
          ([f]) =>
            `${column(ast.table, alias, f)} IS NOT DISTINCT FROM ${bind(required(ast.start).row[f])}`
        );
      return `(${[...equal, `${column(ast.table, alias, field)} ${direction === 'asc' ? '>' : '<'} ${bind(required(ast.start).row[field])}`].join(' AND ')})`;
    });
    if (!ast.start.exclusive)
      branches.push(
        `(${order.map(([f]) => `${column(ast.table, alias, f)} IS NOT DISTINCT FROM ${bind(required(ast.start).row[f])}`).join(' AND ')})`
      );
    where += ` AND (${branches.join(' OR ')})`;
  }
  const order = effectiveOrder.map(([field, direction]) => {
    if (!['asc', 'desc'].includes(direction)) throw new Error('Invalid ordering');
    return `${column(ast.table, alias, field)} ${direction} NULLS ${direction === 'asc' ? 'FIRST' : 'LAST'}`;
  });
  const keys = primaryKeys(ast.table);
  const keyProjection = keys
    .map((key, index) => `${column(ast.table, alias, key)}::text AS key${index}`)
    .join(', ');
  return {
    text: `SELECT ${keyProjection} FROM public.${identifier(table(ast.table))} ${alias} WHERE ${where}${order.length ? ` ORDER BY ${order.join(', ')}` : ''}${ast.limit !== undefined ? ` LIMIT ${bind(ast.limit)}` : ''}`,
    values,
  };
}
export async function expectedRootIDs(sql: Sql, ast: AST, columns: Parameters<typeof rootSQL>[1]) {
  const query = rootSQL(ast, columns);
  const rows = await sql.unsafe(query.text, query.values as never[]);
  const keys = primaryKeys(ast.table);
  return rows.map(row =>
    keys.length === 1
      ? String(row.key0)
      : JSON.stringify(keys.map((_, index) => String(row[`key${index}`])))
  );
}
export function resultIDs(result: unknown, table = 'user'): string[] {
  const rows = result == null ? [] : Array.isArray(result) ? result : [result];
  const keys = primaryKeys(table);
  return rows.map(row => {
    if (!row || typeof row !== 'object' || keys.some(key => !(key in row)))
      throw new Error('Unexpected query result shape');
    const values = keys.map(key => String((row as Record<string, unknown>)[key]));
    return values.length === 1 ? values[0] : JSON.stringify(values);
  });
}

export function relatedResultIDs(root: unknown, path: string): string[] {
  if (!path || path.split('.').some(part => !/^[a-z_]+$/.test(part)))
    throw new Error('Invalid related-result path');
  let values: any[] = [root];
  for (const part of path.split('.'))
    values = values.flatMap(value => {
      const nested = value?.[part];
      return nested == null ? [] : Array.isArray(nested) ? nested : [nested];
    });
  return resultIDs(values).sort();
}
