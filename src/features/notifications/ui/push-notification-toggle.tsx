'use client';

import { useEffect, useRef, useState } from 'react';

import { usePushSubscription } from '@/features/pwa/hooks/usePushSubscription.ts';
import { pushApiFetch } from '@/features/pwa/push-api';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { PushNotificationToggleView } from './PushNotificationToggleView';
import { localizeAppError, parseAppError } from '@/features/shared/errors/app-error';

interface PushNotificationToggleProps {
  variant?: 'default' | 'card' | 'minimal' | 'settings';
  showDescription?: boolean;
  showDiagnostics?: boolean;
}

interface PushTestState {
  jobId: string;
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';
  skipReason?: string | null;
  error?: string | null;
}

export function PushNotificationToggle({
  variant = 'default',
  showDescription = true,
  showDiagnostics = false,
}: PushNotificationToggleProps) {
  const { t } = useTranslation();
  const push = usePushSubscription();
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    unsubscribe,
    deviceId,
  } = push;
  const [testState, setTestState] = useState<PushTestState | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const testTimer = useRef<number | null>(null);

  const refreshTestStatus = async (jobId: string, process = false) => {
    const status = await pushApiFetch<PushTestState>(`/api/push/test/${jobId}`, {
      method: process ? 'POST' : 'GET',
    });
    setTestState(status);
    return status;
  };

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && testState?.jobId) {
        void refreshTestStatus(testState.jobId).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [testState?.jobId]);

  useEffect(
    () => () => {
      if (testTimer.current) window.clearTimeout(testTimer.current);
    },
    []
  );

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success(t('components.pushNotifications.deactivated'));
      } else {
        await subscribe();
        // Only show success if subscribe didn't throw
        toast.success(t('components.pushNotifications.activated'));
      }
    } catch (err: unknown) {
      console.error('[PushNotificationToggle] Error:', err);
      toast.error(
        parseAppError(err)
          ? localizeAppError(err)
          : err instanceof Error
            ? err.message
            : t('components.pushNotifications.error')
      );
    }
  };

  const handleTest = async () => {
    if (!deviceId || !isSubscribed) return;
    setTestLoading(true);
    try {
      const scheduled = await pushApiFetch<PushTestState>('/api/push/test', {
        method: 'POST',
        body: JSON.stringify({
          deviceId,
          title: t('components.pushNotifications.test.title'),
          message: t('components.pushNotifications.test.message'),
        }),
      });
      setTestState(scheduled);
      testTimer.current = window.setTimeout(() => {
        void refreshTestStatus(scheduled.jobId, true)
          .then(status => {
            if (status.status === 'pending') {
              testTimer.current = window.setTimeout(
                () => void refreshTestStatus(scheduled.jobId, true),
                1500
              );
            }
          })
          .catch(testError =>
            setTestState({
              jobId: scheduled.jobId,
              status: 'failed',
              error: localizeAppError(testError),
            })
          )
          .finally(() => setTestLoading(false));
      }, 5500);
    } catch (testError) {
      setTestLoading(false);
      toast.error(localizeAppError(testError));
    }
  };

  return (
    <PushNotificationToggleView
      variant={variant}
      showDescription={showDescription}
      t={t}
      isSupported={isSupported}
      isSubscribed={isSubscribed}
      isLoading={isLoading}
      permission={permission}
      error={error}
      serviceWorkerReady={push.serviceWorkerReady}
      serverSynchronized={push.serverSynchronized}
      requiresIosInstall={push.requiresIosInstall}
      showDiagnostics={showDiagnostics}
      testState={testState}
      testLoading={testLoading}
      handleToggle={handleToggle}
      handleTest={handleTest}
    />
  );
}
