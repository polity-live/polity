import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';

import { NOTIFICATION_TYPE_TO_SETTING } from '@/features/notifications/logic/notificationTypeSettingMap';
import { localizeNotificationCopy } from '@/features/notifications/logic/localizeNotificationCopy';

type ServerSupabase = SupabaseClient<any, 'public', any>;
type PushJobStatus = 'pending' | 'processing' | 'sent' | 'skipped' | 'failed';

interface PushPayload {
  title: string;
  message?: string;
  body?: string;
  actionUrl?: string;
  notificationId?: string;
  type?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  foregroundBehavior?: 'toast' | 'system';
  language?: 'en' | 'de';
}

interface NotificationJob {
  id: number | string;
  notification_id: string;
  attempt_count: number;
}

interface DeliveryJob {
  id: number | string;
  notification_id: string | null;
  user_id: string;
  push_subscription_id: string | null;
  kind: 'notification' | 'test';
  payload: PushPayload;
  status: PushJobStatus;
  attempt_count: number;
}

interface PushDeliveryConfig {
  enabled: boolean;
  publicKey: string;
  privateKey: string;
  email: string;
}

type SendPushNotification = (
  subscription: { endpoint: string; keys: { auth: string; p256dh: string } },
  payload: string
) => Promise<unknown>;

interface PushDeliveryDependencies {
  supabase?: ServerSupabase;
  config?: Partial<PushDeliveryConfig>;
  initializeVapid?: (config: PushDeliveryConfig) => void;
  sendNotification?: SendPushNotification;
}

export interface PushDeliveryResult {
  disabled: boolean;
  expanded: number;
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
  removedSubscriptions: number;
}

export interface ExecutePushDeliveryOptions {
  notificationId?: string;
  deliveryId?: string;
  limit?: number;
}

const MAX_ATTEMPTS = 8;

function getSupabase(): ServerSupabase {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Missing Supabase configuration');
  return createClient(url, key);
}

function table(supabase: ServerSupabase, name: string): any {
  return (supabase.from as any)(name);
}

function readConfig(): PushDeliveryConfig {
  return {
    enabled: process.env.PUSH_DELIVERY_ENABLED?.trim().toLowerCase() === 'true',
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? '',
    email: process.env.VAPID_EMAIL?.trim() || 'mailto:support@polity.live',
  };
}

function initVapid(config: PushDeliveryConfig) {
  if (!config.publicKey || !config.privateKey) throw new Error('Missing VAPID configuration');
  webpush.setVapidDetails(config.email, config.publicKey, config.privateKey);
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function pushRetryDelayMs(attemptCount: number) {
  return Math.min(2 ** Math.max(attemptCount - 1, 0) * 60_000, 3_600_000);
}

export function isRetryablePushStatus(statusCode: number | undefined) {
  return statusCode === undefined || statusCode === 429 || statusCode >= 500;
}

async function updateJob(
  supabase: ServerSupabase,
  id: number | string,
  values: Record<string, unknown>
) {
  const { error } = await table(supabase, 'push_delivery_outbox')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function skipJob(supabase: ServerSupabase, job: DeliveryJob, reason: string) {
  await updateJob(supabase, job.id, {
    status: 'skipped',
    skip_reason: reason,
    completed_at: new Date().toISOString(),
    locked_at: null,
    last_error: null,
  });
}

async function failOrRetryJob(
  supabase: ServerSupabase,
  job: DeliveryJob,
  error: unknown,
  retryable: boolean
): Promise<'retried' | 'failed'> {
  if (retryable && job.attempt_count < MAX_ATTEMPTS) {
    await updateJob(supabase, job.id, {
      status: 'pending',
      available_at: new Date(Date.now() + pushRetryDelayMs(job.attempt_count)).toISOString(),
      locked_at: null,
      last_error: message(error),
    });
    return 'retried';
  }

  await updateJob(supabase, job.id, {
    status: 'failed',
    completed_at: new Date().toISOString(),
    locked_at: null,
    last_error: message(error),
  });
  return 'failed';
}

export function isPushNotificationEnabled(type: string | undefined, settings: any) {
  if (settings?.delivery_settings?.pushNotifications === false) return false;
  if (!type) return true;
  const path = (
    NOTIFICATION_TYPE_TO_SETTING as Record<string, { category: string; key: string } | undefined>
  )[type];
  if (!path) return true;
  const databaseCategory: Record<string, string> = {
    groupNotifications: 'group_notifications',
    eventNotifications: 'event_notifications',
    amendmentNotifications: 'amendment_notifications',
    blogNotifications: 'blog_notifications',
    todoNotifications: 'todo_notifications',
    socialNotifications: 'social_notifications',
  };
  return settings?.[databaseCategory[path.category]]?.[path.key] !== false;
}

async function processDeliveryJob(
  supabase: ServerSupabase,
  job: DeliveryJob,
  sendNotification: SendPushNotification
): Promise<'sent' | 'skipped' | 'retried' | 'failed' | 'removed'> {
  if (!job.push_subscription_id) {
    await skipJob(supabase, job, 'subscription_missing');
    return 'skipped';
  }

  const [
    { data: subscription, error: subscriptionError },
    { data: settings, error: settingsError },
    { data: preference, error: preferenceError },
  ] = await Promise.all([
    table(supabase, 'push_subscription')
      .select('id,user_id,endpoint,auth,p256dh')
      .eq('id', job.push_subscription_id)
      .maybeSingle(),
    table(supabase, 'notification_setting')
      .select(
        'delivery_settings,group_notifications,event_notifications,amendment_notifications,blog_notifications,todo_notifications,social_notifications'
      )
      .eq('user_id', job.user_id)
      .maybeSingle(),
    table(supabase, 'user_preference').select('language').eq('user_id', job.user_id).maybeSingle(),
  ]);

  if (subscriptionError) throw new Error(subscriptionError.message);
  if (settingsError) throw new Error(settingsError.message);
  if (preferenceError) throw new Error(preferenceError.message);
  if (
    !subscription ||
    subscription.user_id !== job.user_id ||
    !subscription.auth ||
    !subscription.p256dh
  ) {
    await skipJob(supabase, job, 'subscription_missing');
    return 'skipped';
  }
  if (!isPushNotificationEnabled(job.payload.type, settings)) {
    await skipJob(supabase, job, 'disabled_by_settings');
    return 'skipped';
  }
  try {
    const language = preference?.language === 'de' ? 'de' : 'en';
    const localizedMessage = localizeNotificationCopy(job.payload.message, language);
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      JSON.stringify({
        ...job.payload,
        title: localizeNotificationCopy(job.payload.title, language) ?? job.payload.title,
        message: localizedMessage,
        body: localizeNotificationCopy(job.payload.body ?? job.payload.message, language),
        language,
      })
    );
    await updateJob(supabase, job.id, {
      status: 'sent',
      completed_at: new Date().toISOString(),
      locked_at: null,
      last_error: null,
      skip_reason: null,
    });
    return 'sent';
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await skipJob(supabase, job, 'subscription_expired');
      const { error: deleteError } = await table(supabase, 'push_subscription')
        .delete()
        .eq('id', subscription.id);
      if (deleteError) console.error('[PushDelivery] Expired subscription cleanup failed');
      return 'removed';
    }
    const retryable = isRetryablePushStatus(statusCode);
    return failOrRetryJob(supabase, job, error, retryable);
  }
}

async function retryNotificationJob(
  supabase: ServerSupabase,
  job: NotificationJob,
  error: unknown
) {
  const failed = job.attempt_count >= MAX_ATTEMPTS;
  const { error: updateError } = await table(supabase, 'push_notification_outbox')
    .update({
      status: failed ? 'failed' : 'pending',
      available_at: failed
        ? new Date().toISOString()
        : new Date(Date.now() + pushRetryDelayMs(job.attempt_count)).toISOString(),
      completed_at: failed ? new Date().toISOString() : null,
      locked_at: null,
      last_error: message(error),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (updateError) throw new Error(updateError.message);
}

export async function executePushDelivery(
  options: ExecutePushDeliveryOptions = {},
  deps: PushDeliveryDependencies = {}
): Promise<PushDeliveryResult> {
  const config = { ...readConfig(), ...deps.config };
  const result: PushDeliveryResult = {
    disabled: !config.enabled,
    expanded: 0,
    claimed: 0,
    sent: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    removedSubscriptions: 0,
  };
  if (!config.enabled) return result;

  (deps.initializeVapid ?? initVapid)(config);
  const supabase = deps.supabase ?? getSupabase();
  const sendNotification =
    deps.sendNotification ??
    ((subscription, payload) => webpush.sendNotification(subscription, payload));
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);

  const { data: notificationJobs, error: notificationClaimError } = await (supabase.rpc as any)(
    'claim_push_notification_jobs',
    { job_limit: limit, notification_filter: options.notificationId ?? null }
  );
  if (notificationClaimError) throw new Error(notificationClaimError.message);

  for (const job of (notificationJobs ?? []) as NotificationJob[]) {
    try {
      const { data, error } = await (supabase.rpc as any)('expand_push_notification_job', {
        target_job_id: job.id,
      });
      if (error) throw new Error(error.message);
      result.expanded += Number(data ?? 0);
    } catch (error) {
      await retryNotificationJob(supabase, job, error);
      console.error('[PushDelivery] Audience expansion failed:', message(error));
    }
  }

  const { data: deliveryJobs, error: deliveryClaimError } = await (supabase.rpc as any)(
    'claim_push_delivery_jobs',
    {
      job_limit: limit,
      notification_filter: options.notificationId ?? null,
      delivery_filter: options.deliveryId ?? null,
    }
  );
  if (deliveryClaimError) throw new Error(deliveryClaimError.message);

  result.claimed = deliveryJobs?.length ?? 0;
  for (const job of (deliveryJobs ?? []) as DeliveryJob[]) {
    try {
      const outcome = await processDeliveryJob(supabase, job, sendNotification);
      if (outcome === 'sent') result.sent += 1;
      else if (outcome === 'skipped') result.skipped += 1;
      else if (outcome === 'retried') result.retried += 1;
      else if (outcome === 'failed') result.failed += 1;
      else result.removedSubscriptions += 1;
    } catch (error) {
      const outcome = await failOrRetryJob(supabase, job, error, true);
      result[outcome] += 1;
    }
  }

  console.info('[PushDelivery]', result);
  return result;
}

export function authorizePushDelivery(request: Request) {
  const expected = process.env.PUSH_DELIVERY_SECRET?.trim() ?? '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (
    !expected ||
    expectedBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    throw new PushDeliveryHttpError('Unauthorized', 401);
  }
}

export class PushDeliveryHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'PushDeliveryHttpError';
  }
}

export function buildDirectPushPayload(
  notificationId: string,
  payload: Pick<PushPayload, 'title' | 'message' | 'actionUrl' | 'type'>
): PushPayload {
  return {
    ...payload,
    body: payload.message,
    notificationId,
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: notificationId,
    requireInteraction: false,
    foregroundBehavior: 'system',
  };
}

export function buildPushTestPayload(
  testId: string,
  payload: Pick<PushPayload, 'title' | 'message'>
): PushPayload {
  return {
    title: payload.title,
    message: payload.message,
    body: payload.message,
    actionUrl: '/notifications',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: `push-test:${testId}`,
    requireInteraction: false,
    foregroundBehavior: 'system',
  };
}

export async function enqueueDirectPushDelivery(
  userId: string,
  notificationId: string,
  payload: Pick<PushPayload, 'title' | 'message' | 'actionUrl' | 'type'>
) {
  const supabase = getSupabase();
  const fullPayload = buildDirectPushPayload(notificationId, payload);
  const { data, error } = await (supabase.rpc as any)('enqueue_direct_push_delivery', {
    target_user_id: userId,
    target_dedupe_key: `direct:${notificationId}`,
    target_payload: fullPayload,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function schedulePushTest(
  userId: string,
  deviceId: string,
  payload: Pick<PushPayload, 'title' | 'message'>
) {
  const supabase = getSupabase();
  const { data: subscription, error } = await table(supabase, 'push_subscription')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!subscription) throw new PushDeliveryHttpError('No server subscription for this device', 409);

  const testId = crypto.randomUUID();
  const { data: job, error: insertError } = await table(supabase, 'push_delivery_outbox')
    .insert({
      user_id: userId,
      push_subscription_id: subscription.id,
      kind: 'test',
      dedupe_key: `test:${testId}`,
      payload: buildPushTestPayload(testId, payload),
      available_at: new Date(Date.now() + 5000).toISOString(),
    })
    .select('id,status,available_at')
    .single();
  if (insertError) throw new Error(insertError.message);
  return { jobId: String(job.id), status: job.status, scheduledAt: job.available_at };
}

export async function getPushTestStatus(userId: string, deliveryId: string) {
  if (!/^\d+$/.test(deliveryId)) {
    throw new PushDeliveryHttpError('Invalid test job id', 400);
  }

  const supabase = getSupabase();
  const { data, error } = await table(supabase, 'push_delivery_outbox')
    .select('id,status,skip_reason,last_error,available_at,completed_at')
    .eq('id', deliveryId)
    .eq('user_id', userId)
    .eq('kind', 'test')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PushDeliveryHttpError('Test job not found', 404);
  return {
    jobId: String(data.id),
    status: data.status as PushJobStatus,
    skipReason: data.skip_reason,
    error: data.last_error,
    scheduledAt: data.available_at,
    completedAt: data.completed_at,
  };
}

export async function processPushTest(userId: string, deliveryId: string) {
  await getPushTestStatus(userId, deliveryId);
  await executePushDelivery({ deliveryId });
  return getPushTestStatus(userId, deliveryId);
}
