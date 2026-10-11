import { createFileRoute } from '@tanstack/react-router';
import { handleMutateRequest } from '@rocicorp/zero/server';
import { mustGetMutator } from '@rocicorp/zero';
import { serverMutators } from '@/zero/server-mutators';
import { dbProvider } from '@/zero/db-provider';
import { getAuthFromRequest } from '@/server/zero-auth';
import { withNotificationDeliveryQueue } from '@/zero/server-notify';
import { sanitizeZeroMutationResult } from '@/server/zero-mutate';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';
import { mutationDiagnostic, withMutationDiagnostics } from '@/server/zero-mutation-diagnostics';

export const Route = createFileRoute('/api/mutate')({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withMutationDiagnostics(
          request,
          async () => {
            const authAt = performance.now();
            const ctx = await getAuthFromRequest(request);
            mutationDiagnostic('auth', authAt);
            try {
              const result = await withNotificationDeliveryQueue(() =>
                handleMutateRequest({
                  dbProvider,
                  request,
                  userID: ctx.userID === 'anon' ? null : ctx.userID,
                  handler: transact =>
                    transact(async (tx, name, args) => {
                      const mutator = mustGetMutator(serverMutators, name);
                      await mutator.fn({ args, tx, ctx });
                    }),
                })
              );

              return Response.json(sanitizeZeroMutationResult(result));
            } catch (error) {
              return Response.json(appErrorHttpBodyFrom(error, 'mutation_server_failed'), {
                status: 500,
              });
            }
          },
          serverMutators
        ),
    },
  },
});
