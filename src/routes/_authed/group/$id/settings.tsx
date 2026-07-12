import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { GroupEdit } from '@/features/groups/ui/GroupEdit';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { z } from 'zod';

const settingsSearchSchema = z.object({
  tab: z.enum(['general', 'relationships', 'contact']).catch('general').optional(),
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

  if (!isMember() || !can('manage', 'groups')) {
    return <AccessDenied />;
  }

  return (
    <GroupEdit
      groupId={id}
      activeTab={tab ?? 'general'}
      onTabChange={nextTab =>
        navigate({ search: previous => ({ ...previous, tab: nextTab }), replace: true })
      }
    />
  );
}
