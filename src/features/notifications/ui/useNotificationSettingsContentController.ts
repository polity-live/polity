'use client';

import { useState } from 'react';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface NotificationSettingsContentProps {
  userId: string;
}

export function useNotificationSettingsContentController({
  userId,
}: NotificationSettingsContentProps) {
  const { t } = useTranslation();

  const {
    settings,
    isLoading,
    isUpdating,
    updateGroupNotifications,
    updateEventNotifications,
    updateAmendmentNotifications,
    updateBlogNotifications,
    updateTodoNotifications,
    updateSocialNotifications,
    updateDeliverySettings,
    updateTimelineSettings,
    resetToDefaults,
  } = useNotificationSettings(userId);

  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetToDefaults();
    setResetting(false);
  };

  return {
    userId,
    t,
    settings,
    isLoading,
    isUpdating,
    updateGroupNotifications,
    updateEventNotifications,
    updateAmendmentNotifications,
    updateBlogNotifications,
    updateTodoNotifications,
    updateSocialNotifications,
    updateDeliverySettings,
    updateTimelineSettings,
    resetToDefaults,
    resetting,
    setResetting,
    handleReset,
  };
}
