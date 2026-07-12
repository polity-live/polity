import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { BlogEdit } from '@/features/blogs/ui/BlogEdit';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useBlogPermissions } from '@/features/blogs/hooks/useBlogPermissions';
import { z } from 'zod';

const settingsSearchSchema = z.object({
  tab: z.enum(['general', 'tags']).catch('general').optional(),
});

export const Route = createFileRoute('/_authed/group/$id/blog/$entryId/edit')({
  validateSearch: settingsSearchSchema,
  component: GroupBlogEditPage,
});

function GroupBlogEditPage() {
  const { id, entryId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { canEdit, isLoading } = useBlogPermissions(entryId);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!canEdit) {
    return <AccessDenied />;
  }

  return (
    <BlogEdit
      blogId={entryId}
      groupId={id}
      activeTab={tab ?? 'general'}
      onTabChange={nextTab =>
        navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
      }
    />
  );
}
