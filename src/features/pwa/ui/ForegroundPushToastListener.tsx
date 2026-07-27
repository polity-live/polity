'use client';

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useAuth } from '@/providers/auth-provider';

export const FOREGROUND_PUSH_MESSAGE_TYPE = 'polity:foreground-push:v1';

interface ForegroundPushNotification {
  title: string;
  body?: string;
  url?: string;
  notificationId?: string;
  notificationType?: string;
  tag?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function parseForegroundPushMessage(value: unknown): ForegroundPushNotification | null {
  if (!isRecord(value) || value.type !== FOREGROUND_PUSH_MESSAGE_TYPE) return null;
  const notification = value.notification;
  if (!isRecord(notification)) return null;
  const title = optionalString(notification.title);
  if (!title) return null;

  return {
    title,
    body: optionalString(notification.body),
    url: optionalString(notification.url),
    notificationId: optionalString(notification.notificationId),
    notificationType: optionalString(notification.notificationType),
    tag: optionalString(notification.tag),
  };
}

export function sameOriginPushPath(value?: string) {
  if (typeof window === 'undefined' || !value) return null;

  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function ForegroundPushToastListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user?.id || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const notification = parseForegroundPushMessage(event.data);
      const acknowledgementPort = event.ports[0];
      if (!notification || !acknowledgementPort) return;

      const path = sameOriginPushPath(notification.url);
      const dedupeKey = notification.notificationId ?? notification.tag;
      const toastId = toast.info(notification.title, {
        description: notification.body,
        id: dedupeKey ? `foreground-push:${dedupeKey}` : undefined,
        action: path
          ? {
              label: t('components.pushNotifications.foreground.open'),
              onClick: () => void navigate({ to: path } as never),
            }
          : undefined,
        testId: 'foreground-push-toast',
      });

      if (toastId !== undefined) {
        acknowledgementPort.postMessage({ handled: true });
      }
      acknowledgementPort.close();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate, t, user?.id]);

  return null;
}
