import { createFileRoute } from '@tanstack/react-router';
import { searchGovDataCatalogue } from '@/server/govdata/catalogue';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/govdata/catalogue')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') ?? '';

        try {
          return Response.json(await searchGovDataCatalogue(query, 20));
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'external_service_failed'), {
            status: 502,
          });
        }
      },
    },
  },
});
