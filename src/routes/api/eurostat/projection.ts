import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { createDatasetProjection, loadDatasetDetails } from '@/server/datasets/service';

const requestSchema = z.object({
  datasetId: z.string().uuid(),
  snapshotId: z.string().uuid().optional(),
  filters: z.record(z.string(), z.string()),
  xDimension: z.string().trim().min(1),
  seriesDimension: z.string().trim().min(1).nullable().optional(),
  valueField: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute('/api/eurostat/projection')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          const snapshotId =
            body.snapshotId ??
            (await loadDatasetDetails(body.datasetId, session.user.id)).snapshots[0]?.id;
          if (!snapshotId) {
            return Response.json({ error: 'Dataset snapshot not found' }, { status: 404 });
          }
          const result = await createDatasetProjection(
            {
              snapshotId,
              filters: body.filters,
              mapping: {
                xColumn: body.xDimension,
                valueColumn: body.valueField ?? 'OBS_VALUE',
                seriesColumn: body.seriesDimension ?? null,
                tableMode: 'columnMapping',
              },
            },
            session.user.id
          );
          return Response.json({
            projectionId: result.snapshotId,
            snapshotId: result.snapshotId,
            points: result.points,
          });
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          return Response.json(
            {
              error:
                error instanceof Error ? error.message : 'Chart projection could not be created',
            },
            { status }
          );
        }
      },
    },
  },
});
