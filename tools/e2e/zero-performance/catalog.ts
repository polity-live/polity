import { isQuery } from '@rocicorp/zero';
import { queries } from '../../../src/zero/queries';
import source from './cases';
import { SEARCH_INITIAL_PAGE_LIMIT } from '../../../src/zero/preloads/search-context';

export const FIXTURE_ID = '10000000-0000-4000-8000-000000000001';
export const OWNER_ID = '20000000-0000-4000-8000-000000000002';
export const OUTSIDER_ID = '30000000-0000-4000-8000-000000000003';
export const FIXTURE_NOW = 1_800_000_000_000;
export const OWNER = { userID: OWNER_ID, email: 'owner@benchmark.local' };
export const OUTSIDER = { userID: OUTSIDER_ID, email: 'outsider@benchmark.local' };

interface RegisteredQuery {
  queryName: string;
  fn: (input: { args: unknown; ctx: { userID: string; email: string } }) => unknown;
}
export interface CaseDefinition {
  revision: number;
  reason: string;
  args: unknown;
  noArgs: boolean;
  table: string;
  anchor: string;
}
type Registry = typeof queries;
type Domain = Exclude<keyof Registry, '~'> & string;
type QueryName = { [D in Domain]: `${D}.${keyof Registry[D] & string}` }[Domain];
type QueryInput<Q> = Q extends (...args: infer A) => unknown
  ? A extends []
    ? null
    : Exclude<A[0], undefined>
  : never;
export type QueryCaseCatalog = {
  [N in QueryName]: N extends `${infer D extends Domain}.${infer K}`
    ? K extends keyof Registry[D]
      ? Omit<CaseDefinition, 'args'> & { args: QueryInput<Registry[D][K]> }
      : never
    : never;
};
export interface BenchmarkCase extends CaseDefinition {
  name: string;
  variant: string;
  query: RegisteredQuery;
}

export function discoverQueries(value: unknown = queries): Map<string, RegisteredQuery> {
  const found = new Map<string, RegisteredQuery>();
  function visit(tree: unknown) {
    if (!tree || typeof tree !== 'object') return;
    for (const [key, child] of Object.entries(tree)) {
      if (isQuery(child)) {
        if (found.has(child.queryName)) throw new Error(`Duplicate query ${child.queryName}`);
        found.set(child.queryName, child as RegisteredQuery);
      } else if (key !== '~') visit(child);
    }
  }
  visit(value);
  return found;
}

export function loadCases(
  registry = discoverQueries(),
  catalog: Record<string, CaseDefinition> = source
): BenchmarkCase[] {
  const missing = [...registry.keys()].filter(name => !catalog[name]);
  const stale = Object.keys(catalog).filter(name => !registry.has(name));
  if (missing.length || stale.length)
    throw new Error(
      `Query coverage failed. Missing: ${missing.join(', ')}; stale: ${stale.join(', ')}`
    );
  return [...registry].flatMap(([name, query]) => {
    const definition = catalog[name];
    if (
      !Number.isSafeInteger(definition.revision) ||
      definition.revision < 1 ||
      !definition.reason.trim()
    )
      throw new Error(`Invalid case revision/reason for ${name}`);
    // Calls the real Standard Schema validator and builder, rather than a mock.
    const args = definition.noArgs ? undefined : definition.args;
    const built = query.fn({ args, ctx: OWNER } as never) as { ast: { table: string } };
    if (built.ast.table !== definition.table)
      throw new Error(`Stale root table in ${name}: ${definition.table} != ${built.ast.table}`);
    const result: BenchmarkCase[] = [{ ...definition, name, query, variant: 'default' }];
    if (args && typeof args === 'object' && !Array.isArray(args)) {
      const object = args as Record<string, unknown>;
      if (name === 'users.fullProfile') {
        const { now: _now, ...legacyArgs } = object;
        result.push({
          ...definition,
          name,
          query,
          variant: 'legacy-time',
          args: legacyArgs,
          reason:
            'Legacy clients omit the statement-expiry cutoff; query construction must use current time rather than process-start time.',
        });
      }
      if (name === 'search.searchDocumentPage') {
        result.push({
          ...definition,
          name,
          query,
          variant: 'initial-grid',
          args: { ...object, limit: SEARCH_INITIAL_PAGE_LIMIT },
          reason:
            'The grid and its preload share the existing bounded 48-row window plus one look-ahead row, avoiding transient 19/37/49 queries during layout.',
        });
        result.push({
          ...definition,
          name,
          query,
          variant: 'initial-grid-search',
          args: {
            ...object,
            query: 'benchmark',
            types: ['group'],
            limit: SEARCH_INITIAL_PAGE_LIMIT,
          },
          reason:
            'A real group search uses the 49-row first window; its group parent and derived search index retain matching visibility.',
        });
      }
      for (const direction of ['dir', 'direction']) {
        if (object[direction] === 'forward')
          result.push({
            ...definition,
            name,
            query,
            variant: 'backward',
            args: { ...object, [direction]: 'backward' },
          });
      }
      if (object.sort === 'recent') {
        for (const sort of ['engagement', 'trending'])
          result.push({
            ...definition,
            name,
            query,
            variant: `sort-${sort}`,
            args: { ...object, sort },
          });
      }
      if (object.sort === 'votes')
        result.push({
          ...definition,
          name,
          query,
          variant: 'sort-time',
          args: { ...object, sort: 'time' },
        });
      if (object.query === '')
        result.push({
          ...definition,
          name,
          query,
          variant: 'search',
          args: { ...object, query: 'benchmark' },
        });
      if (object.direction === 'incoming')
        result.push({
          ...definition,
          name,
          query,
          variant: 'outgoing',
          args: { ...object, direction: 'outgoing' },
        });
      if (object.cursor === null)
        result.push({
          ...definition,
          name,
          query,
          variant: 'next-page',
          args: { ...object, cursor: { id: definition.anchor, created_at: FIXTURE_NOW } },
        });
      if (object.start === null)
        result.push({
          ...definition,
          name,
          query,
          variant: 'next-page',
          args: {
            ...object,
            start: {
              id: definition.anchor,
              created_at: FIXTURE_NOW,
              updated_at: FIXTURE_NOW,
              last_message_at: FIXTURE_NOW,
              pinned: false,
              upvotes: 0,
              downvotes: 0,
              start_date: FIXTURE_NOW,
              order_index: 0,
              engagement_score: 0,
              trending_score: 0,
            },
          },
        });
    }
    for (const entry of result)
      entry.query.fn({ args: entry.noArgs ? undefined : entry.args, ctx: OWNER } as never);
    return result;
  });
}

export function buildQuery(entry: BenchmarkCase, ctx = OWNER) {
  return entry.query.fn({ args: entry.noArgs ? undefined : entry.args, ctx } as never);
}
