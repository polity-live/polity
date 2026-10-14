import { createFileRoute } from '@tanstack/react-router';
import { handlePublicGroupInvitation } from '@/server/group-email-invitations';

export const Route = createFileRoute('/api/invitations/$token')({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePublicGroupInvitation(request, params.token),
      POST: ({ request, params }) => handlePublicGroupInvitation(request, params.token),
    },
  },
});
