import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { z } from 'zod';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function initVapid() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('Missing VAPID configuration');
  }
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:your-email@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const pushSendSchema = z.object({
  userId: z.string(),
  notification: z.object({
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().optional(),
    notificationId: z.string().optional(),
    type: z.string().optional(),
    icon: z.string().optional(),
    badge: z.string().optional(),
    tag: z.string().optional(),
    requireInteraction: z.boolean().optional(),
    actions: z
      .array(
        z.object({
          action: z.string(),
          title: z.string(),
          icon: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export const pushSendFn = createServerFn({ method: 'POST' })
  .validator(pushSendSchema.parse)
  .handler(async ({ data }) => {
    try {
      const { userId, notification } = data;

      if (!userId || !notification) {
        throw new Error('Missing userId or notification data');
      }

      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.error('[Push API] VAPID keys not configured');
        throw new Error('Push notifications not configured');
      }

      initVapid();

      const supabase = getSupabase();

      // Query all push subscriptions for this user
      const { data: subscriptions } = await supabase
        .from('push_subscription')
        .select('id, endpoint, auth, p256dh, user_id')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) {
        return {
          message: translateText('generated.inline.0680_no_subscriptions_found_6f645f78'),
          sent: 0,
          failed: 0,
        };
      }

      // Prepare notification payload
      const payload = JSON.stringify({
        title: notification.title,
        message: notification.message,
        body: notification.message,
        actionUrl: notification.actionUrl,
        notificationId: notification.notificationId,
        type: notification.type,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/icon-192x192.png',
        tag: notification.tag || notification.type || 'notification',
        requireInteraction: notification.requireInteraction || false,
        actions: notification.actions || [],
      });

      // Send push notification to all subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(async subscription => {
          try {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            };

            await webpush.sendNotification(pushSubscription, payload);

            return { success: true, subscriptionId: subscription.id };
          } catch (error: unknown) {
            const err = error as { statusCode?: number; message?: string };
            console.error(`[Push API] Failed to send to subscription ${subscription.id}:`, error);

            // Handle expired or invalid subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
              try {
                await supabase.from('push_subscription').delete().eq('id', subscription.id);
              } catch (deleteError) {
                console.error(
                  `[Push API] Failed to delete subscription ${subscription.id}:`,
                  deleteError
                );
              }
            }

            return {
              success: false,
              subscriptionId: subscription.id,
              error: err.message,
            };
          }
        })
      );

      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length;

      return {
        message: translateText('generated.inline.0681_push_notifications_sent_adb2827e'),
        sent,
        failed,
        total: subscriptions.length,
      };
    } catch (error) {
      console.error('[Push API] Error sending push notifications:', error);
      throw new Error('Failed to send push notifications');
    }
  });

/** Health check — call with GET semantics from an API route if needed */
export const pushHealthCheckFn = createServerFn({ method: 'GET' }).handler(async () => {
  const isConfigured = !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

  return {
    status: 'ok',
    pushNotificationsEnabled: isConfigured,
    vapidPublicKey:
      isConfigured && process.env.VAPID_PUBLIC_KEY
        ? process.env.VAPID_PUBLIC_KEY.substring(0, 20) + '...'
        : 'Not configured',
  };
});
