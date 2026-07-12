import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/user/$id/notifications')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/user/$id/settings',
      params: { id: params.id },
      search: { tab: 'notifications' },
    });
  },
  component: () => null,
});
