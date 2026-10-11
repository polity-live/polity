/**
 * A small relational evaluator for query result/authorization tests. Fixtures
 * contain their related rows, so the production predicates run unchanged.
 * Planner hints deliberately have no effect on the asserted result semantics.
 */
export type ResultRow = Record<string, any>;
type Predicate = (row: ResultRow) => boolean;

function rows(value: unknown): ResultRow[] {
  return Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
}

function comparison(field: string, operator: unknown, expected?: any): Predicate {
  if (arguments.length === 2) {
    expected = operator;
    operator = '=';
  }
  return row => {
    // Missing fixture columns represent SQL NULL, including IS/IS NOT checks.
    const value = row[field] ?? null;
    if (operator === 'IS') return value === expected;
    if (operator === 'IS NOT') return value !== expected;
    // SQL equality/order comparisons with NULL or a missing value never pass.
    if (value == null || expected == null) return false;
    switch (operator) {
      case '=':
        return value === expected;
      case '!=':
        return value !== expected;
      case '>':
        return value > expected;
      case '>=':
        return value >= expected;
      case '<':
        return value < expected;
      case '<=':
        return value <= expected;
      case 'IN':
        return (expected as unknown[]).includes(value);
      case 'ILIKE': {
        const pattern = String(expected)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(String(value));
      }
      default:
        throw new Error(`Unsupported result-test comparison: ${String(operator)}`);
    }
  };
}

export function resultQuery(): any {
  const predicates: Predicate[] = [];
  const ordering: [string, 'asc' | 'desc'][] = [];
  const projections = new Map<string, any>();
  let maximum = Infinity;
  let cursor: ResultRow | undefined;
  let inclusive = false;
  let single = false;
  const exists = (relation: string, callback: (query: any) => any) => {
    const child = callback(resultQuery());
    return (row: ResultRow) => child.matching(rows(row[relation])).length > 0;
  };
  const helpers = {
    cmp: comparison,
    and:
      (...terms: Predicate[]) =>
      (row: ResultRow) =>
        terms.every(term => term(row)),
    or:
      (...terms: Predicate[]) =>
      (row: ResultRow) =>
        terms.some(term => term(row)),
    exists,
  };
  const compare = (left: ResultRow, right: ResultRow) => {
    for (const [field, direction] of ordering) {
      const a = left[field],
        b = right[field];
      if (a === b) continue;
      const result = a == null ? -1 : b == null ? 1 : a < b ? -1 : 1;
      return direction === 'asc' ? result : -result;
    }
    return 0;
  };
  const query: any = {
    where: (...args: any[]) => {
      predicates.push(
        typeof args[0] === 'function'
          ? args[0](helpers)
          : comparison(...(args as [string, unknown, unknown]))
      );
      return query;
    },
    whereExists: (relation: string, callback: (child: any) => any) => {
      predicates.push(exists(relation, callback));
      return query;
    },
    related: (relation: string, callback?: (child: any) => any) => {
      const child = resultQuery();
      projections.set(relation, callback ? callback(child) : child);
      return query;
    },
    orderBy: (field: string, direction: 'asc' | 'desc') => {
      ordering.push([field, direction]);
      return query;
    },
    start: (value: ResultRow, options?: { inclusive: boolean }) => {
      cursor = value;
      inclusive = options?.inclusive ?? false;
      return query;
    },
    limit: (value: number) => {
      maximum = value;
      return query;
    },
    one: () => {
      single = true;
      maximum = 1;
      return query;
    },
    matching: (source: ResultRow[]) =>
      source.filter(row => predicates.every(predicate => predicate(row))),
    run: (source: ResultRow[]) => {
      const selected = query
        .matching(source)
        .toSorted(compare)
        .filter(
          (row: ResultRow) =>
            !cursor || compare(row, cursor) > 0 || (inclusive && compare(row, cursor) === 0)
        )
        .slice(0, maximum)
        .map((row: ResultRow) => {
          const projected = Object.fromEntries(
            Object.entries(row).filter(([, value]) => value == null || typeof value !== 'object')
          );
          for (const [relation, child] of projections) {
            const result = child.run(rows(row[relation]));
            projected[relation] = Array.isArray(result)
              ? Array.isArray(row[relation])
                ? result
                : result[0]
              : result;
          }
          return projected;
        });
      return single ? selected[0] : selected;
    },
  };
  return query;
}
