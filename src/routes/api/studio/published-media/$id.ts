import { createFileRoute } from '@tanstack/react-router';
import { publishedStudioMedia } from '@/server/studio/published-media';
export const Route = createFileRoute('/api/studio/published-media/$id')({
  server: { handlers: { GET: ({ request, params }) => publishedStudioMedia(request, params.id) } },
});
