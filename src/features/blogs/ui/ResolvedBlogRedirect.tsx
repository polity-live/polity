import { Navigate } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { useBlogState } from '@/zero/blogs/useBlogState';

interface ResolvedBlogRedirectProps {
  blogId: string;
  target?: 'detail' | 'notifications';
}

export function ResolvedBlogRedirect({ blogId, target = 'detail' }: ResolvedBlogRedirectProps) {
  const { blogWithBloggers, isLoading } = useBlogState({
    blogId,
    includeBloggers: true,
  });

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  const blog = blogWithBloggers;
  const ownerId =
    blog?.bloggers?.find(blogger => blogger.status === 'owner')?.user?.id ??
    blog?.bloggers?.[0]?.user?.id;
  const destination =
    target === 'notifications'
      ? '/group/$id/blog/$entryId/notifications'
      : '/group/$id/blog/$entryId';
  const userDestination =
    target === 'notifications'
      ? '/user/$id/blog/$entryId/notifications'
      : '/user/$id/blog/$entryId';

  if (blog?.group_id) {
    return <Navigate to={destination} params={{ id: blog.group_id, entryId: blogId }} replace />;
  }

  if (ownerId) {
    return <Navigate to={userDestination} params={{ id: ownerId, entryId: blogId }} replace />;
  }

  return <AccessDenied />;
}
