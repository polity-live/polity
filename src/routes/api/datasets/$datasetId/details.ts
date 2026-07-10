import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { loadDatasetDetails } from '@/server/datasets/service';

export const Route = createFileRoute('/api/datasets/$datasetId/details')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSession(request);
        try {
          return Response.json(await loadDatasetDetails(params.datasetId, session?.user.id));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Dataset details failed';
          return Response.json(
            { error: message },
            { status: message.includes('access') ? 403 : 404 }
          );
        }
      },
    },
  },
});
