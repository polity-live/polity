import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { datasetProjectionRequestSchema } from '@/server/datasets/projectionRequest';
import { createDatasetProjection } from '@/server/datasets/service';

export const Route = createFileRoute('/api/datasets/$snapshotId/projection')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
            { error: error instanceof Error ? error.message : 'Dataset projection failed' },
            { status }
          );
        }
      },
    },
  },
});
