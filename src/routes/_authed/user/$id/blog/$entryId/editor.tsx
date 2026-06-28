import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useBlogPermissions } from '@/features/blogs/hooks/useBlogPermissions';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

export const Route = createFileRoute('/_authed/user/$id/blog/$entryId/editor')({
  component: UserBlogEditorPage,
});

function UserBlogEditorPage() {
  const { entryId } = Route.useParams();
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const { canEdit, isLoading } = useBlogPermissions(entryId);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!user || !canEdit) {
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
