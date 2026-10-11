import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';
import { importFiltersSchema } from '@/server/datasets/importScope';
import { prepareEurostatDataset } from '@/server/datasets/providers';
import { prepareGenesisDataset } from '@/server/datasets/genesis';
import { datasetProviderErrorResponse } from '@/server/datasets/providerError';

const schema = z.object({
  provider: z.enum(['EUROSTAT', 'GENESIS_DESTATIS']),
  code: z.string().trim().min(1).max(100),
  language: z.enum(['en', 'de', 'fr']).default('en'),
  filters: importFiltersSchema.optional(),
});
export const Route = createFileRoute('/api/datasets/prepare')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user)
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        try {
          const body = schema.parse(await request.json());
          const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
          return Response.json(
            body.provider === 'EUROSTAT'
              ? await prepareEurostatDataset(body.code, body.language, body.filters, signal)
              : await prepareGenesisDataset(
                  body.code,
                  body.language === 'de' ? 'de' : 'en',
                  body.filters,
                  signal
                )
          );
        } catch (error) {
          return (
            datasetProviderErrorResponse(error) ??
            Response.json(
              error instanceof z.ZodError
                ? appErrorHttpBody('validation_failed')
                : appErrorHttpBodyFrom(error, 'dataset_operation_failed'),
              { status: error instanceof z.ZodError ? 400 : 502 }
            )
          );
        }
      },
    },
  },
});
