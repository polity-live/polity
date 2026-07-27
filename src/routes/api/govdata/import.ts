import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { importGovDataDatasetSnapshot } from '@/server/datasets/providers';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

const requestSchema = z.object({
  packageId: z.string().trim().min(1).max(200),
  resourceId: z.string().trim().min(1).max(200),
});

export const Route = createFileRoute('/api/govdata/import')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          return Response.json(
            await importGovDataDatasetSnapshot({
              packageId: body.packageId,
              resourceId: body.resourceId,
              userId: session.user.id,
            })
          );
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
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
