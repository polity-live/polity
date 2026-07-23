import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executeStripeCancelSubscription,
  executeStripeCreateCheckout,
  executeStripeCreatePortal,
  executeStripeReconcileCustomer,
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
      configurations: {
        retrieve: vi.fn(async (id: string) => ({
          id,
          active: true,
          livemode: false,
        })),
      },
    },
    prices: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        active: true,
        livemode: false,
        currency: 'eur',
        recurring: { interval: 'month' },
      })),
    },
    products: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        active: true,
        livemode: false,
      })),
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
      update: vi.fn(async (id: string) => ({
        id,
        customer: 'cus_1',
        status: 'active',
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        cancel_at_period_end: true,
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
  vi.unstubAllEnvs();
  vi.stubEnv('STRIPE_MODE', 'test');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_mock');
  vi.stubEnv('STRIPE_PRICE_RUNNING', 'price_running');
  vi.stubEnv('STRIPE_PRICE_DEVELOPMENT', 'price_development');
  vi.stubEnv('STRIPE_PRODUCT_CUSTOM', 'prod_custom');
  vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', 'bpc_test');
  vi.stubEnv('VITE_APP_URL', 'https://app.example');
});

describe('Stripe service security', () => {
  it('rejects checkout without an authenticated user', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeCreateCheckout(
        { plan: 'running' },
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
        { plan: 'running', userId: 'user-2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');
  });

  it('rejects amounts on a fixed server-side plan', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await expect(
      executeStripeCreateCheckout(
        { plan: 'running', amount: 500 },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Fixed Stripe plans do not accept a custom amount');

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('derives checkout return urls from server config and does not pre-cancel subscriptions', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await executeStripeCreateCheckout({ plan: 'running', origin: 'https://evil.example' } as any, {
      stripe,
      supabase: client as any,
      user: { id: 'user-1', email: 'u@example.com' },
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.success_url).toContain('https://app.example/user/user-1/settings');
    expect(params.success_url).toContain('success=true');
    expect(params.success_url).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(params.cancel_url).toContain('https://app.example/user/user-1/settings');
    expect(params.cancel_url).toContain('canceled=true');
    expect(params.success_url).not.toContain('evil.example');
    expect(params.line_items).toEqual([{ price: 'price_running', quantity: 1 }]);
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('rejects a test checkout configured with a live Stripe price', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock({
      prices: {
        retrieve: vi.fn(async () => ({
          active: true,
          livemode: true,
          currency: 'eur',
          recurring: { interval: 'month' },
        })),
      },
    });

    await expect(
      executeStripeCreateCheckout(
        { plan: 'running' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('does not belong to the configured Stripe mode');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('creates custom subscriptions from the server-side product configuration', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();

    await executeStripeCreateCheckout(
      { plan: 'custom', amount: 500 },
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    expect(stripe.products.retrieve).toHaveBeenCalledWith('prod_custom');
    expect(stripe.checkout.sessions.create.mock.calls[0][0].line_items).toEqual([
      {
        price_data: {
          currency: 'eur',
          product: 'prod_custom',
          recurring: { interval: 'month' },
          unit_amount: 500,
        },
        quantity: 1,
      },
    ]);
  });

  it('rejects a secret key whose prefix does not match STRIPE_MODE', async () => {
    const { client } = createFakeSupabase();
    vi.stubEnv('STRIPE_MODE', 'live');

    await expect(
      executeStripeCreateCheckout(
        { plan: 'running' },
        { supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('STRIPE_SECRET_KEY must use the sk_live_ prefix');
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

  it('creates a portal session only for the authenticated user customer', async () => {
    const { client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-1',
          stripe_customer_id: 'cus_1',
        },
      ],
    });
    const stripe = createStripeMock();

    await executeStripeCreatePortal({ customerId: 'cus_attacker' } as any, {
      stripe,
      supabase: client as any,
      user: { id: 'user-1', email: 'u@example.com' },
    });

    expect(stripe.billingPortal.configurations.retrieve).toHaveBeenCalledWith('bpc_test');
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_1',
      configuration: 'bpc_test',
      return_url: 'https://app.example/user/user-1/settings?tab=subscriptions&billing_return=true',
    });
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
        update: vi.fn(),
      },
    });

    await expect(
      executeStripeCancelSubscription(
        { subscriptionId: 'sub_2' },
        { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
      )
    ).rejects.toThrow('Forbidden');

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('schedules owned subscriptions to cancel at the end of the billing period', async () => {
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

    const result = await executeStripeCancelSubscription(
      { subscriptionId: 'sub_1' },
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: true,
    });
    expect(db.stripe_subscription[0]).toMatchObject({
      stripe_subscription_id: 'sub_1',
      cancel_at_period_end: true,
      status: 'active',
    });
    expect(result.subscription.cancelAtPeriodEnd).toBe(true);
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

describe('Stripe customer reconciliation', () => {
  it('refreshes subscriptions and invoices directly from Stripe', async () => {
    const { db, client } = createFakeSupabase({
      stripe_customer: [
        {
          id: 'customer-row-1',
          user_id: 'user-1',
          stripe_customer_id: 'cus_1',
        },
      ],
    });
    const stripe = createStripeMock({
      subscriptions: {
        retrieve: vi.fn(),
        list: vi.fn(async () => ({
          data: [
            {
              id: 'sub_reconciled',
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
          ],
        })),
      },
      invoices: {
        list: vi.fn(async () => ({
          data: [
            {
              id: 'in_reconciled',
              customer: 'cus_1',
              parent: { subscription_details: { subscription: 'sub_reconciled' } },
              amount_paid: 1000,
              amount_due: 1000,
              currency: 'eur',
              created: 1_700_000_100,
              status: 'paid',
              status_transitions: { paid_at: 1_700_000_110 },
            },
          ],
        })),
      },
    });

    const result = await executeStripeReconcileCustomer(
      { userId: 'user-1' },
      { stripe, supabase: client as any, user: { id: 'user-1', email: 'u@example.com' } }
    );

    expect(db.stripe_subscription).toHaveLength(1);
    expect(db.stripe_payment).toHaveLength(1);
    expect(result).toMatchObject({
      hasCustomer: true,
      subscription: { id: 'sub_reconciled', amount: 1000 },
      payments: [{ id: 'in_reconciled', status: 'paid' }],
    });
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

  it('rejects webhook events from the wrong Stripe mode', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_live',
      type: 'checkout.session.completed',
      livemode: true,
      data: { object: {} },
    });

    await expect(
      handleStripeWebhook({ rawBody: '{}', signature: 'sig' }, { stripe, supabase: client as any })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('upserts customer.subscription.created events into mirrored subscriptions', async () => {
    const { db, client } = createFakeSupabase();
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_subscription_created',
      type: 'customer.subscription.created',
      livemode: false,
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

  it.each([
    ['customer.subscription.updated', 'active'],
    ['customer.subscription.deleted', 'canceled'],
  ] as const)('upserts %s events', async (eventType, status) => {
    const { db, client } = createFakeSupabase();
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: `evt_${eventType}`,
      type: eventType,
      livemode: false,
      data: {
        object: {
          id: 'sub_changed',
          customer: 'cus_1',
          status,
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          cancel_at_period_end: status === 'canceled',
          canceled_at: status === 'canceled' ? 1_700_000_100 : null,
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
        },
      },
    });

    await handleStripeWebhook(
      { rawBody: '{}', signature: 'sig' },
      { stripe, supabase: client as any }
    );

    expect(db.stripe_subscription).toHaveLength(1);
    expect(db.stripe_subscription[0]).toMatchObject({
      stripe_subscription_id: 'sub_changed',
      status,
    });
  });

  it('upserts completed checkout subscriptions with interval_period and tolerates duplicate events', async () => {
    const { db, client } = createFakeSupabase();
    const event = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      livemode: false,
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
        livemode: false,
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
        livemode: false,
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
        livemode: false,
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

  it('returns HTTP 500 when a valid event cannot be synchronized', async () => {
    const { db } = createFakeSupabase();
    const failingClient = {
      from: (table: TableName) => {
        const query = new FakeSupabaseQuery(db, table) as any;
        if (table === 'stripe_subscription') {
          query.upsert = vi.fn(async () => ({ error: { message: 'database unavailable' } }));
        }
        return query;
      },
    };
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_db_failure',
      type: 'customer.subscription.updated',
      livemode: false,
      data: {
        object: {
          id: 'sub_failure',
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
        },
      },
    });

    const response = await handleStripeWebhookRequest(
      new Request('https://app.example/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
      }),
      { stripe, supabase: failingClient as any }
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain('database unavailable');
  });
});
