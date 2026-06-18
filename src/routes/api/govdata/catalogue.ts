import { createAPIFileRoute } from '@tanstack/react-start/api';
import { searchGovDataCatalogue } from '@/server/govdata/catalogue';

export const APIRoute = createAPIFileRoute('/api/govdata/catalogue')({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';

    try {
      return Response.json(await searchGovDataCatalogue(query, 20));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'GovData catalogue is unavailable' },
        { status: 502 }
      );
    }
  },
});
