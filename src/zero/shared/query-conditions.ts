/** Small literal sets avoid JSON list subqueries while preserving the IN predicate. */
export function whereAnyOf<T>(query: T, field: string, values: readonly unknown[]): T {
  const q = query as any;
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 32 ||
    values.some(value => value === null || value === undefined)
  )
    return q.where(field, 'IN', values) as T;
  if (values.length === 1) return q.where(({ cmp }: any) => cmp(field, '=', values[0])) as T;
  return q.where(({ or, cmp }: any) => or(...values.map(value => cmp(field, '=', value)))) as T;
}
