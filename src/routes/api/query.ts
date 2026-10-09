import { createFileRoute } from '@tanstack/react-router';
import { handleQueryRequest, type TransformQueryFunction } from '@rocicorp/zero/server';
import { mustGetQuery } from '@rocicorp/zero';
import { queries } from '@/zero/queries';
import { schema } from '@/zero/schema';
import { getAuthFromRequest } from '@/server/zero-auth';
import {
  queryDiagnostic,
  queryStructure,
  withQueryDiagnostics,
} from '@/server/zero-query-diagnostics';

export const Route = createFileRoute('/api/query')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withQueryDiagnostics(async () => {
          const authAt = performance.now();
          const ctx = await getAuthFromRequest(request);
          queryDiagnostic('auth', authAt);
          interface DynamicQuery {
            fn: (input: { args: unknown; ctx: typeof ctx }) => ReturnType<TransformQueryFunction>;
          }

          const transformQuery: TransformQueryFunction = (name, args) => {
            const query = mustGetQuery(queries as never, name) as DynamicQuery;
            const started = performance.now();
            const result = query.fn({ args, ctx });
            queryDiagnostic('transform', started, { name });
            return result;
          };

          const started = performance.now();
          const result = await handleQueryRequest(transformQuery, schema, request);
          queryDiagnostic('transform-batch', started);
          if (
            process.env.ZERO_PERFORMANCE_DIAGNOSTICS === '1' &&
            'kind' in result &&
            result.kind === 'QueryResponse'
          ) {
            queryDiagnostic('query-identities', performance.now(), {
              queries: result.queries.map(query => ({
                id: query.id,
                name: query.name,
                ...('ast' in query ? { structure: queryStructure(query.ast) } : {}),
              })),
            });
          }

          return Response.json(result);
        }, request),
    },
  },
});
