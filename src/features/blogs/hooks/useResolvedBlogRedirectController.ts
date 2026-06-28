import { useBlogState } from '@/zero/blogs/useBlogState';
import {
  useCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '@/features/create/logic/createFinalization';

type ResolvedBlogRedirectTarget = 'detail' | 'notifications' | 'edit';
type ResolvedBlogRedirectState =
  | { status: 'loading' }
  | { status: 'recovery'; draft: CreateRecoveryDraft }
  | {
      status: 'group';
      to:
        | '/group/$id/blog/$entryId'
        | '/group/$id/blog/$entryId/notifications'
        | '/group/$id/blog/$entryId/edit';
      params: { id: string; entryId: string };
    }
  | {
      status: 'user';
      to:
        | '/user/$id/blog/$entryId'
        | '/user/$id/blog/$entryId/notifications'
        | '/user/$id/blog/$entryId/edit';
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
  const recoveryDraft = useCreateRecoveryDraft('blog', blogId);
  const { blogWithBloggers, isLoading } = useBlogState({
    blogId,
    includeBloggers: true,
  });

  const blog = blogWithBloggers;
  if (!blog && recoveryDraft) {
    return { status: 'recovery', draft: recoveryDraft };
  }

  if (isLoading) {
    return { status: 'loading' };
  }

  const ownerId =
    blog?.bloggers?.find(blogger => blogger.status === 'owner')?.user?.id ??
    blog?.bloggers?.[0]?.user?.id;
  const destination =
    target === 'notifications'
      ? '/group/$id/blog/$entryId/notifications'
      : target === 'edit'
        ? '/group/$id/blog/$entryId/edit'
        : '/group/$id/blog/$entryId';
  const userDestination =
    target === 'notifications'
      ? '/user/$id/blog/$entryId/notifications'
      : target === 'edit'
        ? '/user/$id/blog/$entryId/edit'
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
