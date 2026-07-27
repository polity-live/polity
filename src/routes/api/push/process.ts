import { createFileRoute } from '@tanstack/react-router';

import {
  authorizePushDelivery,
  executePushDelivery,
  PushDeliveryHttpError,
} from '@/server/push-delivery-service';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/push/process')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          authorizePushDelivery(request);
          return Response.json(await executePushDelivery());
        } catch (error) {
          const status = error instanceof PushDeliveryHttpError ? error.status : 500;
          if (status === 500) console.error('[PushDeliveryRoute]', error);
          return Response.json(appErrorHttpBodyFrom(error, 'push_operation_failed'), { status });
        }
      },
    },
  },
});
