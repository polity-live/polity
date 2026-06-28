import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { useBlogPermissions } from '@/features/blogs/hooks/useBlogPermissions';
import { EditorView } from '@/features/editor/ui/EditorView';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { usePermissions } from '@/zero/rbac/usePermissions';

export const Route = createFileRoute('/_authed/group/$id/blog/$entryId/editor')({
  component: GroupBlogEditorPage,
});

function GroupBlogEditorPage() {
  const { entryId } = Route.useParams();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const { canEdit, isLoading: isBlogPermissionLoading } = useBlogPermissions(entryId);
  const { can, isLoading: isGroupPermissionLoading } = usePermissions({
    groupId: Route.useParams().id,
  });

  if (isBlogPermissionLoading || isGroupPermissionLoading) {
    return <PageSkeleton />;
  }

  if (!user || (!canEdit && !can('manage', 'groups'))) {
    return <AccessDenied />;
  }

  const userRecord = currentUser
    ? {
        id: currentUser.id,
        name:
          [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') ||
          currentUser.handle ||
          '',
        email: user?.email,
        avatar: currentUser.avatar ?? undefined,
      }
    : undefined;

  return (
    <EditorView entityType="blog" entityId={entryId} userId={user?.id} userRecord={userRecord} />
  );
}
