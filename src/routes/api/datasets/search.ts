import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { searchDatasetProviders } from '@/server/datasets/providers';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/datasets/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') ?? '';
        const providers = (url.searchParams.get('providers') ?? '')
          .split(',')
          .map(provider => provider.trim())
          .filter(Boolean);
        const groupId = url.searchParams.get('groupId');
        const language = url.searchParams.get('lang') ?? 'en';
        const includeExternal = url.searchParams.get('includeExternal') === 'true';
        const withStatus = url.searchParams.get('withStatus') === 'true';
        const session = await getSession(request);

        try {
          const result = await searchDatasetProviders({
            query,
            providers,
            groupId,
            userId: session?.user.id,
            language,
            includeExternal,
          });
          return Response.json(withStatus ? result : result.results);
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'dataset_operation_failed'), {
            status: 502,
          });
        }
      },
    },
  },
});
