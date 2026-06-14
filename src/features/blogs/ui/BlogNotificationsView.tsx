import { PageWrapper } from '@/layout/page-wrapper';
import { EntityNotifications } from '@/features/notifications/ui/EntityNotifications.tsx';

interface BlogNotificationsViewProps {
  blogId: string;
  entityName: string;
}

export function BlogNotificationsView({ blogId, entityName }: BlogNotificationsViewProps) {
  return (
    <PageWrapper>
      <EntityNotifications entityId={blogId} entityType="blog" entityName={entityName} />
    </PageWrapper>
  );
}
