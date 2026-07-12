import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { UserEdit } from '@/features/users/ui/UserEdit';
import { useAuth } from '@/providers/auth-provider';

const settingsSearchSchema = z.object({
  tab: z
    .enum(['basic-info', 'preferences', 'subscriptions', 'passwords', 'notifications', 'ai'])
    .catch('basic-info')
    .optional(),
  success: z.string().optional(),
  canceled: z.string().optional(),
});

type SettingsTab = NonNullable<z.infer<typeof settingsSearchSchema>['tab']>;

export const Route = createFileRoute('/_authed/user/$id/settings')({
  validateSearch: settingsSearchSchema,
  component: UserSettingsPage,
});

function UserSettingsPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { user } = useAuth();

  if (!user || user.id !== id) {
    return <AccessDenied />;
  }

  return (
    <UserEdit
      userId={id}
      activeTab={tab ?? 'basic-info'}
      onTabChange={nextTab =>
        navigate({
          search: previous => ({
            ...previous,
            tab: settingsSearchSchema.shape.tab.parse(nextTab) as SettingsTab,
          }),
          replace: true,
        })
      }
    />
  );
}
