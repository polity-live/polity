import { createFileRoute } from '@tanstack/react-router';
import { BlogNotifications } from '@/features/blogs/ui/BlogNotifications';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';

export const Route = createFileRoute('/_authed/user/$id/blog/$entryId/notifications')({
  component: UserBlogNotificationsPage,
});

function UserBlogNotificationsPage() {
  const { entryId } = Route.useParams();
  const { can, isABlogger, isLoading } = usePermissions({ blogId: entryId });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isABlogger() || !can('viewNotifications', 'notifications')) {
    return <AccessDenied />;
  }

  return <BlogNotifications blogId={entryId} />;
}
