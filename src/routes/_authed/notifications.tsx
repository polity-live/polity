import { createFileRoute } from '@tanstack/react-router';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { useNotificationsPreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/notifications')({
  component: NotificationsRoute,
});

function NotificationsRoute() {
  useNotificationsPreloads();
  return <NotificationsPage />;
}
