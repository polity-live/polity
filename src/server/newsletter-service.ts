import { createClient } from '@supabase/supabase-js';
import { Resend, type WebhookEventPayload } from 'resend';

type SupabaseClient = ReturnType<typeof createClient>;

export interface NewsletterSyncJob {
  id: number;
  user_id: string | null;
  operation: 'upsert' | 'replace_email' | 'delete';
  email: string;
  previous_email: string | null;
  resend_contact_id: string | null;
  language: NewsletterLanguage;
  subscribed: boolean;
  attempt_count: number;
}

interface NewsletterSubscription {
  user_id: string;
  email: string;
  subscribed: boolean;
  resend_contact_id: string | null;
  language: NewsletterLanguage;
}

export type NewsletterLanguage = 'de' | 'en';

interface NewsletterConfig {
  apiKey: string;
  webhookSecret: string;
  segmentIdDe: string;
  segmentIdEn: string;
  topicId: string;
  syncSecret: string;
  environment: 'development' | 'production';
  syncEnabled: boolean;
  allowedRecipients: string[];
}

interface NewsletterServiceDeps {
  supabase?: SupabaseClient;
  resend?: Resend;
  config?: Partial<NewsletterConfig>;
}

interface ResendErrorLike {
  message?: string;
  statusCode?: number;
  status?: number;
  name?: string;
}

export class NewsletterHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'NewsletterHttpError';
    this.status = status;
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not defined`);
  return value;
}

function optionalEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function readConfig(overrides: Partial<NewsletterConfig> = {}): NewsletterConfig {
  const environmentValue =
    overrides.environment ?? process.env.NEWSLETTER_ENVIRONMENT ?? 'development';
  if (environmentValue !== 'development' && environmentValue !== 'production') {
    throw new Error('NEWSLETTER_ENVIRONMENT must be development or production');
  }

  return {
    apiKey: overrides.apiKey ?? requiredEnv('RESEND_API_KEY'),
    webhookSecret: overrides.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET?.trim() ?? '',
    segmentIdDe: overrides.segmentIdDe ?? optionalEnv('RESEND_SEGMENT_ID_DE'),
    segmentIdEn: overrides.segmentIdEn ?? optionalEnv('RESEND_SEGMENT_ID_EN'),
    topicId: overrides.topicId ?? requiredEnv('RESEND_TOPIC_ID'),
    syncSecret: overrides.syncSecret ?? process.env.NEWSLETTER_SYNC_SECRET?.trim() ?? '',
    environment: environmentValue,
    syncEnabled:
      overrides.syncEnabled ?? process.env.NEWSLETTER_SYNC_ENABLED?.toLowerCase() === 'true',
    allowedRecipients:
      overrides.allowedRecipients ??
      (process.env.NEWSLETTER_ALLOWED_RECIPIENTS ?? '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean),
  };
}

function assertNewsletterSegmentsConfigured(config: NewsletterConfig) {
  const requiredSegments = [
    ['RESEND_SEGMENT_ID_EN', config.segmentIdEn],
    ...(config.environment === 'production'
      ? ([['RESEND_SEGMENT_ID_DE', config.segmentIdDe]] as const)
      : []),
  ];
  const missing = requiredSegments.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Newsletter segments are not configured: ${missing.join(', ')}`);
  }
  if (config.environment === 'production' && config.segmentIdDe === config.segmentIdEn) {
    throw new Error('Production newsletter segments must use different IDs');
  }
}

function getSupabase(deps: NewsletterServiceDeps): SupabaseClient {
  return (
    deps.supabase ??
    createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
  );
}

function getResend(deps: NewsletterServiceDeps, config: NewsletterConfig): Resend {
  return deps.resend ?? new Resend(config.apiKey);
}

function table(supabase: SupabaseClient, name: string): any {
  return (supabase.from as any)(name);
}

function messageFromResendError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ResendErrorLike).message);
  }
  return 'resend_request_failed';
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as ResendErrorLike;
  return value.statusCode === 404 || value.status === 404 || value.name === 'not_found';
}

function isDuplicateDatabaseError(error: any): boolean {
  return error?.code === '23505';
}

function recipientAllowed(email: string, config: NewsletterConfig): boolean {
  if (config.environment === 'production') return true;
  const normalized = email.toLowerCase();
  return config.allowedRecipients.some(entry =>
    entry.startsWith('@') ? normalized.endsWith(entry) : normalized === entry
  );
}

function normalizeNewsletterLanguage(value: unknown): NewsletterLanguage {
  return value === 'de' ? 'de' : 'en';
}

async function loadSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<NewsletterSubscription | null> {
  const { data, error } = await table(supabase, 'newsletter_subscription')
    .select('user_id,email,language,subscribed,resend_contact_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as NewsletterSubscription | null;
}

async function findContact(resend: Resend, email: string) {
  const result = await resend.contacts.get({ email });
  if (result.error) return null;
  return result.data;
}

async function ensureContact(
  resend: Resend,
  config: NewsletterConfig,
  subscription: NewsletterSubscription
): Promise<{ contactId: string; subscribed: boolean }> {
  if (!recipientAllowed(subscription.email, config)) {
    throw new Error(`Recipient ${subscription.email} is not allowed outside production`);
  }

  const language = normalizeNewsletterLanguage(subscription.language);
  const targetSegmentId =
    config.environment === 'development'
      ? config.segmentIdEn
      : language === 'de'
        ? config.segmentIdDe
        : config.segmentIdEn;
  const segmentsToRemove = [config.segmentIdDe, config.segmentIdEn].filter(
    segmentId => segmentId && segmentId !== targetSegmentId
  );
  const contact = subscription.resend_contact_id
    ? await resend.contacts.get({ id: subscription.resend_contact_id })
    : null;
  let contactData = contact && !contact.error ? contact.data : null;
  let contactId = contactData?.id ?? null;

  if (!contactId) {
    const existing = await findContact(resend, subscription.email);
    contactData = existing;
    contactId = existing?.id ?? null;
  }

  let createdContact = false;
  if (!contactId) {
    const created = await resend.contacts.create({
      email: subscription.email,
      unsubscribed: !subscription.subscribed,
      properties: {
        polity_user_id: subscription.user_id,
        environment: config.environment,
        language,
      },
      segments: [{ id: targetSegmentId }],
      topics: [
        { id: config.topicId, subscription: subscription.subscribed ? 'opt_in' : 'opt_out' },
      ],
    });

    if (created.error || !created.data?.id) {
      const existingAfterConflict = await findContact(resend, subscription.email);
      if (!existingAfterConflict?.id) throw new Error(messageFromResendError(created.error));
      contactData = existingAfterConflict;
      contactId = existingAfterConflict.id;
    } else {
      contactId = created.data.id;
      createdContact = true;
    }
  }

  const updated = await resend.contacts.update({
    id: contactId,
    properties: {
      polity_user_id: subscription.user_id,
      environment: config.environment,
      language,
    },
  });
  if (updated.error) throw new Error(messageFromResendError(updated.error));

  const segments = await resend.contacts.segments.list({ contactId });
  if (segments.error) throw new Error(messageFromResendError(segments.error));
  const currentSegmentIds = new Set(segments.data?.data.map(segment => segment.id) ?? []);
  if (!currentSegmentIds.has(targetSegmentId)) {
    const added = await resend.contacts.segments.add({ contactId, segmentId: targetSegmentId });
    if (added.error) throw new Error(messageFromResendError(added.error));
  }
  for (const segmentId of segmentsToRemove) {
    if (!currentSegmentIds.has(segmentId)) continue;
    const removed = await resend.contacts.segments.remove({ contactId, segmentId });
    if (removed.error) throw new Error(messageFromResendError(removed.error));
  }

  if (createdContact) {
    return { contactId, subscribed: subscription.subscribed };
  }

  const topics = await resend.contacts.topics.list({ id: contactId });
  if (topics.error) throw new Error(messageFromResendError(topics.error));
  const topicSubscription = topics.data?.data.find(
    topic => topic.id === config.topicId
  )?.subscription;

  if (!subscription.subscribed && topicSubscription !== 'opt_out') {
    const topicUpdate = await resend.contacts.topics.update({
      id: contactId,
      topics: [{ id: config.topicId, subscription: 'opt_out' }],
    });
    if (topicUpdate.error) throw new Error(messageFromResendError(topicUpdate.error));
  }

  const remainsSubscribed =
    subscription.subscribed && !contactData?.unsubscribed && topicSubscription === 'opt_in';
  return { contactId, subscribed: remainsSubscribed };
}

async function removeContact(resend: Resend, selector: { id: string } | { email: string }) {
  const result = await resend.contacts.remove(selector);
  if (result.error && !isNotFound(result.error)) {
    throw new Error(messageFromResendError(result.error));
  }
}

async function completeJob(supabase: SupabaseClient, jobId: number) {
  const { error } = await table(supabase, 'newsletter_sync_outbox')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

async function failJob(supabase: SupabaseClient, job: NewsletterSyncJob, error: unknown) {
  const retrySeconds = Math.min(2 ** Math.min(job.attempt_count, 12), 3600);
  const availableAt = new Date(Date.now() + retrySeconds * 1000).toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const { error: updateError } = await table(supabase, 'newsletter_sync_outbox')
    .update({
      status: 'failed',
      available_at: availableAt,
      locked_at: null,
      last_error: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (updateError) throw new Error(updateError.message);
}

async function processJob(
  job: NewsletterSyncJob,
  supabase: SupabaseClient,
  resend: Resend,
  config: NewsletterConfig
) {
  if (job.operation === 'delete') {
    await removeContact(
      resend,
      job.resend_contact_id ? { id: job.resend_contact_id } : { email: job.email }
    );
    await completeJob(supabase, job.id);
    return;
  }

  if (!job.user_id) {
    await completeJob(supabase, job.id);
    return;
  }

  const current = await loadSubscription(supabase, job.user_id);
  if (!current || current.email.toLowerCase() !== job.email.toLowerCase()) {
    await completeJob(supabase, job.id);
    return;
  }

  if (job.operation === 'replace_email' && (job.resend_contact_id || job.previous_email)) {
    const previousContact = job.resend_contact_id
      ? { id: job.resend_contact_id }
      : { email: job.previous_email ?? job.email };
    await removeContact(resend, previousContact);
  }

  const contact = await ensureContact(resend, config, current);
  const now = new Date().toISOString();
  const { error } = await table(supabase, 'newsletter_subscription')
    .update({
      resend_contact_id: contact.contactId,
      subscribed: contact.subscribed,
      sync_status: contact.subscribed ? 'synced' : 'unsubscribed',
      subscribed_at: contact.subscribed ? now : undefined,
      unsubscribed_at: contact.subscribed ? null : now,
      last_synced_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq('user_id', current.user_id);
  if (error) throw new Error(error.message);
  await completeJob(supabase, job.id);
}

export async function executeNewsletterSync(deps: NewsletterServiceDeps = {}) {
  const config = readConfig(deps.config);
  if (!config.syncEnabled) return { enabled: false, processed: 0, failed: 0 };
  assertNewsletterSegmentsConfigured(config);

  const supabase = getSupabase(deps);
  const resend = getResend(deps, config);
  const { data, error } = await (supabase.rpc as any)('claim_newsletter_sync_jobs', {
    job_limit: 100,
  });
  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as NewsletterSyncJob[];
  let failed = 0;
  for (const job of jobs) {
    try {
      await processJob(job, supabase, resend, config);
    } catch (jobError) {
      failed += 1;
      await failJob(supabase, job, jobError);
    }
  }

  return { enabled: true, processed: jobs.length - failed, failed };
}

export function authorizeNewsletterSync(request: Request, deps: NewsletterServiceDeps = {}) {
  const config = readConfig(deps.config);
  if (!config.syncSecret) throw new NewsletterHttpError('Newsletter sync is not configured', 503);
  if (request.headers.get('authorization') !== `Bearer ${config.syncSecret}`) {
    throw new NewsletterHttpError('Unauthorized', 401);
  }
}

async function processContactWebhook(
  event: WebhookEventPayload,
  supabase: SupabaseClient,
  resend: Resend,
  config: NewsletterConfig
) {
  if (event.type !== 'contact.updated' && event.type !== 'contact.deleted') return;

  const contactId = event.data.id;
  const { data: subscription, error } = await table(supabase, 'newsletter_subscription')
    .select('user_id,email,subscribed,resend_contact_id')
    .eq('resend_contact_id', contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!subscription) return;

  const now = new Date().toISOString();
  if (event.type === 'contact.deleted') {
    const { error: updateError } = await table(supabase, 'newsletter_subscription')
      .update({
        subscribed: false,
        sync_status: 'deleted',
        resend_contact_id: null,
        unsubscribed_at: now,
        last_synced_at: now,
        updated_at: now,
      })
      .eq('user_id', subscription.user_id);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  let subscribed = !event.data.unsubscribed;
  if (subscribed) {
    const topics = await resend.contacts.topics.list({ id: contactId });
    if (topics.error) throw new Error(messageFromResendError(topics.error));
    subscribed =
      topics.data?.data.some(
        topic => topic.id === config.topicId && topic.subscription === 'opt_in'
      ) ?? false;
  }

  const { error: updateError } = await table(supabase, 'newsletter_subscription')
    .update({
      subscribed,
      sync_status: subscribed ? 'synced' : 'unsubscribed',
      subscribed_at: subscribed ? now : undefined,
      unsubscribed_at: subscribed ? null : now,
      last_synced_at: now,
      updated_at: now,
    })
    .eq('user_id', subscription.user_id);
  if (updateError) throw new Error(updateError.message);
}

export async function handleResendWebhook(
  input: { rawBody: string; svixId: string; svixTimestamp: string; svixSignature: string },
  deps: NewsletterServiceDeps = {}
) {
  const config = readConfig(deps.config);
  if (!config.webhookSecret) throw new NewsletterHttpError('Webhook is not configured', 503);
  const supabase = getSupabase(deps);
  const resend = getResend(deps, config);

  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
      payload: input.rawBody,
      headers: {
        id: input.svixId,
        timestamp: input.svixTimestamp,
        signature: input.svixSignature,
      },
      webhookSecret: config.webhookSecret,
    });
  } catch {
    throw new NewsletterHttpError('Invalid Resend signature', 400);
  }

  const { error: insertError } = await table(supabase, 'resend_webhook_event').insert({
    svix_id: input.svixId,
    event_type: event.type,
    event_created_at: event.created_at,
    payload: event,
  });
  if (isDuplicateDatabaseError(insertError)) return { duplicate: true };
  if (insertError) throw new Error(insertError.message);

  try {
    await processContactWebhook(event, supabase, resend, config);
  } catch (error) {
    await table(supabase, 'resend_webhook_event').delete().eq('svix_id', input.svixId);
    throw error;
  }

  return { duplicate: false, type: event.type };
}
