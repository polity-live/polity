import { createFileRoute } from '@tanstack/react-router';
import { handleQueryRequest, type TransformQueryFunction } from '@rocicorp/zero/server';
import { mustGetQuery } from '@rocicorp/zero';
import { queries } from '@/zero/queries';
import { schema } from '@/zero/schema';
import { getAuthFromRequest } from '@/server/zero-auth';

export const Route = createFileRoute('/api/query')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAuthFromRequest(request);
        interface DynamicQuery {
          fn: (input: { args: unknown; ctx: typeof ctx }) => ReturnType<TransformQueryFunction>;
        }

        const transformQuery: TransformQueryFunction = (name, args) => {
          const query = mustGetQuery(queries as never, name) as DynamicQuery;
          return query.fn({ args, ctx });
        };

        const result = await handleQueryRequest(transformQuery, schema, request);

        return Response.json(result);
      },
    },
  },
});
