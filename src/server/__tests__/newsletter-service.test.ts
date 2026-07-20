import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authorizeNewsletterSync,
  executeNewsletterSync,
  handleResendWebhook,
  NewsletterHttpError,
  type NewsletterSyncJob,
} from '@/server/newsletter-service';
import { handleResendWebhookRequest } from '@/server/newsletter-routes';

type Row = Record<string, any>;

class FakeQuery {
  private filters: [string, unknown][] = [];
  private operation: 'select' | 'update' | 'delete' | null = null;
  private payload: Row = {};

  constructor(
    private readonly rows: Row[],
    private readonly insertHandler?: (payload: Row) => { error: any }
  ) {}

  select() {
    this.operation = 'select';
    return this;
  }

  update(payload: Row) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  insert(payload: Row) {
    if (this.insertHandler) return Promise.resolve(this.insertHandler(payload));
    this.rows.push({ ...payload });
    return Promise.resolve({ error: null });
  }

  async maybeSingle() {
    return { data: this.matches()[0] ?? null, error: null };
  }

  then(resolve: (value: any) => void, reject?: (error: unknown) => void) {
    try {
      if (this.operation === 'update') {
        for (const row of this.matches()) {
          for (const [key, value] of Object.entries(this.payload)) {
            if (value !== undefined) row[key] = value;
          }
        }
      } else if (this.operation === 'delete') {
        const matches = new Set(this.matches());
        for (let index = this.rows.length - 1; index >= 0; index -= 1) {
          if (matches.has(this.rows[index])) this.rows.splice(index, 1);
        }
      }
      resolve({ data: this.matches(), error: null });
    } catch (error) {
      reject?.(error);
    }
  }

  private matches() {
    return this.rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
  }
}

function createFakeSupabase(input: { subscriptions?: Row[]; jobs?: NewsletterSyncJob[] } = {}) {
  const subscriptions = (input.subscriptions ?? []).map(row => ({ ...row }));
  const jobs: Row[] = (input.jobs ?? []).map(row => ({ ...row }));
  const events: Row[] = [];

  const client = {
    rpc: vi.fn(async () => ({ data: jobs, error: null })),
    from: (name: string) => {
      if (name === 'newsletter_subscription') return new FakeQuery(subscriptions);
      if (name === 'newsletter_sync_outbox') return new FakeQuery(jobs);
      if (name === 'resend_webhook_event') {
        return new FakeQuery(events, payload => {
          if (events.some(event => event.svix_id === payload.svix_id)) {
            return { error: { code: '23505', message: 'duplicate' } };
          }
          events.push({ ...payload });
          return { error: null };
        });
      }
      throw new Error(`Unexpected table ${name}`);
    },
  };

  return { client, subscriptions, jobs, events };
}

function createFakeResend() {
  const contacts = new Map<string, Row>();
  const segmentMembership = new Map<string, Set<string>>();
  const topicMembership = new Map<string, 'opt_in' | 'opt_out'>();
  let verifiedEvent: any = null;
  let rejectSignature = false;

  const resend = {
    contacts: {
      get: vi.fn(async ({ id, email }: { id?: string; email?: string }) => {
        const contact = id
          ? contacts.get(id)
          : [...contacts.values()].find(value => value.email === email);
        return contact
          ? { data: contact, error: null }
          : { data: null, error: { name: 'not_found', statusCode: 404, message: 'Not found' } };
      }),
      create: vi.fn(async (payload: Row) => {
        const id = `contact-${contacts.size + 1}`;
        contacts.set(id, { id, ...payload });
        segmentMembership.set(id, new Set((payload.segments ?? []).map((item: Row) => item.id)));
        for (const topic of payload.topics ?? []) topicMembership.set(id, topic.subscription);
        return { data: { id }, error: null };
      }),
      update: vi.fn(async ({ id, ...payload }: Row) => {
        Object.assign(contacts.get(id) ?? {}, payload);
        return { data: { id }, error: null };
      }),
      remove: vi.fn(async ({ id, email }: Row) => {
        const contactId = id ?? [...contacts.values()].find(value => value.email === email)?.id;
        if (contactId) contacts.delete(contactId);
        return { data: { deleted: true }, error: null };
      }),
      segments: {
        list: vi.fn(async ({ contactId }: Row) => ({
          data: {
            data: [...(segmentMembership.get(contactId) ?? [])].map(id => ({ id })),
          },
          error: null,
        })),
        add: vi.fn(async ({ contactId, segmentId }: Row) => {
          const current = segmentMembership.get(contactId) ?? new Set<string>();
          current.add(segmentId);
          segmentMembership.set(contactId, current);
          return { data: { id: segmentId }, error: null };
        }),
      },
      topics: {
        update: vi.fn(async ({ id, topics }: Row) => {
          topicMembership.set(id, topics[0].subscription);
          return { data: { id }, error: null };
        }),
        list: vi.fn(async ({ id }: Row) => ({
          data: {
            data: topicMembership.has(id)
              ? [{ id: 'topic', subscription: topicMembership.get(id) }]
              : [],
          },
          error: null,
        })),
      },
    },
    webhooks: {
      verify: vi.fn(() => {
        if (rejectSignature) throw new Error('invalid');
        return verifiedEvent;
      }),
    },
  };

  return {
    resend,
    contacts,
    topicMembership,
    setEvent: (event: any) => {
      verifiedEvent = event;
    },
    rejectSignatures: () => {
      rejectSignature = true;
    },
  };
}

const config = {
  apiKey: 're_test',
  webhookSecret: 'whsec_test',
  segmentId: 'segment',
  topicId: 'topic',
  syncSecret: 'sync-secret',
  environment: 'production' as const,
  syncEnabled: true,
  allowedRecipients: [],
};

function job(overrides: Partial<NewsletterSyncJob> = {}): NewsletterSyncJob {
  return {
    id: 1,
    user_id: 'user-1',
    operation: 'upsert',
    email: 'person@example.com',
    previous_email: null,
    resend_contact_id: null,
    subscribed: true,
    attempt_count: 1,
    ...overrides,
  };
}

describe('newsletter sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a contact in the configured segment and topic', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        {
          user_id: 'user-1',
          email: 'person@example.com',
          subscribed: true,
          resend_contact_id: null,
        },
      ],
      jobs: [job()],
    });
    const api = createFakeResend();

    const result = await executeNewsletterSync({
      supabase: db.client as any,
      resend: api.resend as any,
      config,
    });

    expect(result).toEqual({ enabled: true, processed: 1, failed: 0 });
    expect(api.resend.contacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
        segments: [{ id: 'segment' }],
        topics: [{ id: 'topic', subscription: 'opt_in' }],
      })
    );
    expect(db.client.rpc).toHaveBeenCalledWith('claim_newsletter_sync_jobs', { job_limit: 100 });
    expect(db.subscriptions[0]).toMatchObject({
      resend_contact_id: 'contact-1',
      sync_status: 'synced',
    });
    expect(db.jobs[0].status).toBe('completed');
  });

  it('uses the current database opt-out instead of a stale queued opt-in', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        {
          user_id: 'user-1',
          email: 'person@example.com',
          subscribed: false,
          resend_contact_id: null,
        },
      ],
      jobs: [job({ subscribed: true })],
    });
    const api = createFakeResend();

    await executeNewsletterSync({ supabase: db.client as any, resend: api.resend as any, config });

    expect(api.resend.contacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribed: true,
        topics: [{ id: 'topic', subscription: 'opt_out' }],
      })
    );
    expect(db.subscriptions[0].sync_status).toBe('unsubscribed');
  });

  it('completes a stale job after an email change without recreating the old contact', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        { user_id: 'user-1', email: 'new@example.com', subscribed: true, resend_contact_id: null },
      ],
      jobs: [job({ email: 'old@example.com' })],
    });
    const api = createFakeResend();

    await executeNewsletterSync({ supabase: db.client as any, resend: api.resend as any, config });

    expect(api.resend.contacts.create).not.toHaveBeenCalled();
    expect(db.jobs[0].status).toBe('completed');
  });

  it('replaces the old Resend contact after a confirmed email change', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        { user_id: 'user-1', email: 'new@example.com', subscribed: false, resend_contact_id: null },
      ],
      jobs: [
        job({
          operation: 'replace_email',
          email: 'new@example.com',
          previous_email: 'old@example.com',
          resend_contact_id: 'contact-old',
          subscribed: false,
        }),
      ],
    });
    const api = createFakeResend();
    api.contacts.set('contact-old', { id: 'contact-old', email: 'old@example.com' });

    await executeNewsletterSync({ supabase: db.client as any, resend: api.resend as any, config });

    expect(api.resend.contacts.remove).toHaveBeenCalledWith({ id: 'contact-old' });
    expect(api.resend.contacts.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', unsubscribed: true })
    );
    expect(api.contacts.has('contact-old')).toBe(false);
  });

  it('deletes the Resend contact after an account deletion', async () => {
    const db = createFakeSupabase({
      jobs: [
        job({
          operation: 'delete',
          user_id: 'user-deleted',
          resend_contact_id: 'contact-old',
        }),
      ],
    });
    const api = createFakeResend();
    api.contacts.set('contact-old', { id: 'contact-old', email: 'person@example.com' });

    await executeNewsletterSync({ supabase: db.client as any, resend: api.resend as any, config });

    expect(api.resend.contacts.remove).toHaveBeenCalledWith({ id: 'contact-old' });
    expect(api.contacts.size).toBe(0);
    expect(db.jobs[0].status).toBe('completed');
  });

  it('fails closed for a development recipient outside the allowlist', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        {
          user_id: 'user-1',
          email: 'person@example.com',
          subscribed: true,
          resend_contact_id: null,
        },
      ],
      jobs: [job()],
    });
    const api = createFakeResend();

    const result = await executeNewsletterSync({
      supabase: db.client as any,
      resend: api.resend as any,
      config: { ...config, environment: 'development', allowedRecipients: ['allowed@example.com'] },
    });

    expect(result.failed).toBe(1);
    expect(db.jobs[0]).toMatchObject({ status: 'failed' });
    expect(api.resend.contacts.create).not.toHaveBeenCalled();
  });

  it('records a failed attempt with an exponential retry delay', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        {
          user_id: 'user-1',
          email: 'person@example.com',
          subscribed: true,
          resend_contact_id: null,
        },
      ],
      jobs: [job({ attempt_count: 4 })],
    });
    const api = createFakeResend();
    (api.resend.contacts.create as any).mockResolvedValue({
      data: null,
      error: { message: 'Temporary Resend failure', statusCode: 503 },
    });
    const startedAt = Date.now();

    const result = await executeNewsletterSync({
      supabase: db.client as any,
      resend: api.resend as any,
      config,
    });

    expect(result).toEqual({ enabled: true, processed: 0, failed: 1 });
    expect(db.jobs[0]).toMatchObject({
      status: 'failed',
      last_error: 'Temporary Resend failure',
      locked_at: null,
    });
    expect(new Date(db.jobs[0].available_at).getTime()).toBeGreaterThanOrEqual(startedAt + 15_000);
  });
});

describe('newsletter endpoints and webhooks', () => {
  it('protects the sync endpoint with its bearer secret', () => {
    expect(() =>
      authorizeNewsletterSync(
        new Request('https://polity.live/api/newsletter/sync', {
          headers: { authorization: 'Bearer wrong' },
        }),
        { config }
      )
    ).toThrow(NewsletterHttpError);

    expect(() =>
      authorizeNewsletterSync(
        new Request('https://polity.live/api/newsletter/sync', {
          headers: { authorization: 'Bearer sync-secret' },
        }),
        { config }
      )
    ).not.toThrow();
  });

  it('rejects webhook requests without signature headers', async () => {
    const response = await handleResendWebhookRequest(
      new Request('https://polity.live/api/resend/webhook', { method: 'POST', body: '{}' })
    );
    expect(response.status).toBe(400);
  });

  it('records an unsubscribe once and treats a replay as a duplicate', async () => {
    const db = createFakeSupabase({
      subscriptions: [
        {
          user_id: 'user-1',
          email: 'person@example.com',
          subscribed: true,
          resend_contact_id: 'contact-1',
        },
      ],
    });
    const api = createFakeResend();
    api.setEvent({
      type: 'contact.updated',
      created_at: '2026-07-20T20:00:00.000Z',
      data: { id: 'contact-1', unsubscribed: true },
    });

    const input = {
      rawBody: '{}',
      svixId: 'event-1',
      svixTimestamp: '123',
      svixSignature: 'signature',
    };
    const first = await handleResendWebhook(input, {
      supabase: db.client as any,
      resend: api.resend as any,
      config,
    });
    const replay = await handleResendWebhook(input, {
      supabase: db.client as any,
      resend: api.resend as any,
      config,
    });

    expect(first).toEqual({ duplicate: false, type: 'contact.updated' });
    expect(replay).toEqual({ duplicate: true });
    expect(db.subscriptions[0]).toMatchObject({ subscribed: false, sync_status: 'unsubscribed' });
    expect(db.events).toHaveLength(1);
  });

  it('rejects an invalid webhook signature before writing data', async () => {
    const db = createFakeSupabase();
    const api = createFakeResend();
    api.rejectSignatures();

    await expect(
      handleResendWebhook(
        {
          rawBody: '{}',
          svixId: 'event-1',
          svixTimestamp: '123',
          svixSignature: 'invalid',
        },
        { supabase: db.client as any, resend: api.resend as any, config }
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(db.events).toHaveLength(0);
  });
});
