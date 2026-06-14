import { createAPIFileRoute } from '@tanstack/react-start/api';
import { getEurostatDatasetDetails } from '@/server/eurostat/metadata';

export const APIRoute = createAPIFileRoute('/api/eurostat/details')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code')?.trim();
    const language = url.searchParams.get('lang') ?? 'en';

    if (!code) {
      return Response.json({ error: 'Dataset code is required' }, { status: 400 });
    }

    try {
      return Response.json(await getEurostatDatasetDetails(code, language));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Eurostat metadata is unavailable' },
        { status: 502 }
      );
    }
  },
});
