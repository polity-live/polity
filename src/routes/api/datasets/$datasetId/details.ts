import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { loadDatasetDetails } from '@/server/datasets/service';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/datasets/$datasetId/details')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSession(request);
        try {
          return Response.json(await loadDatasetDetails(params.datasetId, session?.user?.id));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Dataset details failed';
          const denied = message.includes('access');
          return Response.json(
            appErrorHttpBodyFrom(error, denied ? 'permission_denied' : 'resource_not_found'),
            { status: denied ? 403 : 404 }
          );
        }
      },
    },
  },
});
