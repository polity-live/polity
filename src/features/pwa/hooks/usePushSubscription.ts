'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { pushApiFetch } from '@/features/pwa/push-api';
import { getPushDeviceId, requiresIosHomeScreenInstall } from '@/features/pwa/push-device';
import { useAuth } from '@/providers/auth-provider';

interface UsePushSubscriptionReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  error: string | null;
  serviceWorkerReady: boolean;
  serverSynchronized: boolean;
  requiresIosInstall: boolean;
  deviceId: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
  refresh: () => Promise<void>;
}

interface ServerSubscriptionResponse {
  subscription: { id: string; endpoint: string; device_id: string } | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, character => character.charCodeAt(0));
}

function keysMatch(left: ArrayBuffer | null, right: Uint8Array<ArrayBuffer>) {
  if (!left) return false;
  const current = new Uint8Array(left);
  return current.length === right.length && current.every((value, index) => value === right[index]);
}

async function ensureServiceWorker() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    await navigator.serviceWorker.register('/custom-sw.js', { scope: '/' });
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error('Service worker activation timed out')), 10_000)
    ),
  ]);
}

function subscriptionKeys(subscription: PushSubscription) {
  const keys = subscription.toJSON().keys;
  if (!keys?.auth || !keys.p256dh) throw new Error('Invalid Web Push subscription keys');
  return keys as { auth: string; p256dh: string };
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [error, setError] = useState<string | null>(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [serverSynchronized, setServerSynchronized] = useState(false);
  const [requiresIosInstall, setRequiresIosInstall] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const tRef = useRef(t);
  const refreshSequence = useRef(0);
  tRef.current = t;

  const unregisterServerDevice = useCallback(async (currentDeviceId: string) => {
    await pushApiFetch('/api/push/subscription', {
      method: 'DELETE',
      body: JSON.stringify({ deviceId: currentDeviceId }),
    });
  }, []);

  const synchronizeServer = useCallback(
    async (subscription: PushSubscription, currentDeviceId: string) => {
      const keys = subscriptionKeys(subscription);
      await pushApiFetch<ServerSubscriptionResponse>('/api/push/subscription', {
        method: 'PUT',
        body: JSON.stringify({
          deviceId: currentDeviceId,
          endpoint: subscription.endpoint,
          auth: keys.auth,
          p256dh: keys.p256dh,
          userAgent: navigator.userAgent,
        }),
      });
    },
    []
  );

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const iosInstallRequired = requiresIosHomeScreenInstall();
    const supported =
      !iosInstallRequired &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    const currentDeviceId = getPushDeviceId();

    setRequiresIosInstall(iosInstallRequired);
    setIsSupported(supported);
    setDeviceId(currentDeviceId);
    if ('Notification' in window) setPermission(Notification.permission);

    if (!supported || !user || !currentDeviceId) {
      setIsSubscribed(false);
      setServerSynchronized(false);
      setServiceWorkerReady(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      setServiceWorkerReady(Boolean(registration?.active));
      let subscription = await registration?.pushManager.getSubscription();

      if (Notification.permission !== 'granted' || !subscription) {
        await unregisterServerDevice(currentDeviceId);
        if (sequence === refreshSequence.current) {
          setIsSubscribed(false);
          setServerSynchronized(false);
          setError(null);
        }
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey)
        throw new Error(tRef.current('components.pushNotifications.errors.vapidMissing'));
      const expectedKey = urlBase64ToUint8Array(vapidPublicKey);
      if (!keysMatch(subscription.options.applicationServerKey, expectedKey)) {
        await subscription.unsubscribe();
        await unregisterServerDevice(currentDeviceId);
        const readyRegistration = await ensureServiceWorker();
        subscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedKey,
        });
      }

      await synchronizeServer(subscription, currentDeviceId);
      if (sequence === refreshSequence.current) {
        setServiceWorkerReady(true);
        setServerSynchronized(true);
        setIsSubscribed(true);
        setError(null);
      }
    } catch (refreshError) {
      if (sequence === refreshSequence.current) {
        setIsSubscribed(false);
        setServerSynchronized(false);
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : tRef.current('components.pushNotifications.errors.changeFailed')
        );
      }
    } finally {
      if (sequence === refreshSequence.current) setIsLoading(false);
    }
  }, [synchronizeServer, unregisterServerDevice, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleEnvironmentChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', handleEnvironmentChange);
    document.addEventListener('visibilitychange', handleEnvironmentChange);
    return () => {
      window.removeEventListener('focus', handleEnvironmentChange);
      document.removeEventListener('visibilitychange', handleEnvironmentChange);
    };
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      throw new Error(tRef.current('components.pushNotifications.errors.notSupported'));
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      throw new Error(tRef.current('components.pushNotifications.errors.permissionRequest'));
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (requiresIosInstall) {
      const installError = tRef.current('components.pushNotifications.errors.iosInstallRequired');
      setError(installError);
      throw new Error(installError);
    }
    if (!isSupported || !user || !deviceId) {
      const unsupportedError = tRef.current(
        user
          ? 'components.pushNotifications.errors.notSupported'
          : 'components.pushNotifications.errors.notLoggedIn'
      );
      setError(unsupportedError);
      throw new Error(unsupportedError);
    }

    setIsLoading(true);
    setError(null);
    try {
      let currentPermission = Notification.permission;
      if (currentPermission === 'denied') {
        throw new Error(tRef.current('components.pushNotifications.errors.permissionBlocked'));
      }
      if (currentPermission !== 'granted') currentPermission = await requestPermission();
      if (currentPermission !== 'granted') {
        throw new Error(
          currentPermission === 'denied'
            ? tRef.current('components.pushNotifications.errors.permissionBlocked')
            : tRef.current('components.pushNotifications.errors.permissionDismissed')
        );
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey)
        throw new Error(tRef.current('components.pushNotifications.errors.vapidMissing'));
      const expectedKey = urlBase64ToUint8Array(vapidPublicKey);
      const registration = await ensureServiceWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !keysMatch(subscription.options.applicationServerKey, expectedKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedKey,
      });

      await synchronizeServer(subscription, deviceId);
      setServiceWorkerReady(true);
      setServerSynchronized(true);
      setIsSubscribed(true);
      setPermission(Notification.permission);
    } catch (subscribeError) {
      const subscribeMessage =
        subscribeError instanceof Error
          ? subscribeError.message
          : tRef.current('components.pushNotifications.errors.subscribeFailed');
      setError(subscribeMessage);
      setIsSubscribed(false);
      setServerSynchronized(false);
      throw subscribeError;
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, isSupported, requestPermission, requiresIosInstall, synchronizeServer, user]);

  const unsubscribe = useCallback(async () => {
    if (!user || !deviceId) {
      throw new Error(tRef.current('components.pushNotifications.errors.notLoggedIn'));
    }
    setIsLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      await unregisterServerDevice(deviceId);
      setIsSubscribed(false);
      setServerSynchronized(false);
    } catch (unsubscribeError) {
      const unsubscribeMessage =
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : tRef.current('components.pushNotifications.errors.unsubscribeFailed');
      setError(unsubscribeMessage);
      throw unsubscribeError;
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, unregisterServerDevice, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    serviceWorkerReady,
    serverSynchronized,
    requiresIosInstall,
    deviceId,
    subscribe,
    unsubscribe,
    requestPermission,
    refresh,
  };
}
