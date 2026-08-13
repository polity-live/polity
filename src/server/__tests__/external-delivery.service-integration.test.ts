import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleResendWebhookRequest } from '@/server/newsletter-routes';
import { executePushDelivery, authorizePushDelivery } from '@/server/push-delivery-service';
import { handleStripeWebhookRequest } from '@/server/stripe-webhook-route';

type Row = Record<string, any>;

class StripeQuery {
  private readonly filters: [string, unknown][] = [];
  private operation: 'insert' | 'update' | null = null;
  private payload: Row = {};

  constructor(
    private readonly rows: Row[],
    private readonly idPrefix: string
  ) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  insert(payload: Row) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }
  private matches() {
    return this.rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
  }
  async maybeSingle() {
    return { data: this.matches()[0] ?? null, error: null };
  }
  async single() {
    if (this.operation === 'insert') {
      const row = { id: `${this.idPrefix}-${this.rows.length + 1}`, ...this.payload };
      this.rows.push(row);
      return { data: row, error: null };
    }
    if (this.operation === 'update') Object.assign(this.matches()[0] ?? {}, this.payload);
    return { data: this.matches()[0] ?? null, error: null };
  }
  async upsert(payload: Row, options: { onConflict: string }) {
    const row = this.rows.find(item => item[options.onConflict] === payload[options.onConflict]);
    if (row) Object.assign(row, payload);
    else this.rows.push({ id: `${this.idPrefix}-${this.rows.length + 1}`, ...payload });
    return { error: null };
  }
  then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
    return Promise.resolve({ data: this.matches(), error: null }).then(resolve, reject);
  }
}

function stripeFixture() {
  const tables: Record<string, Row[]> = {
    stripe_customer: [],
    stripe_subscription: [],
    stripe_payment: [],
  };
  const stripe = {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: 'sub-local',
        customer: 'cus-local',
        status: 'active',
        created: 1_700_000_000,
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        cancel_at_period_end: false,
        canceled_at: null,
        currency: 'eur',
        items: { data: [{ price: { unit_amount: 200, recurring: { interval: 'month' } } }] },
      })),
    },
  } as any;
  stripe.webhooks.constructEvent.mockReturnValue({
    id: 'evt-local',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        metadata: { userId: 'user-local' },
        customer: 'cus-local',
        customer_details: { email: 'local@example.test' },
        subscription: 'sub-local',
      },
    },
  });
  return {
    stripe,
    tables,
    supabase: {
      from(name: string) {
        return new StripeQuery(tables[name], name);
      },
    } as any,
  };
}

class NewsletterQuery {
  private readonly filters: [string, unknown][] = [];
  private operation: 'select' | 'update' = 'select';
  private payload: Row = {};
  constructor(
    private readonly rows: Row[],
    private readonly insertHandler?: (payload: Row) => { error: unknown }
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
  eq(key: string, value: unknown) {
    this.filters.push([key, value]);
    return this;
  }
  insert(payload: Row) {
    return Promise.resolve(this.insertHandler?.(payload) ?? { error: null });
  }
  private matches() {
    return this.rows.filter(row => this.filters.every(([key, value]) => row[key] === value));
  }
  async maybeSingle() {
    return { data: this.matches()[0] ?? null, error: null };
  }
  then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
    if (this.operation === 'update')
      this.matches().forEach(row => Object.assign(row, this.payload));
    return Promise.resolve({ data: this.matches(), error: null }).then(resolve, reject);
  }
}

function newsletterFixture() {
  const subscriptions: Row[] = [
    {
      user_id: 'user-local',
      email: 'person@example.test',
      subscribed: true,
      resend_contact_id: 'contact-local',
    },
  ];
  const events: Row[] = [];
  let signatureValid = true;
  const resend = {
    webhooks: {
      verify: vi.fn(() => {
        if (!signatureValid) throw new Error('invalid signature');
        return {
          type: 'contact.updated',
          created_at: '2026-08-11T10:00:00.000Z',
          data: { id: 'contact-local', unsubscribed: true },
        };
      }),
    },
  } as any;
  const supabase = {
    from(name: string) {
      if (name === 'newsletter_subscription') return new NewsletterQuery(subscriptions);
      if (name === 'resend_webhook_event') {
        return new NewsletterQuery(events, payload => {
          if (events.some(event => event.svix_id === payload.svix_id)) {
            return { error: { code: '23505', message: 'duplicate' } };
          }
          events.push({ ...payload });
          return { error: null };
        });
      }
      throw new Error(`Unexpected newsletter table: ${name}`);
    },
  } as any;
  return {
    resend,
    supabase,
    subscriptions,
    events,
    rejectSignature: () => {
      signatureValid = false;
    },
  };
}

function pushFixture() {
  const jobs: Row[] = [
    {
      id: 1,
      notification_id: 'notification-local',
      user_id: 'user-local',
      push_subscription_id: 'subscription-local',
      kind: 'notification',
      status: 'processing',
      attempt_count: 1,
      payload: { title: 'Delivery', message: 'Delivered locally', type: 'system_notification' },
    },
  ];
  const tables: Record<string, Row[]> = {
    push_subscription: [
      {
        id: 'subscription-local',
        user_id: 'user-local',
        endpoint: 'https://push.test/local',
        auth: 'auth-local',
        p256dh: 'p256dh-local',
      },
    ],
    notification_setting: [],
    user_preference: [{ user_id: 'user-local', language: 'en' }],
    push_delivery_outbox: jobs,
  };
  class Query {
    private filters: [string, unknown][] = [];
    private operation: 'select' | 'update' = 'select';
    private values: Row = {};
    constructor(private readonly table: string) {}
    select() {
      this.operation = 'select';
      return this;
    }
    update(values: Row) {
      this.operation = 'update';
      this.values = values;
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push([key, value]);
      return this;
    }
    private matches() {
      return tables[this.table].filter(row =>
        this.filters.every(([key, value]) => row[key] === value)
      );
    }
    async maybeSingle() {
      return { data: structuredClone(this.matches()[0] ?? null), error: null };
    }
    then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
      if (this.operation === 'update')
        this.matches().forEach(row => Object.assign(row, this.values));
      return Promise.resolve({ data: structuredClone(this.matches()), error: null }).then(
        resolve,
        reject
      );
    }
  }
  return {
    tables,
    client: {
      from(name: string) {
        return new Query(name);
      },
      async rpc(name: string) {
        if (name === 'claim_push_notification_jobs') return { data: [], error: null };
        if (name === 'claim_push_delivery_jobs')
          return { data: structuredClone(jobs), error: null };
        throw new Error(`Unexpected push RPC: ${name}`);
      },
    } as any,
  };
}

const newsletterConfig = {
  apiKey: 're_local',
  webhookSecret: 'whsec_local',
  segmentIdDe: 'de',
  segmentIdEn: 'en',
  topicId: 'topic',
  syncSecret: 'sync-local',
  environment: 'production' as const,
  syncEnabled: true,
  allowedRecipients: [],
};

describe('external delivery service integration', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_MODE', 'test');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_local');
    vi.stubEnv('PUSH_DELIVERY_SECRET', 'push-local');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('validates a Stripe signature and mirrors a replayed checkout idempotently', async () => {
    const fixture = stripeFixture();
    const request = () =>
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig-local' },
        body: '{"id":"evt-local"}',
      });
    const first = await handleStripeWebhookRequest(request(), fixture);
    const replay = await handleStripeWebhookRequest(request(), fixture);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(fixture.stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      '{"id":"evt-local"}',
      'sig-local',
      'whsec_local'
    );
    expect(fixture.tables.stripe_customer).toHaveLength(1);
    expect(fixture.tables.stripe_subscription).toHaveLength(1);
  });

  it('verifies Resend headers, maps the contact event, and rejects an invalid signature', async () => {
    const fixture = newsletterFixture();
    const request = () =>
      new Request('http://localhost/api/resend/webhook', {
        method: 'POST',
        headers: {
          'svix-id': 'event-local',
          'svix-timestamp': '123',
          'svix-signature': 'sig-local',
        },
        body: '{}',
      });
    const response = await handleResendWebhookRequest(request(), {
      config: newsletterConfig,
      resend: fixture.resend,
      supabase: fixture.supabase,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: false, type: 'contact.updated' });
    expect(fixture.subscriptions[0]).toMatchObject({
      subscribed: false,
      sync_status: 'unsubscribed',
    });
    expect(fixture.events).toHaveLength(1);

    fixture.rejectSignature();
    const invalid = await handleResendWebhookRequest(
      new Request('http://localhost/api/resend/webhook', {
        method: 'POST',
        headers: { 'svix-id': 'event-invalid', 'svix-timestamp': '123', 'svix-signature': 'bad' },
        body: '{}',
      }),
      { config: newsletterConfig, resend: fixture.resend, supabase: fixture.supabase }
    );
    expect(invalid.status).toBe(400);
  });

  it('authorizes and completes push delivery with an injected local sender', async () => {
    authorizePushDelivery(
      new Request('http://localhost/api/push/process', {
        headers: { authorization: 'Bearer push-local' },
      })
    );
    const fixture = pushFixture();
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const result = await executePushDelivery(
      { notificationId: 'notification-local' },
      {
        supabase: fixture.client,
        config: { enabled: true, publicKey: 'public-local', privateKey: 'private-local' },
        initializeVapid: vi.fn(),
        sendNotification,
      }
    );
    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(fixture.tables.push_delivery_outbox[0]).toMatchObject({ status: 'sent' });
  });
});
