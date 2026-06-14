import { createAPIFileRoute } from '@tanstack/react-start/api';
import { searchEurostatCatalogue } from '@/server/eurostat/catalogue';

export const APIRoute = createAPIFileRoute('/api/eurostat/catalogue')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const language = url.searchParams.get('lang') ?? 'en';

    try {
      return Response.json(await searchEurostatCatalogue(query, language, 20));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Eurostat catalogue is unavailable' },
        { status: 502 }
      );
    }
  },
});
