import { createFileRoute } from '@tanstack/react-router';
import { privateCanvasMedia } from '@/server/studio/private-media';
export const Route = createFileRoute('/api/studio/exports/$id')({
  server: {
    handlers: { GET: ({ request, params }) => privateCanvasMedia(request, params.id, 'export') },
  },
});
