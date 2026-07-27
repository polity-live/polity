import { createFileRoute } from '@tanstack/react-router';
import { getEurostatDatasetDetails } from '@/server/eurostat/metadata';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/eurostat/details')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code')?.trim();
        const language = url.searchParams.get('lang') ?? 'en';

        if (!code) {
          return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
        }

        try {
          return Response.json(await getEurostatDatasetDetails(code, language));
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'external_service_failed'), {
            status: 502,
          });
        }
      },
    },
  },
});
