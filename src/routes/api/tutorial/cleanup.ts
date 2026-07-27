import { createFileRoute } from '@tanstack/react-router';

import { cleanupExpiredAppTutorialRuns } from '@/server/app-tutorial/service';
import { AppTutorialDatabaseUnavailableError } from '@/server/app-tutorial/db';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/tutorial/cleanup')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env.APP_TUTORIAL_CLEANUP_SECRET;
        const providedSecret = request.headers.get('x-cleanup-secret');
        if (!expectedSecret || providedSecret !== expectedSecret) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          return Response.json({
            ok: true,
            deletedRuns: await cleanupExpiredAppTutorialRuns(),
          });
        } catch (error) {
          if (error instanceof AppTutorialDatabaseUnavailableError) {
            return Response.json(appErrorHttpBodyFrom(error, 'tutorial_operation_failed'), {
              status: 503,
            });
          }
          console.error('[app-tutorial-cleanup]', error);
          return Response.json(appErrorHttpBody('tutorial_operation_failed'), { status: 500 });
        }
      },
    },
  },
});
