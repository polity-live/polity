import { createFileRoute } from '@tanstack/react-router';
import { handleStudio } from '@/server/studio/api';
export const Route = createFileRoute('/api/studio')({
  server: { handlers: { POST: ({ request }) => handleStudio(request) } },
});
