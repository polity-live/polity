import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { GroupEdit } from '@/features/groups/ui/GroupEdit';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { z } from 'zod';

const settingsSearchSchema = z.object({
  tab: z.enum(['general', 'relationships', 'contact', 'themes']).catch('general').optional(),
});

export const Route = createFileRoute('/_authed/group/$id/settings')({
  validateSearch: settingsSearchSchema,
  component: GroupSettingsPage,
});

function GroupSettingsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { can, isMember, isLoading } = usePermissions({ groupId: id });

  if (isLoading) {
    return <PageSkeleton />;
  }

  const canManageGroup = can('manage', 'groups');
  const canManageThemes = can('manage', 'groupThemes');

  if (!isMember() || (!canManageGroup && !canManageThemes)) {
    return <AccessDenied />;
  }

  return (
    <GroupEdit
      groupId={id}
      activeTab={canManageGroup ? (tab ?? 'general') : 'themes'}
      canManageGroup={canManageGroup}
      onTabChange={nextTab =>
        navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
      }
    />
  );
}
