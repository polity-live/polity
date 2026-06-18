import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executeStripeCancelSubscription,
  executeStripeCreateCheckout,
  executeStripeCreatePortal,
  executeStripeRepairCheckoutSession,
  executeStripeSubscriptionStatus,
  handleStripeWebhook,
} from '@/server/stripe-service';
import { handleStripeWebhookRequest } from '@/server/stripe-webhook-route';

type TableName = 'stripe_customer' | 'stripe_subscription' | 'stripe_payment';
type Row = Record<string, any>;
type Db = Record<TableName, Row[]>;

class FakeSupabaseQuery {
  private filters: { column: string; value: unknown }[] = [];
  private operation: 'select' | 'insert' | 'update' | null = null;
  private payload: Row | null = null;

  constructor(
    private readonly db: Db,
    private readonly table: TableName
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  insert(payload: Row) {
    this.operation = 'insert';
    this.payload = { ...payload };
    return this;
  }

  update(payload: Row) {
    this.operation = 'update';
    this.payload = { ...payload };
    return this;
  }

  async upsert(payload: Row, options: { onConflict: string }) {
    const existing = this.db[this.table].find(
      row => row[options.onConflict] === payload[options.onConflict]
    );

    if (existing) {
      Object.assign(existing, payload);
    } else {
      this.db[this.table].push({
        id: `${this.table}-${this.db[this.table].length + 1}`,
        ...payload,
      });
    }

    return { error: null };
  }

  async maybeSingle() {
    const data = this.matchingRows()[0] ?? null;
    return { data, error: null };
  }

  then(onfulfilled?: any, onrejected?: any) {
    return Promise.resolve({ data: this.matchingRows(), error: null }).then(
      onfulfilled,
      onrejected
    );
  }

  async single() {
    if (this.operation === 'insert') {
      const row = {
        id: `${this.table}-${this.db[this.table].length + 1}`,
        ...this.payload,
      };
      this.db[this.table].push(row);
      return { data: row, error: null };
    }

    if (this.operation === 'update') {
      const row = this.matchingRows()[0];
      if (!row) {
        return { data: null, error: { message: 'No row found' } };
      }

      Object.assign(row, this.payload);
      return { data: row, error: null };
    }

    const row = this.matchingRows()[0];
    return row ? { data: row, error: null } : { data: null, error: { message: 'No row found' } };
  }

  private matchingRows() {
    return this.db[this.table].filter(row =>
      this.filters.every(filter => row[filter.column] === filter.value)
    );
  }
}

function createFakeSupabase(seed: Partial<Db> = {}) {
  const db: Db = {
    stripe_customer: seed.stripe_customer ? [...seed.stripe_customer] : [],
    stripe_subscription: seed.stripe_subscription ? [...seed.stripe_subscription] : [],
    stripe_payment: seed.stripe_payment ? [...seed.stripe_payment] : [],
  };

  return {
    db,
    client: {
      from: (table: TableName) => new FakeSupabaseQuery(db, table),
    },
  };
}

function createStripeMock(overrides: Record<string, any> = {}) {
  const stripe = {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' })),
        retrieve: vi.fn(async (id: string) => ({
          id,
          status: 'complete',
          metadata: { userId: 'user-1' },
          client_reference_id: 'user-1',
          customer: 'cus_1',
          customer_details: { email: 'user@example.com' },
          subscription: 'sub_1',
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({ url: 'https://billing.stripe.test/session' })),
      },
    },
    customers: {
      retrieve: vi.fn(async (id: string) => ({ id, metadata: { userId: 'user-1' } })),
      search: vi.fn(async () => ({ data: [] })),
      list: vi.fn(async () => ({ data: [] })),
      update: vi.fn(async () => ({})),
    },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        customer: 'cus_1',
        status: 'active',
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        cancel_at_period_end: false,
        canceled_at: null,
        created: 1_700_000_000,
        currency: 'eur',
        items: {
          data: [
            {
              price: {
                unit_amount: 200,
                recurring: { interval: 'month' },
              },
            },
          ],
        },
      })),
      list: vi.fn(async () => ({ data: [] })),
      cancel: vi.fn(async (id: string) => ({ id, status: 'canceled' })),
    },
    invoices: {
      list: vi.fn(async () => ({ data: [] })),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
    ...overrides,
  };

  return stripe as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
  process.env.VITE_APP_URL = 'https://app.example';
  process.env.VITE_STRIPE_PRICE_RUNNING = 'price_running';
  process.env.VITE_STRIPE_PRICE_DEVELOPMENT = 'price_development';
});

describe('Stripe service security', () => {
  it('rejects checkout without an authenticated user', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeCreateCheckout(
        { priceId: 'price_running' },
        { stripe, supabase: client as any, user: null }
      )
    ).rejects.toThrow('Unauthorized');

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects checkout for a forged user id', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeCreateCheckout(
        { priceId: 'price_running', userId: 'user-2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');
  });

  it('rejects arbitrary client supplied price ids', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeCreateCheckout(
        { priceId: 'price_attacker' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Invalid Stripe price');

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('derives checkout return urls from server config and does not pre-cancel subscriptions', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await executeStripeCreateCheckout(
      { priceId: 'price_running', origin: 'https://evil.example' } as any,
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.success_url).toContain('https://app.example/user/user-1/settings');
    expect(params.success_url).toContain('success=true');
    expect(params.success_url).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(params.cancel_url).toContain('https://app.example/user/user-1/settings');
    expect(params.cancel_url).toContain('canceled=true');
    expect(params.success_url).not.toContain('evil.example');
    expect(params.line_items).toEqual([{ price: 'price_running', quantity: 1 }]);
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it('rejects subscription status for a forged user id', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeSubscriptionStatus(
        { userId: 'user-2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');
  });

  it('returns mirrored subscription and payment status before calling Stripe live APIs', async () => {
    const { client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-1',
          stripe_customer_id: 'cus_1',
        },
      ],
      stripe_subscription: [
        {
          id: 'subscription-row-1',
          customer_id: 'customer-row-1',
          stripe_subscription_id: 'sub_mirror',
          stripe_customer_id: 'cus_1',
          status: 'active',
          amount: 1000,
          currency: 'eur',
          interval_period: 'month',
          current_period_start: '2026-01-01T00:00:00.000Z',
          current_period_end: '2026-02-01T00:00:00.000Z',
          cancel_at_period_end: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ],
      stripe_payment: [
        {
          id: 'payment-row-1',
          customer_id: 'customer-row-1',
          stripe_invoice_id: 'in_mirror',
          stripe_customer_id: 'cus_1',
          stripe_subscription_id: 'sub_mirror',
          amount: 1000,
          currency: 'eur',
          status: 'paid',
          created_at: '2026-01-02T00:00:00.000Z',
          paid_at: '2026-01-02T00:00:10.000Z',
        },
      ],
    });
    const stripe = createStripeMock();

    const result = await executeStripeSubscriptionStatus(
      { userId: 'user-1' },
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    expect(result).toMatchObject({
      hasSubscription: true,
      subscription: {
        id: 'sub_mirror',
        amount: 1000,
        status: 'active',
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      },
      allSubscriptions: [{ id: 'sub_mirror' }],
      payments: [{ id: 'in_mirror', status: 'paid' }],
    });
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(stripe.invoices.list).not.toHaveBeenCalled();
  });

  it('rejects billing portal sessions for customers owned by another user', async () => {
    const { client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-2',
          stripe_customer_id: 'cus_2',
        },
      ],
    });
    const stripe = createStripeMock();

    await expect(
      executeStripeCreatePortal(
        { customerId: 'cus_2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');

    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects canceling subscriptions owned by another user', async () => {
    const { client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-2',
          stripe_customer_id: 'cus_2',
        },
      ],
    });
    const stripe = createStripeMock({
      subscriptions: {
        retrieve: vi.fn(async () => ({ customer: 'cus_2' })),
        cancel: vi.fn(),
      },
    });

    await expect(
      executeStripeCancelSubscription(
        { subscriptionId: 'sub_2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');

    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('Stripe checkout repair sync', () => {
  it('repairs an owned completed checkout session into mirrored rows', async () => {
    const { db, client } = createFakeSupabase();
    const stripe = createStripeMock({
      invoices: {
        list: vi.fn(async () => ({
          data: [
            {
              id: 'in_repair',
              customer: 'cus_1',
              parent: { subscription_details: { subscription: 'sub_1' } },
              amount_paid: 200,
              amount_due: 200,
              currency: 'eur',
              created: 1_700_000_100,
              status: 'paid',
              status_transitions: { paid_at: 1_700_000_110 },
            },
          ],
        })),
      },
    });

    const result = await executeStripeRepairCheckoutSession(
      { sessionId: 'cs_1', userId: 'user-1' },
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_1', {
      expand: ['subscription', 'customer'],
    });
    expect(db.stripe_customer).toHaveLength(1);
    expect(db.stripe_customer[0]).toMatchObject({
      user_id: 'user-1',
      stripe_customer_id: 'cus_1',
      email: 'user@example.com',
    });
    expect(db.stripe_subscription).toHaveLength(1);
    expect(db.stripe_subscription[0]).toMatchObject({
      stripe_subscription_id: 'sub_1',
      stripe_customer_id: 'cus_1',
      status: 'active',
      interval_period: 'month',
    });
    expect(db.stripe_payment).toHaveLength(1);
    expect(db.stripe_payment[0]).toMatchObject({
      stripe_invoice_id: 'in_repair',
      stripe_subscription_id: 'sub_1',
      amount: 200,
      status: 'paid',
    });
    expect(result).toMatchObject({
      hasSubscription: true,
      subscription: { id: 'sub_1', status: 'active' },
      payments: [{ id: 'in_repair', status: 'paid' }],
    });
  });

  it('rejects a completed checkout session owned by another user', async () => {
    const { db, client } = createFakeSupabase();
    const stripe = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(async (id: string) => ({
            id,
            status: 'complete',
            metadata: { userId: 'user-2' },
            client_reference_id: 'user-2',
            customer: 'cus_2',
            customer_details: { email: 'other@example.com' },
            subscription: null,
          })),
        },
      },
    });

    await expect(
      executeStripeRepairCheckoutSession(
        { sessionId: 'cs_forged', userId: 'user-1' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');

    expect(db.stripe_customer).toHaveLength(0);
    expect(db.stripe_subscription).toHaveLength(0);
    expect(db.stripe_payment).toHaveLength(0);
  });
});

describe('Stripe webhook handling', () => {
  it('rejects webhook requests with missing signatures', async () => {
    const response = await handleStripeWebhookRequest(
      new Request('https://app.example/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Missing Stripe signature');
  });

  it('rejects invalid webhook signatures as a 400 error', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found');
    });

    await expect(
      handleStripeWebhook({ rawBody: '{}', signature: 'bad' }, { stripe, supabase: client as any })
    ).rejects.toMatchObject({
      status: 400,
      message: 'No signatures found',
    });
  });

  it('upserts customer.subscription.created events into mirrored subscriptions', async () => {
    const { db, client } = createFakeSupabase();
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_subscription_created',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_created',
          customer: 'cus_1',
          status: 'active',
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          cancel_at_period_end: false,
          canceled_at: null,
          created: 1_700_000_000,
          currency: 'eur',
          items: {
            data: [
              {
                price: {
                  unit_amount: 1000,
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );

    expect(db.stripe_customer).toHaveLength(1);
    expect(db.stripe_customer[0]).toMatchObject({
      user_id: 'user-1',
      stripe_customer_id: 'cus_1',
    });
    expect(db.stripe_subscription).toHaveLength(1);
    expect(db.stripe_subscription[0]).toMatchObject({
      stripe_subscription_id: 'sub_created',
      stripe_customer_id: 'cus_1',
      amount: 1000,
      interval_period: 'month',
      status: 'active',
    });
  });

  it('upserts completed checkout subscriptions with interval_period and tolerates duplicate events', async () => {
    const { db, client } = createFakeSupabase();
    const event = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1' },
          customer: 'cus_1',
          customer_details: { email: 'user@example.com' },
          subscription: 'sub_1',
        },
      },
    };
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue(event);

    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );
    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );

    expect(db.stripe_customer).toHaveLength(1);
    expect(db.stripe_subscription).toHaveLength(1);
    expect(db.stripe_subscription[0]).toMatchObject({
      stripe_subscription_id: 'sub_1',
      stripe_customer_id: 'cus_1',
      interval_period: 'month',
      amount: 200,
      currency: 'eur',
      status: 'active',
    });
    expect(db.stripe_subscription[0]).not.toHaveProperty('interval');
  });

  it('upserts paid and failed invoices by invoice id', async () => {
    const { db, client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-1',
          stripe_customer_id: 'cus_1',
        },
      ],
    });
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent
      .mockReturnValueOnce({
        id: 'evt_paid',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1',
            customer: 'cus_1',
            parent: { subscription_details: { subscription: 'sub_1' } },
            amount_paid: 200,
            amount_due: 200,
            currency: 'eur',
            created: 1_700_000_000,
            status_transitions: { paid_at: 1_700_000_010 },
          },
        },
      })
      .mockReturnValueOnce({
        id: 'evt_paid_duplicate',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_1',
            customer: 'cus_1',
            parent: { subscription_details: { subscription: 'sub_1' } },
            amount_paid: 200,
            amount_due: 200,
            currency: 'eur',
            created: 1_700_000_000,
            status_transitions: { paid_at: 1_700_000_010 },
          },
        },
      })
      .mockReturnValueOnce({
        id: 'evt_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_2',
            customer: 'cus_1',
            parent: { subscription_details: { subscription: 'sub_1' } },
            amount_paid: 0,
            amount_due: 200,
            currency: 'eur',
            created: 1_700_000_100,
            status_transitions: {},
          },
        },
      });

    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );
    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );
    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );

    expect(db.stripe_payment).toHaveLength(2);
    expect(db.stripe_payment.find(row => row.stripe_invoice_id === 'in_1')).toMatchObject({
      amount: 200,
      status: 'paid',
      paid_at: '2023-11-14T22:13:30.000Z',
    });
    expect(db.stripe_payment.find(row => row.stripe_invoice_id === 'in_2')).toMatchObject({
      amount: 200,
      status: 'failed',
      paid_at: null,
    });
  });
});
