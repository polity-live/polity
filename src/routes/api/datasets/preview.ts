import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';
import { importFiltersSchema } from '@/server/datasets/importScope';
import { datasetProjectionRequestSchema } from '@/server/datasets/projectionRequest';
import { previewDataset } from '@/server/datasets/preview';
import { datasetProviderErrorResponse } from '@/server/datasets/providerError';

const schema = z.object({
  provider: z.enum(['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD']),
  providerDatasetId: z.string().min(1).max(200).nullable().optional(),
  providerResourceId: z.string().min(1).max(200).nullable().optional(),
  datasetId: z.string().uuid().nullable().optional(),
  snapshotId: z.string().uuid().nullable().optional(),
  language: z.enum(['de', 'en', 'fr']).default('en'),
  filters: importFiltersSchema.optional(),
  rowFilters: z.record(z.string().min(1).max(200), z.string().max(300)).optional(),
  timeRange: datasetProjectionRequestSchema.shape.timeRange,
  rowConditions: datasetProjectionRequestSchema.shape.rowConditions,
  sort: datasetProjectionRequestSchema.shape.sort,
  page: z
    .object({
      offset: z.number().int().min(0).max(1_000_000),
      limit: z.number().int().min(1).max(200),
    })
    .optional(),
});
export const Route = createFileRoute('/api/datasets/preview')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user)
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        try {
          const body = schema.parse(await request.json());
          const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
          return Response.json(await previewDataset(body, session.user.id, signal));
        } catch (error) {
          const denied = error instanceof Error && /access/i.test(error.message);
          return (
            datasetProviderErrorResponse(error) ??
            Response.json(
              error instanceof z.ZodError
                ? appErrorHttpBody('validation_failed')
                : appErrorHttpBodyFrom(
                    error,
                    denied ? 'permission_denied' : 'dataset_operation_failed'
                  ),
              { status: error instanceof z.ZodError ? 400 : denied ? 403 : 422 }
            )
          );
        }
      },
    },
  },
});
