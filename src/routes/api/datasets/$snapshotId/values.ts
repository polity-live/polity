import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { getDatasetColumnValues } from '@/server/datasets/service';

export const Route = createFileRoute('/api/datasets/$snapshotId/values')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const url = new URL(request.url);
        const column = url.searchParams.get('column')?.trim();
        if (!column) return Response.json({ error: 'Column is required' }, { status: 400 });

        try {
          return Response.json(
            await getDatasetColumnValues({
              snapshotId: params.snapshotId,
              column,
              query: url.searchParams.get('q') ?? '',
              limit: Number(url.searchParams.get('limit') ?? 50),
              userId: session.user.id,
            })
          );
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : 'Dataset values failed' },
            { status: 400 }
          );
        }
      },
    },
  },
});
