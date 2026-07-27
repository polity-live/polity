import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { getSession } from '@/lib/supabase/server';
import {
  getPushSubscriptionForDevice,
  pushSubscriptionInputSchema,
  PushSubscriptionConflictError,
  registerPushSubscriptionForUser,
  unregisterPushSubscriptionForUser,
} from '@/server/push-subscription-service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

const deviceSchema = z.object({ deviceId: z.string().uuid() });

function errorResponse(error: unknown) {
  const status =
    error instanceof z.ZodError ? 400 : error instanceof PushSubscriptionConflictError ? 409 : 500;
  if (status === 500) console.error('[PushSubscriptionRoute]', error);
  return Response.json(
    error instanceof z.ZodError
      ? appErrorHttpBody('validation_failed')
      : appErrorHttpBodyFrom(error, 'push_operation_failed'),
    { status }
  );
}

export const Route = createFileRoute('/api/push/subscription')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          const url = new URL(request.url);
          const { deviceId } = deviceSchema.parse({
            deviceId: url.searchParams.get('deviceId'),
          });
          return Response.json({
            subscription: await getPushSubscriptionForDevice(session.user.id, deviceId),
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PUT: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          const input = pushSubscriptionInputSchema.parse(await request.json());
          return Response.json({
            subscription: await registerPushSubscriptionForUser(session.user.id, input),
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        try {
          const { deviceId } = deviceSchema.parse(await request.json());
          await unregisterPushSubscriptionForUser(session.user.id, deviceId);
          return Response.json({ ok: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
