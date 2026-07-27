import { createFileRoute } from '@tanstack/react-router';

import { getSession } from '@/lib/supabase/server';
import {
  getPushTestStatus,
  processPushTest,
  PushDeliveryHttpError,
} from '@/server/push-delivery-service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

function errorResponse(error: unknown) {
  const status = error instanceof PushDeliveryHttpError ? error.status : 500;
  if (status === 500) console.error('[PushTestStatusRoute]', error);
  return Response.json(appErrorHttpBodyFrom(error, 'push_operation_failed'), { status });
}

export const Route = createFileRoute('/api/push/test/$jobId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          return Response.json(await getPushTestStatus(session.user.id, params.jobId));
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          return Response.json(await processPushTest(session.user.id, params.jobId));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
