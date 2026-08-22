import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getRequest: vi.fn(),
  getSession: vi.fn(),
  stripe: {} as any,
  stripeConstructor: vi.fn(),
  supabase: {} as any,
}));

vi.mock('@tanstack/react-start/server', () => ({ getRequest: mocks.getRequest }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('stripe', () => ({
  default: vi.fn(function StripeMock(secretKey: string, options: unknown) {
    mocks.stripeConstructor(secretKey, options);
    return mocks.stripe;
  }),
}));

import { executeStripeCreateCheckout, stripeServiceContracts as c } from '@/server/stripe-service';

function query() {
  const value: any = {};
  for (const method of ['select', 'eq', 'insert', 'update']) value[method] = vi.fn(() => value);
  value.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  value.single = vi.fn(async () => ({ data: { id: 'row' }, error: null }));
  value.upsert = vi.fn(async () => ({ error: null }));
  value.then = (resolve: (result: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return value;
}

describe('Stripe default server dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('STRIPE_MODE', 'test');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_default');
    vi.stubEnv('STRIPE_PRICE_RUNNING', 'price_running');
    vi.stubEnv('VITE_APP_URL', 'https://app.example');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    mocks.supabase = { from: vi.fn(() => query()) };
    mocks.createClient.mockReturnValue(mocks.supabase);
    mocks.stripe = {
      prices: {
        retrieve: vi.fn().mockResolvedValue({
          active: true,
          currency: 'eur',
          livemode: false,
          recurring: { interval: 'month' },
        }),
      },
      customers: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/default' }),
        },
      },
    };
  });

  it('resolves both injected and configured clients', () => {
    const injectedStripe = {} as any;
    const injectedSupabase = {} as any;
    expect(c.getServiceClients({ stripe: injectedStripe, supabase: injectedSupabase })).toEqual({
      stripe: injectedStripe,
      supabase: injectedSupabase,
    });
    expect(c.getServiceClients({})).toEqual({ stripe: mocks.stripe, supabase: mocks.supabase });
    expect(mocks.createClient).toHaveBeenCalledWith('https://supabase.example', 'service-role');
    expect(mocks.stripeConstructor).toHaveBeenCalledWith('sk_test_default', {
      apiVersion: '2026-07-29.dahlia',
    });
  });

  it('reads request and session defaults, overrides, missing contexts, and signed-out sessions', async () => {
    const request = new Request('https://app.example');
    mocks.getRequest.mockReturnValue(request);
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'user-1', email: 'user@example.com' } });
    await expect(c.readRequestUser()).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });
    mocks.getSession.mockResolvedValueOnce(null);
    await expect(c.readRequestUser(request)).resolves.toBeNull();
    mocks.getRequest.mockReturnValue(undefined);
    await expect(c.readRequestUser()).rejects.toThrow('Request context unavailable');
  });

  it('executes checkout entirely through configured server defaults', async () => {
    mocks.getRequest.mockReturnValue(new Request('https://app.example'));
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: null } });
    await expect(executeStripeCreateCheckout({ plan: 'running' })).resolves.toEqual({
      url: 'https://checkout.stripe.test/default',
    });
    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: 'user-1' })
    );
  });

  it('rejects a missing required environment value', () => {
    vi.stubEnv('STRIPE_MODE', '');
    expect(() => c.getStripeMode()).toThrow('STRIPE_MODE is not defined');
  });
});
