import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/event/$id/roles')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/event/$id/participants',
      params: { id: params.id },
      search: { tab: 'roles' },
    });
  },
});
