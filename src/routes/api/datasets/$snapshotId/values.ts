import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { getDatasetColumnValues } from '@/server/datasets/service';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/datasets/$snapshotId/values')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }
        const url = new URL(request.url);
        const column = url.searchParams.get('column')?.trim();
        if (!column) {
          return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
        }

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
          return Response.json(appErrorHttpBodyFrom(error, 'dataset_operation_failed'), {
            status: 400,
          });
        }
      },
    },
  },
});
