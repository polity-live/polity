import { createFileRoute } from '@tanstack/react-router';
import { PushProcessor } from '@rocicorp/zero/server';
import { serverMutators } from '@/zero/server-mutators';
import { dbProvider } from '@/zero/db-provider';
import { getAuthFromRequest } from '@/server/zero-auth';

export const Route = createFileRoute('/api/mutate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAuthFromRequest(request);
        const push = new PushProcessor(dbProvider, ctx);
        const result = await push.process(serverMutators, request);

        return Response.json(result);
      },
    },
  },
});
