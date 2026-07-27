import { createFileRoute } from '@tanstack/react-router';
import { searchEurostatCatalogue } from '@/server/eurostat/catalogue';
import { appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/eurostat/catalogue')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') ?? '';
        const language = url.searchParams.get('lang') ?? 'en';

        try {
          return Response.json(await searchEurostatCatalogue(query, language, 20));
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'external_service_failed'), {
            status: 502,
          });
        }
      },
    },
  },
});
