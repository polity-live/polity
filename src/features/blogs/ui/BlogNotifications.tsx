'use client';

import { useBlogNotificationsController } from '../hooks/useBlogNotificationsController';
import { BlogNotificationsView } from './BlogNotificationsView';

interface BlogNotificationsProps {
  blogId: string;
}

export function BlogNotifications({ blogId }: BlogNotificationsProps) {
  const { entityName } = useBlogNotificationsController({ blogId });

  return <BlogNotificationsView blogId={blogId} entityName={entityName} />;
}
