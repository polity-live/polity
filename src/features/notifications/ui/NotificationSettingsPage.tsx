import { PageHeader } from '@/features/shared/ui/layout';
import { NotificationSettingsContent } from './NotificationSettingsContent';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface NotificationSettingsPageProps {
  userId: string;
}

export function NotificationSettingsPage({ userId }: NotificationSettingsPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={translateText('generated.inline.0805_notification_settings_e0a9fb92')}
        description={translateText(
          'generated.inline.0806_manage_how_you_receive_notifications_for_diff_d8da58b7'
        )}
      />
      <NotificationSettingsContent userId={userId} />
    </div>
  );
}
