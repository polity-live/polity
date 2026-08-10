import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { EditorView } from '@/features/editor/ui/EditorView';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { useBlogPermissions } from '@/features/blogs/hooks/useBlogPermissions';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { mapEditorUserRecord } from '@/routes/_authed';

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

  const userRecord = mapEditorUserRecord(currentUser, user?.email);

  return (
    <EditorView entityType="blog" entityId={entryId} userId={user?.id} userRecord={userRecord} />
  );
}
