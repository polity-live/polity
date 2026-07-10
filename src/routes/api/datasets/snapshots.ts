import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import {
  importEurostatDatasetSnapshot,
  importGovDataDatasetSnapshot,
} from '@/server/datasets/providers';
import { importGenesisDatasetSnapshot } from '@/server/datasets/genesis';

const requestSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('EUROSTAT'),
    code: z.string().trim().min(1).max(100),
    language: z.enum(['en', 'de', 'fr']).default('en'),
  }),
  z.object({
    provider: z.literal('GOVDATA'),
    packageId: z.string().trim().min(1).max(200),
    resourceId: z.string().trim().min(1).max(200),
  }),
  z.object({
    provider: z.literal('GENESIS_DESTATIS'),
    code: z.string().trim().min(1).max(100),
    language: z.enum(['en', 'de']).default('de'),
  }),
]);

export const Route = createFileRoute('/api/datasets/snapshots')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          if (body.provider === 'EUROSTAT') {
            return Response.json(
              await importEurostatDatasetSnapshot({
                code: body.code,
                language: body.language,
                userId: session.user.id,
              })
            );
          }
          if (body.provider === 'GOVDATA') {
            return Response.json(
              await importGovDataDatasetSnapshot({
                packageId: body.packageId,
                resourceId: body.resourceId,
                userId: session.user.id,
              })
            );
          }
          return Response.json(
            await importGenesisDatasetSnapshot({
              code: body.code,
              language: body.language,
              userId: session.user.id,
            })
          );
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          return Response.json(
            { error: error instanceof Error ? error.message : 'Dataset snapshot failed' },
            { status }
          );
        }
      },
    },
  },
});
