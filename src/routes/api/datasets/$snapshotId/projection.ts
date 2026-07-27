import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { datasetProjectionRequestSchema } from '@/server/datasets/projectionRequest';
import { createDatasetProjection } from '@/server/datasets/service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/datasets/$snapshotId/projection')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }

        try {
          const body = datasetProjectionRequestSchema.parse(await request.json());
          return Response.json(
            await createDatasetProjection(
              { snapshotId: params.snapshotId, ...body },
              session.user.id
            )
          );
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 422;
          return Response.json(
            error instanceof z.ZodError
              ? appErrorHttpBody('validation_failed')
              : appErrorHttpBodyFrom(error, 'dataset_operation_failed'),
            { status }
          );
        }
      },
    },
  },
});
