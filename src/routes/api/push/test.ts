import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { getSession } from '@/lib/supabase/server';
import { PushDeliveryHttpError, schedulePushTest } from '@/server/push-delivery-service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

const testSchema = z.object({
  deviceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
});

export const Route = createFileRoute('/api/push/test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          const body = testSchema.parse(await request.json());
          return Response.json(
            await schedulePushTest(session.user.id, body.deviceId, {
              title: body.title,
              message: body.message,
            }),
            { status: 202 }
          );
        } catch (error) {
          const status =
            error instanceof z.ZodError
              ? 400
              : error instanceof PushDeliveryHttpError
                ? error.status
                : 500;
          if (status === 500) console.error('[PushTestRoute]', error);
          return Response.json(
            error instanceof z.ZodError
              ? appErrorHttpBody('validation_failed')
              : appErrorHttpBodyFrom(error, 'push_operation_failed'),
            { status }
          );
        }
      },
    },
  },
});
