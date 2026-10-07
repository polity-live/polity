import { createFileRoute } from '@tanstack/react-router';
import { readStudioProject } from '@/server/studio/read';

export const Route = createFileRoute('/api/studio/read/$id')({
  server: { handlers: { GET: ({ request, params }) => readStudioProject(request, params.id) } },
});
