import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { BlogEdit } from '@/features/blogs/ui/BlogEdit';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useBlogPermissions } from '@/features/blogs/hooks/useBlogPermissions';

export const Route = createFileRoute('/_authed/user/$id/blog/$entryId/edit')({
  component: UserBlogEditPage,
});

function UserBlogEditPage() {
  const { id, entryId } = Route.useParams();
  const { canEdit, isLoading } = useBlogPermissions(entryId);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!canEdit) {
    return <AccessDenied />;
  }

  return <BlogEdit blogId={entryId} userId={id} />;
}
