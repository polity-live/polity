import { createFileRoute } from '@tanstack/react-router';
import { handleCollaboration } from '@/server/collaboration/api';
export const Route = createFileRoute('/api/collaboration')({
  server: { handlers: { POST: ({ request }) => handleCollaboration(request) } },
});
