import { createFileRoute } from '@tanstack/react-router';
import { PushProcessor } from '@rocicorp/zero/server';
import { serverMutators } from '@/zero/server-mutators';
import { dbProvider } from '@/zero/db-provider';
import { getAuthFromRequest } from '@/server/zero-auth';
import { withNotificationDeliveryQueue } from '@/zero/server-notify';
import { sanitizeZeroMutationResult } from '@/server/zero-mutate';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/mutate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAuthFromRequest(request);
        const push = new PushProcessor(dbProvider, ctx);
        try {
          const result = await withNotificationDeliveryQueue(() =>
            push.process(serverMutators, request)
          );

          return Response.json(sanitizeZeroMutationResult(result));
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'mutation_server_failed'), {
            status: 500,
          });
        }
      },
    },
  },
});
