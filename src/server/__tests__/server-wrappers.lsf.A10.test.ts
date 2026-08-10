import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(async (data: unknown) => data),
  checkout: vi.fn(async (data: unknown) => data),
  portal: vi.fn(async (data: unknown) => data),
  reconcile: vi.fn(async (data: unknown) => data),
  repair: vi.fn(async (data: unknown) => data),
  status: vi.fn(async (data: unknown) => data),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (_validator: unknown) => ({
      handler: (handler: unknown) => handler,
    }),
  }),
}));
vi.mock('../stripe-service', () => ({
  executeStripeCancelSubscription: mocks.cancel,
  executeStripeCreateCheckout: mocks.checkout,
  executeStripeCreatePortal: mocks.portal,
  executeStripeReconcileCustomer: mocks.reconcile,
  executeStripeRepairCheckoutSession: mocks.repair,
  executeStripeSubscriptionStatus: mocks.status,
}));

import { overpassStreetSceneFn, overpassStreetSceneInternals } from '../overpass-street-scene';
import { stripeCancelSubscriptionFn } from '../stripe-cancel-subscription';
import { stripeCreateCheckoutFn } from '../stripe-create-checkout';
import { stripeCreatePortalFn } from '../stripe-create-portal';
import { stripeReconcileCustomerFn } from '../stripe-reconcile-customer';
import { stripeRepairCheckoutSessionFn } from '../stripe-repair-checkout-session';
import { stripeSubscriptionStatusFn } from '../stripe-subscription-status';

describe('A10 server wrapper LSF contracts', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('forwards every Stripe server function to its service', async () => {
    await (stripeCancelSubscriptionFn as any)({ data: { subscriptionId: 'subscription' } });
    await (stripeCreateCheckoutFn as any)({ data: { plan: 'running' } });
    await (stripeCreatePortalFn as any)({ data: {} });
    await (stripeReconcileCustomerFn as any)({ data: { userId: 'user' } });
    await (stripeRepairCheckoutSessionFn as any)({ data: { sessionId: 'session' } });
    await (stripeSubscriptionStatusFn as any)({ data: { userId: 'user' } });

    for (const service of [
      mocks.cancel,
      mocks.checkout,
      mocks.portal,
      mocks.reconcile,
      mocks.repair,
      mocks.status,
    ]) {
      expect(service).toHaveBeenCalledOnce();
    }
  });

  it('sorts closed relation rings and invokes the validated Overpass handler', async () => {
    const shortRing = [
      { lat: 10, lon: 10 },
      { lat: 10, lon: 11 },
      { lat: 11, lon: 10 },
      { lat: 10, lon: 10 },
    ];
    const longRing = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
      { lat: 0, lon: 0 },
    ];
    expect(overpassStreetSceneInternals.stitchRelationSegments([shortRing, longRing])).toEqual(
      longRing
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const result = await (overpassStreetSceneFn as any)({
      data: { bbox: { south: 52.5, west: 13.4, north: 52.501, east: 13.401 } },
    });
    expect(result.features).toEqual([]);
  });
});
