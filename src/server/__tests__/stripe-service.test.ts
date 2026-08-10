import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executeStripeCancelSubscription,
  executeStripeCreateCheckout,
  executeStripeCreatePortal,
  executeStripeReconcileCustomer,
  executeStripeRepairCheckoutSession,
  executeStripeSubscriptionStatus,
  handleStripeWebhook,
  stripeServiceContracts,
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

function createScriptedSupabase(results: { data?: any; error?: any }[]) {
  const queue = [...results];
  const from = vi.fn(() => {
    const query: any = {};
    for (const method of ['select', 'eq', 'insert', 'update']) {
      query[method] = vi.fn(() => query);
    }
    const next = () => Promise.resolve(queue.shift() ?? { data: null, error: null });
    query.maybeSingle = vi.fn(next);
    query.single = vi.fn(next);
    query.upsert = vi.fn(next);
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      next().then(resolve, reject);
    return query;
  });
  return { client: { from } as any, from, queue };
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

describe('Stripe service boundary contracts', () => {
  const c = stripeServiceContracts;

  it('validates environment mode, secret prefixes, app origins, plans, and custom amounts', () => {
    vi.stubEnv('STRIPE_MODE', 'preview');
    expect(() => c.getStripeMode()).toThrow('test or live');
    vi.stubEnv('STRIPE_MODE', 'test');
    expect(c.getStripeMode()).toBe('test');
    expect(() => c.assertSecretKeyMatchesMode('sk_live_wrong')).toThrow('sk_test_');
    c.assertSecretKeyMatchesMode('sk_test_ok');
    vi.stubEnv('STRIPE_MODE', 'live');
    c.assertSecretKeyMatchesMode('sk_live_ok');

    vi.stubEnv('VITE_APP_URL', 'ftp://app.example');
    expect(() => c.getAppOrigin()).toThrow('HTTP(S)');
    vi.stubEnv('VITE_APP_URL', 'http://app.example/path');
    expect(c.getAppOrigin()).toBe('http://app.example');

    vi.stubEnv('STRIPE_MODE', 'test');
    expect(c.getCheckoutLineItems({ plan: 'development' })).toEqual([
      { price: 'price_development', quantity: 1 },
    ]);
    for (const amount of [undefined, 1.5, 99, 99_901]) {
      expect(() => c.getCheckoutLineItems({ plan: 'custom', amount })).toThrow('between EUR 1');
    }
    expect(c.getCheckoutLineItems({ plan: 'custom', amount: 100 })[0]).toMatchObject({
      price_data: { unit_amount: 100 },
    });
    expect(c.getCheckoutLineItems({ plan: 'custom', amount: 99_900 })[0]).toMatchObject({
      price_data: { unit_amount: 99_900 },
    });
  });

  it('accepts a structurally valid injected authenticated user', async () => {
    await expect(
      c.requireAuthenticatedUser(undefined, { user: { id: 'user-1', email: null } })
    ).resolves.toEqual({ id: 'user-1', email: null });
    await expect(
      c.requireAuthenticatedUser(undefined, { user: { id: '', email: null } })
    ).rejects.toThrow('Unauthorized');
    await expect(
      c.requireAuthenticatedUser(undefined, { user: { id: 42, email: null } } as any)
    ).rejects.toThrow('Unauthorized');
  });

  it('normalizes customer, timestamp, interval, and amount representations', () => {
    expect(c.getCustomerIdFromSubscription({ customer: 'cus_string' } as any)).toBe('cus_string');
    expect(c.getCustomerIdFromSubscription({ customer: { id: 'cus_object' } } as any)).toBe(
      'cus_object'
    );
    expect(c.timestampToIso(null)).toBeNull();
    expect(c.timestampToIso(1)).toBe('1970-01-01T00:00:01.000Z');
    expect(c.mirrorTimestampToIso('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
    expect(c.mirrorTimestampToIso(1)).toBe('1970-01-01T00:00:01.000Z');
    expect(c.mirrorTimestampToIso(10_000_000_001)).toBe('1970-04-26T17:46:40.001Z');
    expect(c.mirrorTimestampToIso({})).toBeNull();
    vi.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(c.timestampToIsoOrNow(null)).toBe('2026-01-01T00:00:00.000Z');
    expect(c.mirrorTimestampToIsoOrNow(null)).toBe('2026-01-01T00:00:00.000Z');
    vi.useRealTimers();
    expect(c.subscriptionInterval({ items: { data: [] } } as any)).toBe('month');
    expect(c.subscriptionAmount({ items: { data: [] } } as any)).toBe(0);
    expect(
      c.subscriptionInterval({
        items: { data: [{ price: { recurring: { interval: 'year' } } }] },
      } as any)
    ).toBe('year');
    expect(
      c.subscriptionAmount({ items: { data: [{ price: { unit_amount: 500 } }] } } as any)
    ).toBe(500);
  });

  it('validates fixed prices, custom products, portal configuration, and caches successes', async () => {
    for (const price of [
      { active: false, currency: 'eur', recurring: { interval: 'month' }, livemode: false },
      { active: true, currency: 'usd', recurring: { interval: 'month' }, livemode: false },
      { active: true, currency: 'eur', recurring: { interval: 'year' }, livemode: false },
    ]) {
      const stripe = createStripeMock({ prices: { retrieve: vi.fn().mockResolvedValue(price) } });
      await expect(c.validateCheckoutConfiguration(stripe, 'running')).rejects.toThrow(
        'active, monthly'
      );
    }

    const deleted = createStripeMock({
      products: { retrieve: vi.fn().mockResolvedValue({ deleted: true, livemode: false }) },
    });
    await expect(c.validateCheckoutConfiguration(deleted, 'custom')).rejects.toThrow('deleted');
    const inactive = createStripeMock({
      products: {
        retrieve: vi.fn().mockResolvedValue({ active: false, livemode: false }),
      },
    });
    await expect(c.validateCheckoutConfiguration(inactive, 'custom')).rejects.toThrow('active');

    const valid = createStripeMock();
    await c.validateCheckoutConfiguration(valid, 'running');
    await c.validateCheckoutConfiguration(valid, 'running');
    expect(valid.prices.retrieve).toHaveBeenCalledOnce();

    const inactivePortal = createStripeMock({
      billingPortal: {
        sessions: { create: vi.fn() },
        configurations: {
          retrieve: vi.fn().mockResolvedValue({ active: false, livemode: false }),
        },
      },
    });
    await expect(c.validatePortalConfiguration(inactivePortal)).rejects.toThrow('active');
    const portal = createStripeMock();
    await expect(c.validatePortalConfiguration(portal)).resolves.toBe('bpc_test');
    await expect(c.validatePortalConfiguration(portal)).resolves.toBe('bpc_test');
    expect(portal.billingPortal.configurations.retrieve).toHaveBeenCalledOnce();
  });

  it('loads local customers and searches Stripe across deleted, search, and list fallbacks', async () => {
    await expect(
      c.findLocalCustomerId(createScriptedSupabase([{ error: { message: 'db' } }]).client, 'user-1')
    ).rejects.toThrow('Failed to load Stripe customer');
    await expect(
      c.findLocalCustomerId(
        createScriptedSupabase([{ data: { stripe_customer_id: 42 } }]).client,
        'user-1'
      )
    ).resolves.toBeNull();

    const localStripe = createStripeMock();
    await expect(
      c.findStripeCustomerForUser(
        localStripe,
        createScriptedSupabase([{ data: { stripe_customer_id: 'cus_local' } }]).client,
        'user-1'
      )
    ).resolves.toMatchObject({ id: 'cus_local' });

    const searched = createStripeMock({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ id: 'deleted', deleted: true }),
        search: vi.fn().mockResolvedValue({ data: [{ id: 'cus_search' }] }),
        list: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      c.findStripeCustomerForUser(
        searched,
        createScriptedSupabase([{ data: { stripe_customer_id: 'deleted' } }]).client,
        'user-1'
      )
    ).resolves.toMatchObject({ id: 'cus_search' });

    const listed = createStripeMock({
      customers: {
        retrieve: vi.fn(),
        search: vi.fn().mockRejectedValue(new Error('unsupported')),
        list: vi.fn().mockResolvedValue({
          data: [
            { id: 'other', metadata: {} },
            { id: 'cus_list', metadata: { userId: 'user-1' } },
          ],
        }),
        update: vi.fn(),
      },
    });
    await expect(
      c.findStripeCustomerForUser(listed, createScriptedSupabase([{ data: null }]).client, 'user-1')
    ).resolves.toMatchObject({ id: 'cus_list' });
    const none = createStripeMock();
    await expect(
      c.findStripeCustomerForUser(none, createScriptedSupabase([{ data: null }]).client, 'user-1')
    ).resolves.toBeUndefined();
  });

  it('covers every local customer upsert branch and persistence error', async () => {
    const input = { userId: 'user-1', stripeCustomerId: 'cus_1', email: null };
    await expect(
      c.upsertStripeCustomer(createScriptedSupabase([{ error: { message: 'load' } }]).client, input)
    ).rejects.toThrow('Failed to load Stripe customer');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([{ data: { id: 'row', user_id: 'other' } }]).client,
        input
      )
    ).rejects.toThrow('different user');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([
          { data: { id: 'row', user_id: 'user-1' } },
          { error: { message: 'update' } },
        ]).client,
        input
      )
    ).rejects.toThrow('Failed to update Stripe customer');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([
          { data: { id: 'row', user_id: 'user-1' } },
          { data: { id: 'row' } },
        ]).client,
        input
      )
    ).resolves.toBe('row');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([{ data: null }, { error: { message: 'user-load' } }]).client,
        input
      )
    ).rejects.toThrow('Failed to load user Stripe customer');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([
          { data: null },
          { data: { id: 'user-row' } },
          { error: { message: 'user-update' } },
        ]).client,
        input
      )
    ).rejects.toThrow('Failed to update user Stripe customer');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([
          { data: null },
          { data: { id: 'user-row' } },
          { data: { id: 'user-row' } },
        ]).client,
        input
      )
    ).resolves.toBe('user-row');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([{ data: null }, { data: null }, { error: { message: 'insert' } }])
          .client,
        input
      )
    ).rejects.toThrow('Failed to insert Stripe customer');
    await expect(
      c.upsertStripeCustomer(
        createScriptedSupabase([{ data: null }, { data: null }, { data: { id: 'inserted' } }])
          .client,
        input
      )
    ).resolves.toBe('inserted');
  });

  it('covers subscription and invoice mirror persistence fallbacks', async () => {
    const minimalSubscription = {
      id: 'sub_minimal',
      status: 'past_due',
      cancel_at_period_end: false,
      currency: 'eur',
      items: { data: [] },
    } as any;
    await expect(
      c.upsertStripeSubscription(
        createScriptedSupabase([{ error: { message: 'subscription' } }]).client,
        'row',
        'cus_1',
        minimalSubscription
      )
    ).rejects.toThrow('Failed to upsert Stripe subscription');
    await expect(
      c.upsertStripeSubscription(
        createScriptedSupabase([{ error: null }]).client,
        'row',
        'cus_1',
        minimalSubscription
      )
    ).resolves.toBeUndefined();

    const stripe = createStripeMock();
    await expect(
      c.upsertStripePayment(
        stripe,
        createScriptedSupabase([]).client,
        { customer: null } as any,
        'paid'
      )
    ).rejects.toThrow('missing a Stripe customer');
    await expect(
      c.upsertStripePayment(
        stripe,
        createScriptedSupabase([{ data: { id: 'row' } }, { error: { message: 'payment' } }]).client,
        {
          id: 'in_error',
          customer: { id: 'cus_1' },
          parent: { subscription_details: { subscription: { id: 'sub_1' } } },
          amount_paid: 0,
          amount_due: 100,
          currency: 'eur',
          status_transitions: {},
        } as any,
        'failed'
      )
    ).rejects.toThrow('Failed to upsert Stripe payment');
    await expect(
      c.upsertStripePayment(
        stripe,
        createScriptedSupabase([{ data: { id: 'row' } }, { error: null }]).client,
        {
          id: 'in_paid',
          customer: 'cus_1',
          parent: { subscription_details: { subscription: 'sub_1' } },
          amount_paid: 100,
          amount_due: 100,
          currency: 'eur',
          status_transitions: {},
        } as any,
        'paid'
      )
    ).resolves.toBeUndefined();
  });

  it('loads malformed and defaulted mirrored subscription status rows', async () => {
    await expect(
      c.loadMirroredSubscriptionStatus(
        createScriptedSupabase([{ error: { message: 'customer' } }]).client,
        'user-1'
      )
    ).rejects.toThrow('mirrored Stripe customer');
    await expect(
      c.loadMirroredSubscriptionStatus(createScriptedSupabase([{ data: null }]).client, 'user-1')
    ).resolves.toBeNull();
    await expect(
      c.loadMirroredSubscriptionStatus(
        createScriptedSupabase([
          { data: { id: 'row' } },
          { error: { message: 'subscriptions' } },
          { data: [] },
        ]).client,
        'user-1'
      )
    ).rejects.toThrow('mirrored Stripe subscriptions');
    await expect(
      c.loadMirroredSubscriptionStatus(
        createScriptedSupabase([
          { data: { id: 'row' } },
          { data: [] },
          { error: { message: 'payments' } },
        ]).client,
        'user-1'
      )
    ).rejects.toThrow('mirrored Stripe payments');
    await expect(
      c.loadMirroredSubscriptionStatus(
        createScriptedSupabase([{ data: { id: 'row' } }, { data: null }, { data: null }]).client,
        'user-1'
      )
    ).resolves.toBeNull();

    const result = await c.loadMirroredSubscriptionStatus(
      createScriptedSupabase([
        { data: { id: 'row' } },
        {
          data: [
            { id: 'older', status: 'canceled', created_at: '2025-01-01', canceled_at: 1 },
            { id: 'active', status: 'trialing', updated_at: '2026-01-01' },
          ],
        },
        { data: [{ id: 'pay-old' }, { id: 'pay-new', created_at: '2026-01-01' }] },
      ]).client,
      'user-1'
    );
    expect(result).toMatchObject({
      hasSubscription: true,
      subscription: {
        id: 'active',
        status: 'trialing',
        amount: 0,
        currency: 'eur',
        interval: 'month',
        cancelAtPeriodEnd: false,
      },
      allSubscriptions: [expect.any(Object), expect.any(Object)],
      payments: [expect.any(Object), expect.any(Object)],
    });

    await expect(
      c.loadMirroredSubscriptionStatus(
        createScriptedSupabase([
          { data: { id: 'row' } },
          { data: [{ id: 'inactive', status: null }, {}] },
          { data: [{ id: 'payment' }, {}] },
        ]).client,
        'user-1'
      )
    ).resolves.toMatchObject({ hasSubscription: false, subscription: null });
  });

  it('validates customer ownership and creates missing local customer entities', async () => {
    const stripe = createStripeMock();
    await expect(
      c.assertStripeCustomerBelongsToUser(
        stripe,
        createScriptedSupabase([{ error: { message: 'ownership' } }]).client,
        'cus_1',
        'user-1'
      )
    ).rejects.toThrow('ownership');
    await expect(
      c.assertStripeCustomerBelongsToUser(
        stripe,
        createScriptedSupabase([{ data: { user_id: 'user-1' } }]).client,
        'cus_1',
        'user-1'
      )
    ).resolves.toBeUndefined();
    await expect(
      c.assertStripeCustomerBelongsToUser(
        stripe,
        createScriptedSupabase([{ data: { user_id: 'other' } }]).client,
        'cus_1',
        'user-1'
      )
    ).rejects.toThrow('Forbidden');

    for (const customer of [
      { id: 'cus_1', deleted: true },
      { id: 'cus_1', metadata: { userId: 'other' } },
    ]) {
      const customerStripe = createStripeMock({
        customers: {
          retrieve: vi.fn().mockResolvedValue(customer),
          search: vi.fn(),
          list: vi.fn(),
          update: vi.fn(),
        },
      });
      await expect(
        c.assertStripeCustomerBelongsToUser(
          customerStripe,
          createScriptedSupabase([{ data: null }]).client,
          'cus_1',
          'user-1'
        )
      ).rejects.toThrow('Forbidden');
    }
    await expect(
      c.assertStripeCustomerBelongsToUser(
        stripe,
        createScriptedSupabase([{ data: null }]).client,
        'cus_1',
        'user-1'
      )
    ).resolves.toBeUndefined();

    await expect(
      c.getCustomerEntityIdForStripeCustomer(
        stripe,
        createScriptedSupabase([{ error: { message: 'entity' } }]).client,
        'cus_1'
      )
    ).rejects.toThrow('Failed to load Stripe customer');
    await expect(
      c.getCustomerEntityIdForStripeCustomer(
        stripe,
        createScriptedSupabase([{ data: { id: 'row' } }]).client,
        'cus_1'
      )
    ).resolves.toBe('row');
    const unlinked = createStripeMock({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ id: 'cus_1', metadata: {} }),
        search: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      c.getCustomerEntityIdForStripeCustomer(
        unlinked,
        createScriptedSupabase([{ data: null }]).client,
        'cus_1'
      )
    ).rejects.toThrow('not linked');
    await expect(
      c.getCustomerEntityIdForStripeCustomer(
        stripe,
        createScriptedSupabase([
          { data: null },
          { data: null },
          { data: null },
          { data: { id: 'inserted' } },
        ]).client,
        'cus_1'
      )
    ).resolves.toBe('inserted');
  });

  it('normalizes invoice relationship shapes and synchronizes every actionable invoice status', async () => {
    expect(c.invoiceCustomerId({ customer: 'cus_1' } as any)).toBe('cus_1');
    expect(c.invoiceCustomerId({ customer: { id: 'cus_2' } } as any)).toBe('cus_2');
    expect(c.invoiceCustomerId({ customer: null } as any)).toBeNull();
    expect(
      c.invoiceSubscriptionId({
        parent: { subscription_details: { subscription: 'sub_1' } },
      } as any)
    ).toBe('sub_1');
    expect(
      c.invoiceSubscriptionId({
        parent: { subscription_details: { subscription: { id: 'sub_2' } } },
      } as any)
    ).toBe('sub_2');
    expect(c.invoiceSubscriptionId({ parent: null } as any)).toBeNull();

    const { db, client } = createFakeSupabase({
      stripe_customer: [{ id: 'row', user_id: 'user-1', stripe_customer_id: 'cus_1' }],
    });
    const statuses = [
      { id: 'paid', status: 'paid' },
      { id: 'uncollectible', status: 'uncollectible' },
      { id: 'void', status: 'void' },
      { id: 'attempted-open', status: 'open', attempted: true },
      { id: 'open', status: 'open', attempted: false },
      { id: 'draft', status: 'draft' },
    ];
    const stripe = createStripeMock({
      invoices: {
        list: vi.fn().mockResolvedValue({
          data: statuses.map(invoice => ({
            ...invoice,
            customer: 'cus_1',
            amount_paid: 100,
            amount_due: 100,
            currency: 'eur',
            status_transitions: {},
          })),
        }),
      },
    });
    await c.syncRecentInvoicesForCustomer(stripe, client as any, 'cus_1');
    expect(db.stripe_payment.map(row => row.stripe_invoice_id)).toEqual([
      'paid',
      'uncollectible',
      'void',
      'attempted-open',
    ]);
  });

  it('handles checkout metadata fallbacks, missing fields, and optional synchronization', async () => {
    const { client } = createFakeSupabase();
    const stripe = createStripeMock();
    await expect(
      c.handleCheckoutSessionCompleted(
        stripe,
        client as any,
        {
          metadata: {},
          subscription: null,
          customer: 'cus_1',
        } as any
      )
    ).rejects.toThrow('missing user metadata');
    await expect(
      c.handleCheckoutSessionCompleted(
        stripe,
        client as any,
        {
          metadata: { userId: 'user-1' },
          customer: null,
        } as any
      )
    ).rejects.toThrow('missing a customer');

    const updateFailure = createStripeMock();
    updateFailure.customers.update.mockRejectedValue(new Error('metadata unavailable'));
    await expect(
      c.handleCheckoutSessionCompleted(
        updateFailure,
        createFakeSupabase().client as any,
        {
          metadata: { userId: 'user-1' },
          customer: { id: 'cus_1' },
          customer_details: null,
          subscription: null,
        } as any
      )
    ).resolves.toBeUndefined();

    const subscriptionObject = createStripeMock();
    subscriptionObject.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_object',
      metadata: { userId: 'user-1' },
      customer: 'cus_1',
      status: 'active',
      currency: 'eur',
      items: { data: [] },
    });
    await expect(
      c.handleCheckoutSessionCompleted(
        subscriptionObject,
        createFakeSupabase().client as any,
        {
          metadata: {},
          customer: { id: 'cus_1' },
          subscription: { id: 'sub_object' },
        } as any
      )
    ).resolves.toBeUndefined();
  });

  it('reconciles missing customers and email fallbacks', async () => {
    const noneStripe = createStripeMock();
    await expect(
      c.reconcileStripeCustomer(noneStripe, createFakeSupabase().client as any, {
        id: 'user-1',
        email: 'user@example.com',
      })
    ).resolves.toBe(false);

    const customer = { id: 'cus_1', email: null, metadata: { userId: 'user-1' } };
    const stripe = createStripeMock({
      customers: {
        retrieve: vi.fn().mockResolvedValue(customer),
        search: vi.fn().mockResolvedValue({ data: [customer] }),
        list: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      c.reconcileStripeCustomer(stripe, createFakeSupabase().client as any, {
        id: 'user-1',
        email: null,
      })
    ).resolves.toBe(true);
  });

  it('covers checkout customer selection, empty email, missing URL, and portal not-found paths', async () => {
    const seeded = createFakeSupabase({
      stripe_customer: [{ id: 'row', user_id: 'user-1', stripe_customer_id: 'cus_1' }],
    });
    const stripe = createStripeMock();
    await executeStripeCreateCheckout(
      { plan: 'running' },
      { stripe, supabase: seeded.client as any, user: { id: 'user-1', email: null } }
    );
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_1' })
    );

    const noUrl = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: null }),
          retrieve: vi.fn(),
        },
      },
    });
    await expect(
      executeStripeCreateCheckout(
        { plan: 'running' },
        { stripe: noUrl, supabase: createFakeSupabase().client as any, user: { id: 'user-1' } }
      )
    ).rejects.toThrow('did not return a URL');
    await expect(
      executeStripeCreatePortal(
        {},
        { stripe, supabase: createFakeSupabase().client as any, user: { id: 'user-1' } }
      )
    ).rejects.toThrow('Stripe customer not found');
  });

  it('falls back to live Stripe status for missing, inactive, active, paid, and failed records', async () => {
    const stripe = createStripeMock();
    await expect(
      executeStripeSubscriptionStatus(
        {},
        { stripe, supabase: createFakeSupabase().client as any, user: { id: 'user-1' } }
      )
    ).resolves.toMatchObject({ hasCustomer: false, hasSubscription: false });

    const seed = {
      stripe_customer: [{ id: 'row', user_id: 'user-1', stripe_customer_id: 'cus_1' }],
    };
    const inactiveStripe = createStripeMock({
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'sub_canceled',
              customer: 'cus_1',
              status: 'canceled',
              currency: 'eur',
              items: { data: [] },
            },
          ],
        }),
      },
      invoices: { list: vi.fn().mockResolvedValue({ data: [] }) },
    });
    await expect(
      executeStripeSubscriptionStatus(
        {},
        {
          stripe: inactiveStripe,
          supabase: createFakeSupabase(seed).client as any,
          user: { id: 'user-1' },
        }
      )
    ).resolves.toMatchObject({ hasCustomer: true, hasSubscription: false, subscription: null });

    const activeStripe = createStripeMock({
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
        list: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'sub_active',
              customer: 'cus_1',
              status: 'active',
              currency: 'eur',
              items: { data: [] },
            },
          ],
        }),
      },
      invoices: {
        list: vi.fn().mockResolvedValue({
          data: [
            { id: 'paid', amount_paid: 100, currency: 'eur', status: 'paid' },
            { id: 'failed', amount_paid: 0, currency: 'eur', status: 'open' },
          ],
        }),
      },
    });
    await expect(
      executeStripeSubscriptionStatus(
        {},
        {
          stripe: activeStripe,
          supabase: createFakeSupabase(seed).client as any,
          user: { id: 'user-1' },
        }
      )
    ).resolves.toMatchObject({
      hasSubscription: true,
      subscription: { id: 'sub_active' },
      payments: [{ status: 'paid' }, { status: 'failed' }],
    });
  });

  it('validates repair session completion and ownership metadata fallbacks', async () => {
    const incomplete = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn().mockResolvedValue({ status: 'open' }),
        },
      },
    });
    await expect(
      executeStripeRepairCheckoutSession(
        { sessionId: 'open' },
        { stripe: incomplete, supabase: createFakeSupabase().client as any, user: { id: 'user-1' } }
      )
    ).rejects.toThrow('not complete');

    const viaClientReference = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn().mockResolvedValue({
            status: null,
            metadata: {},
            client_reference_id: 'user-1',
            customer: null,
            subscription: null,
          }),
        },
      },
    });
    await expect(
      executeStripeRepairCheckoutSession(
        { sessionId: 'client-ref' },
        {
          stripe: viaClientReference,
          supabase: createFakeSupabase().client as any,
          user: { id: 'user-1' },
        }
      )
    ).rejects.toThrow('missing user metadata');

    const deletedSubscription = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn().mockResolvedValue({
            status: 'complete',
            metadata: {},
            client_reference_id: null,
            customer: 'cus_1',
            subscription: { id: 'sub_deleted', deleted: true },
          }),
        },
      },
    });
    await expect(
      executeStripeRepairCheckoutSession(
        { sessionId: 'deleted' },
        {
          stripe: deletedSubscription,
          supabase: createFakeSupabase().client as any,
          user: { id: 'user-1' },
        }
      )
    ).rejects.toThrow('Forbidden');

    const viaSubscription = createStripeMock({
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn().mockResolvedValue({
            status: 'complete',
            metadata: {},
            client_reference_id: null,
            customer: { id: 'cus_1' },
            customer_details: null,
            subscription: {
              id: 'sub_object',
              metadata: { userId: 'user-1' },
              customer: 'cus_1',
              status: 'active',
              currency: 'eur',
              items: { data: [] },
            },
          }),
        },
      },
      invoices: { list: vi.fn().mockResolvedValue({ data: [] }) },
    });
    viaSubscription.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_object',
      metadata: { userId: 'user-1' },
      customer: 'cus_1',
      status: 'active',
      currency: 'eur',
      items: { data: [] },
    });
    await expect(
      executeStripeRepairCheckoutSession(
        { sessionId: 'subscription-metadata' },
        {
          stripe: viaSubscription,
          supabase: createFakeSupabase().client as any,
          user: { id: 'user-1' },
        }
      )
    ).resolves.toMatchObject({ hasCustomer: true });
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

  it('returns JSON for accepted events and preserves typed signature errors', async () => {
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_unknown',
      type: 'customer.created',
      livemode: false,
      data: { object: {} },
    });
    const response = await handleStripeWebhookRequest(
      new Request('https://app.example/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
      }),
      { stripe, supabase: createFakeSupabase().client as any }
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, eventId: 'evt_unknown' });

    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const invalid = await handleStripeWebhookRequest(
      new Request('https://app.example/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'bad' },
        body: '{}',
      }),
      { stripe, supabase: createFakeSupabase().client as any }
    );
    expect(invalid.status).toBe(400);
  });

  it('uses stable fallback messages for non-Error failures', async () => {
    const stripe = createStripeMock();
    stripe.webhooks.constructEvent
      .mockImplementationOnce(() => {
        throw 'invalid signature';
      })
      .mockReturnValueOnce({
        id: 'evt_plain_db',
        type: 'customer.subscription.updated',
        livemode: false,
        data: { object: { customer: 'cus_1' } },
      });
    await expect(
      handleStripeWebhook(
        { rawBody: '{}', signature: 'bad' },
        { stripe, supabase: createFakeSupabase().client as any }
      )
    ).rejects.toMatchObject({ message: 'Stripe signature verification failed' });

    const response = await handleStripeWebhookRequest(
      new Request('https://app.example/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
      }),
      {
        stripe,
        supabase: {
          from: () => {
            throw 'plain database failure';
          },
        } as any,
      }
    );
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('Stripe webhook failed');
  });
});
