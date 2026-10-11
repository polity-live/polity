import { createFileRoute } from '@tanstack/react-router';
import { handleGroupEmailInvitations } from '@/server/group-email-invitations';

export const Route = createFileRoute('/api/groups/$groupId/email-invitations')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGroupEmailInvitations(request, params.groupId),
      POST: ({ request, params }) => handleGroupEmailInvitations(request, params.groupId),
    },
  },
});
