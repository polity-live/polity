'use client';

interface NotificationSettingsContentProps {
  userId: string;
}

import { useNotificationSettingsContentController } from './useNotificationSettingsContentController';
import { NotificationSettingsContentView } from './NotificationSettingsContentView';

export function NotificationSettingsContent({ userId }: NotificationSettingsContentProps) {
  const viewProps = useNotificationSettingsContentController({ userId });

  return <NotificationSettingsContentView {...viewProps} />;
}
