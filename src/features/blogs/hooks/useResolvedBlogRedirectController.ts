import { useBlogState } from '@/zero/blogs/useBlogState';

type ResolvedBlogRedirectTarget = 'detail' | 'notifications';
type ResolvedBlogRedirectState =
  | { status: 'loading' }
  | {
      status: 'group';
      to: '/group/$id/blog/$entryId' | '/group/$id/blog/$entryId/notifications';
      params: { id: string; entryId: string };
    }
  | {
      status: 'user';
      to: '/user/$id/blog/$entryId' | '/user/$id/blog/$entryId/notifications';
      params: { id: string; entryId: string };
    }
  | { status: 'denied' };

interface UseResolvedBlogRedirectControllerProps {
  blogId: string;
  target?: ResolvedBlogRedirectTarget;
}

export function useResolvedBlogRedirectController({
  blogId,
  target = 'detail',
}: UseResolvedBlogRedirectControllerProps): ResolvedBlogRedirectState {
  const { blogWithBloggers, isLoading } = useBlogState({
    blogId,
    includeBloggers: true,
  });

  if (isLoading) {
    return { status: 'loading' };
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
    return {
      status: 'group',
      to: destination,
      params: { id: blog.group_id, entryId: blogId },
    };
  }

  if (ownerId) {
    return {
      status: 'user',
      to: userDestination,
      params: { id: ownerId, entryId: blogId },
    };
  }

  return { status: 'denied' };
}
