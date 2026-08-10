import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { getSession } from '@/lib/supabase/server';

const STRIPE_API_VERSION = '2026-06-24.dahlia';
const CUSTOM_AMOUNT_MIN_CENTS = 100;
const CUSTOM_AMOUNT_MAX_CENTS = 99_900;
export type StripeMode = 'test' | 'live';
export type StripePlan = 'running' | 'development' | 'custom';

interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start?: number;
  current_period_end?: number;
}

interface StripeUser {
  id: string;
  email?: string | null;
}

type SupabaseClient = ReturnType<typeof createClient>;

export interface StripeServiceDeps {
  request?: Request;
  stripe?: Stripe;
  supabase?: SupabaseClient;
  user?: StripeUser | null;
}

export interface StripeCheckoutInput {
  plan: StripePlan;
  amount?: number;
  userId?: string;
}

export interface StripeSubscriptionStatusInput {
  userId?: string;
}

export interface StripeRepairCheckoutSessionInput {
  sessionId: string;
  userId?: string;
}

export type StripeCreatePortalInput = Record<string, never>;

export interface StripeReconcileCustomerInput {
  userId?: string;
}

export interface StripeCancelSubscriptionInput {
  subscriptionId: string;
}

export interface StripeWebhookInput {
  rawBody: string;
  signature: string;
}

export class StripeWebhookHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StripeWebhookHttpError';
    this.status = status;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

function getStripeMode(): StripeMode {
  const mode = getRequiredEnv('STRIPE_MODE');
  if (mode !== 'test' && mode !== 'live') {
    throw new Error('STRIPE_MODE must be either test or live');
  }
  return mode;
}

function expectedLivemode(): boolean {
  return getStripeMode() === 'live';
}

function assertSecretKeyMatchesMode(secretKey: string): void {
  const expectedPrefix = expectedLivemode() ? 'sk_live_' : 'sk_test_';
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error(`STRIPE_SECRET_KEY must use the ${expectedPrefix} prefix`);
  }
}

function getStripe(): Stripe {
  const secretKey = getRequiredEnv('STRIPE_SECRET_KEY');
  assertSecretKeyMatchesMode(secretKey);
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

function getSupabase(): SupabaseClient {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function getServiceClients(deps: StripeServiceDeps) {
  return {
    stripe: deps.stripe ?? getStripe(),
    supabase: deps.supabase ?? getSupabase(),
  };
}

function fromTable(supabase: SupabaseClient, table: string): any {
  return (supabase.from as any)(table);
}

function getAppOrigin(): string {
  const value = getRequiredEnv('VITE_APP_URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('VITE_APP_URL must be an HTTP(S) URL');
  }
  return url.origin;
}

async function requireAuthenticatedUser(
  expectedUserId: string | undefined,
  deps: StripeServiceDeps
): Promise<StripeUser> {
  const user = Object.prototype.hasOwnProperty.call(deps, 'user')
    ? deps.user
    : await readRequestUser(deps.request);

  const authenticatedUser = user && typeof user.id === 'string' && user.id.length > 0 ? user : null;
  if (authenticatedUser === null) {
    throw new Error('Unauthorized');
  }

  if (expectedUserId && expectedUserId !== authenticatedUser.id) {
    throw new Error('Forbidden');
  }

  return authenticatedUser;
}

async function readRequestUser(requestOverride?: Request): Promise<StripeUser | null> {
  const request = requestOverride ?? getRequest();
  if (!request) {
    throw new Error('Request context unavailable.');
  }

  const session = await getSession(request);
  return session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
      }
    : null;
}

function getFixedPriceId(plan: Exclude<StripePlan, 'custom'>): string {
  return getRequiredEnv(plan === 'running' ? 'STRIPE_PRICE_RUNNING' : 'STRIPE_PRICE_DEVELOPMENT');
}

function getCheckoutLineItems(
  data: StripeCheckoutInput
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (data.plan !== 'custom') {
    if (data.amount !== undefined) {
      throw new Error('Fixed Stripe plans do not accept a custom amount');
    }
    return [{ price: getFixedPriceId(data.plan), quantity: 1 }];
  }

  const amount = Number(data.amount);
  if (
    !Number.isInteger(amount) ||
    amount < CUSTOM_AMOUNT_MIN_CENTS ||
    amount > CUSTOM_AMOUNT_MAX_CENTS
  ) {
    throw new Error('Custom amount must be between EUR 1 and EUR 999');
  }

  return [
    {
      price_data: {
        currency: 'eur',
        product: getRequiredEnv('STRIPE_PRODUCT_CUSTOM'),
        recurring: { interval: 'month' },
        unit_amount: amount,
      },
      quantity: 1,
    },
  ];
}

const validatedCatalogs = new WeakMap<object, Set<string>>();
const validatedPortalConfigurations = new WeakMap<object, string>();

function assertResourceMode(resourceName: string, livemode: boolean): void {
  if (livemode !== expectedLivemode()) {
    throw new Error(`${resourceName} does not belong to the configured Stripe mode`);
  }
}

async function validateFixedPrice(
  stripe: Stripe,
  plan: Exclude<StripePlan, 'custom'>
): Promise<void> {
  const priceId = getFixedPriceId(plan);
  const price = await stripe.prices.retrieve(priceId);
  assertResourceMode(`Stripe price ${priceId}`, price.livemode);
  if (!price.active || price.currency !== 'eur' || price.recurring?.interval !== 'month') {
    throw new Error(`Stripe price ${priceId} must be active, monthly, and denominated in EUR`);
  }
}

async function validateCustomProduct(stripe: Stripe): Promise<void> {
  const productId = getRequiredEnv('STRIPE_PRODUCT_CUSTOM');
  const product = await stripe.products.retrieve(productId);
  if ('deleted' in product && product.deleted) {
    throw new Error(`Stripe product ${productId} is deleted`);
  }
  assertResourceMode(`Stripe product ${productId}`, product.livemode);
  if (!product.active) {
    throw new Error(`Stripe product ${productId} must be active`);
  }
}

async function validateCheckoutConfiguration(stripe: Stripe, plan: StripePlan): Promise<void> {
  const resourceId = plan === 'custom' ? process.env.STRIPE_PRODUCT_CUSTOM : getFixedPriceId(plan);
  const fingerprint = `${getStripeMode()}:${plan}:${resourceId}`;
  const validated = validatedCatalogs.get(stripe);
  if (validated?.has(fingerprint)) {
    return;
  }

  if (plan === 'custom') {
    await validateCustomProduct(stripe);
  } else {
    await validateFixedPrice(stripe, plan);
  }
  const nextValidated = validated ?? new Set<string>();
  nextValidated.add(fingerprint);
  validatedCatalogs.set(stripe, nextValidated);
}

async function validatePortalConfiguration(stripe: Stripe): Promise<string> {
  const configurationId = getRequiredEnv('STRIPE_PORTAL_CONFIGURATION_ID');
  const fingerprint = `${getStripeMode()}:${configurationId}`;
  if (validatedPortalConfigurations.get(stripe) === fingerprint) {
    return configurationId;
  }

  const configuration = await stripe.billingPortal.configurations.retrieve(configurationId);
  assertResourceMode(`Stripe portal configuration ${configurationId}`, configuration.livemode);
  if (!configuration.active) {
    throw new Error(`Stripe portal configuration ${configurationId} must be active`);
  }
  validatedPortalConfigurations.set(stripe, fingerprint);
  return configurationId;
}

function isDeletedCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer
): customer is Stripe.DeletedCustomer {
  return 'deleted' in customer && customer.deleted === true;
}

async function findLocalCustomerId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await fromTable(supabase, 'stripe_customer')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe customer: ${error.message}`);
  }

  return typeof data?.stripe_customer_id === 'string' ? data.stripe_customer_id : null;
}

async function findStripeCustomerForUser(
  stripe: Stripe,
  supabase: SupabaseClient,
  userId: string
): Promise<Stripe.Customer | undefined> {
  const localCustomerId = await findLocalCustomerId(supabase, userId);
  if (localCustomerId) {
    const customer = await stripe.customers.retrieve(localCustomerId);
    if (!isDeletedCustomer(customer)) {
      return customer;
    }
  }

  try {
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
    });
    const customer = customers.data[0];
    if (customer) {
      return customer;
    }
  } catch {
    const customers = await stripe.customers.list({ limit: 100 });
    return customers.data.find(customer => customer.metadata?.userId === userId);
  }

  return undefined;
}

async function assertStripeCustomerBelongsToUser(
  stripe: Stripe,
  supabase: SupabaseClient,
  customerId: string,
  userId: string
): Promise<void> {
  const { data: localCustomer, error } = await fromTable(supabase, 'stripe_customer')
    .select('id, user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe customer ownership: ${error.message}`);
  }

  if (localCustomer) {
    if (localCustomer.user_id === userId) {
      return;
    }
    throw new Error('Forbidden');
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (isDeletedCustomer(customer) || customer.metadata?.userId !== userId) {
    throw new Error('Forbidden');
  }
}

function getCustomerIdFromSubscription(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}

function timestampToIso(timestamp?: number | null): string | null {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function timestampToIsoOrNow(timestamp?: number | null): string {
  return timestampToIso(timestamp) ?? new Date().toISOString();
}

function mirrorTimestampToIso(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  }

  return null;
}

function mirrorTimestampToIsoOrNow(value: unknown): string {
  return mirrorTimestampToIso(value) ?? new Date().toISOString();
}

function subscriptionInterval(subscription: Stripe.Subscription): string {
  return subscription.items.data[0]?.price.recurring?.interval ?? 'month';
}

function subscriptionAmount(subscription: Stripe.Subscription): number {
  return subscription.items.data[0]?.price.unit_amount ?? 0;
}

function subscriptionPeriodPayload(subscription: SubscriptionWithPeriod) {
  return {
    current_period_start: timestampToIso(subscription.current_period_start),
    current_period_end: timestampToIso(subscription.current_period_end),
  };
}

async function upsertStripeCustomer(
  supabase: SupabaseClient,
  input: {
    userId: string;
    stripeCustomerId: string;
    email: string | null;
  }
): Promise<string> {
  const now = new Date().toISOString();
  const byStripe = await fromTable(supabase, 'stripe_customer')
    .select('id, user_id')
    .eq('stripe_customer_id', input.stripeCustomerId)
    .maybeSingle();

  if (byStripe.error) {
    throw new Error(`Failed to load Stripe customer: ${byStripe.error.message}`);
  }

  if (byStripe.data) {
    if (byStripe.data.user_id !== input.userId) {
      throw new Error('Stripe customer belongs to a different user');
    }

    const updated = await fromTable(supabase, 'stripe_customer')
      .update({
        email: input.email,
        updated_at: now,
      })
      .eq('id', byStripe.data.id)
      .select('id')
      .single();

    if (updated.error) {
      throw new Error(`Failed to update Stripe customer: ${updated.error.message}`);
    }

    return updated.data.id;
  }

  const byUser = await fromTable(supabase, 'stripe_customer')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (byUser.error) {
    throw new Error(`Failed to load user Stripe customer: ${byUser.error.message}`);
  }

  if (byUser.data) {
    const updated = await fromTable(supabase, 'stripe_customer')
      .update({
        stripe_customer_id: input.stripeCustomerId,
        email: input.email,
        updated_at: now,
      })
      .eq('id', byUser.data.id)
      .select('id')
      .single();

    if (updated.error) {
      throw new Error(`Failed to update user Stripe customer: ${updated.error.message}`);
    }

    return updated.data.id;
  }

  const inserted = await fromTable(supabase, 'stripe_customer')
    .insert({
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (inserted.error) {
    throw new Error(`Failed to insert Stripe customer: ${inserted.error.message}`);
  }

  return inserted.data.id;
}

async function upsertStripeSubscription(
  supabase: SupabaseClient,
  customerEntityId: string,
  stripeCustomerId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const periodSubscription = subscription as SubscriptionWithPeriod;
  const { error } = await fromTable(supabase, 'stripe_subscription').upsert(
    {
      customer_id: customerEntityId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      status: subscription.status,
      ...subscriptionPeriodPayload(periodSubscription),
      cancel_at_period_end: subscription.cancel_at_period_end,
      amount: subscriptionAmount(subscription),
      currency: subscription.currency,
      interval_period: subscriptionInterval(subscription),
      canceled_at: timestampToIso(subscription.canceled_at),
      created_at: timestampToIso(subscription.created) ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert Stripe subscription: ${error.message}`);
  }
}

function invoiceCustomerId(invoice: Stripe.Invoice): string | null {
  if (typeof invoice.customer === 'string') {
    return invoice.customer;
  }
  return invoice.customer?.id ?? null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSubscription === 'string') {
    return parentSubscription;
  }
  return parentSubscription?.id ?? null;
}

async function getCustomerEntityIdForStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  stripeCustomerId: string
): Promise<string> {
  const { data, error } = await fromTable(supabase, 'stripe_customer')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe customer: ${error.message}`);
  }

  if (data) {
    return data.id;
  }

  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (isDeletedCustomer(customer) || !customer.metadata?.userId) {
    throw new Error('Stripe customer is not linked to a user');
  }

  return upsertStripeCustomer(supabase, {
    userId: customer.metadata.userId,
    stripeCustomerId,
    email: customer.email ?? null,
  });
}

async function upsertStripePayment(
  stripe: Stripe,
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
  status: 'paid' | 'failed'
): Promise<void> {
  const stripeCustomerId = invoiceCustomerId(invoice);
  if (!stripeCustomerId) {
    throw new Error('Invoice is missing a Stripe customer');
  }

  const customerEntityId = await getCustomerEntityIdForStripeCustomer(
    stripe,
    supabase,
    stripeCustomerId
  );
  const paidAt =
    status === 'paid'
      ? (timestampToIso(invoice.status_transitions?.paid_at) ?? new Date().toISOString())
      : null;

  const { error } = await fromTable(supabase, 'stripe_payment').upsert(
    {
      customer_id: customerEntityId,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: invoiceSubscriptionId(invoice),
      amount: status === 'paid' ? invoice.amount_paid : invoice.amount_due,
      currency: invoice.currency,
      status,
      created_at: timestampToIso(invoice.created) ?? new Date().toISOString(),
      paid_at: paidAt,
    },
    { onConflict: 'stripe_invoice_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert Stripe payment: ${error.message}`);
  }
}

async function syncRecentInvoicesForCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  stripeCustomerId: string
): Promise<void> {
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 10,
  });

  for (const invoice of invoices.data) {
    if (invoice.status === 'paid') {
      await upsertStripePayment(stripe, supabase, invoice, 'paid');
    } else if (
      invoice.status === 'uncollectible' ||
      invoice.status === 'void' ||
      (invoice.attempted && invoice.status === 'open')
    ) {
      await upsertStripePayment(stripe, supabase, invoice, 'failed');
    }
  }
}

async function reconcileStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  user: StripeUser
): Promise<boolean> {
  const customer = await findStripeCustomerForUser(stripe, supabase, user.id);
  if (!customer) {
    return false;
  }

  const customerEntityId = await upsertStripeCustomer(supabase, {
    userId: user.id,
    stripeCustomerId: customer.id,
    email: customer.email ?? user.email ?? null,
  });
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 100,
  });

  for (const subscription of subscriptions.data) {
    await upsertStripeSubscription(supabase, customerEntityId, customer.id, subscription);
  }
  await syncRecentInvoicesForCustomer(stripe, supabase, customer.id);
  return true;
}

async function getCustomerEntityForSubscription(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<{ customerEntityId: string; stripeCustomerId: string }> {
  const stripeCustomerId = getCustomerIdFromSubscription(subscription);
  const customerEntityId = await getCustomerEntityIdForStripeCustomer(
    stripe,
    supabase,
    stripeCustomerId
  );

  return { customerEntityId, stripeCustomerId };
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  let userId = session.metadata?.userId;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!userId && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    userId = subscription.metadata?.userId;
  }

  if (!userId) {
    throw new Error('Checkout session is missing user metadata');
  }

  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!stripeCustomerId) {
    throw new Error('Checkout session is missing a customer');
  }

  try {
    await stripe.customers.update(stripeCustomerId, {
      metadata: { userId },
    });
  } catch (error) {
    console.error('Failed to update Stripe customer metadata:', error);
  }

  const customerEntityId = await upsertStripeCustomer(supabase, {
    userId,
    stripeCustomerId,
    email: session.customer_details?.email ?? null,
  });

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertStripeSubscription(supabase, customerEntityId, stripeCustomerId, subscription);
  }
}

async function handleSubscriptionChanged(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<void> {
  const { customerEntityId, stripeCustomerId } = await getCustomerEntityForSubscription(
    stripe,
    supabase,
    subscription
  );

  await upsertStripeSubscription(supabase, customerEntityId, stripeCustomerId, subscription);
}

async function loadMirroredSubscriptionStatus(supabase: SupabaseClient, userId: string) {
  const customerResult = await fromTable(supabase, 'stripe_customer')
    .select('id, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (customerResult.error) {
    throw new Error(`Failed to load mirrored Stripe customer: ${customerResult.error.message}`);
  }

  if (!customerResult.data?.id) {
    return null;
  }

  const [subscriptionsResult, paymentsResult] = await Promise.all([
    fromTable(supabase, 'stripe_subscription')
      .select('*')
      .eq('customer_id', customerResult.data.id),
    fromTable(supabase, 'stripe_payment').select('*').eq('customer_id', customerResult.data.id),
  ]);

  if (subscriptionsResult.error) {
    throw new Error(
      `Failed to load mirrored Stripe subscriptions: ${subscriptionsResult.error.message}`
    );
  }

  if (paymentsResult.error) {
    throw new Error(`Failed to load mirrored Stripe payments: ${paymentsResult.error.message}`);
  }

  const subscriptionRows = Array.isArray(subscriptionsResult.data) ? subscriptionsResult.data : [];
  const paymentRows = Array.isArray(paymentsResult.data) ? paymentsResult.data : [];

  if (subscriptionRows.length === 0 && paymentRows.length === 0) {
    return null;
  }

  const sortedSubscriptions = [...subscriptionRows].sort((left, right) =>
    String(right.updated_at ?? right.created_at ?? '').localeCompare(
      String(left.updated_at ?? left.created_at ?? '')
    )
  );
  const activeSubscription =
    sortedSubscriptions.find(row => row.status === 'active' || row.status === 'trialing') ?? null;
  const sortedPayments = [...paymentRows].sort((left, right) =>
    String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''))
  );

  return {
    hasCustomer: true,
    hasSubscription: !!activeSubscription,
    subscription: activeSubscription
      ? {
          id: activeSubscription.stripe_subscription_id ?? activeSubscription.id,
          status: activeSubscription.status,
          amount: activeSubscription.amount ?? 0,
          currency: activeSubscription.currency ?? 'eur',
          interval: activeSubscription.interval_period ?? 'month',
          currentPeriodStart: mirrorTimestampToIsoOrNow(activeSubscription.current_period_start),
          currentPeriodEnd: mirrorTimestampToIsoOrNow(activeSubscription.current_period_end),
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end ?? false,
        }
      : null,
    allSubscriptions: sortedSubscriptions.map(row => ({
      id: row.stripe_subscription_id ?? row.id,
      status: row.status ?? 'unknown',
      amount: row.amount ?? 0,
      currency: row.currency ?? 'eur',
      interval: row.interval_period ?? 'month',
      createdAt: mirrorTimestampToIsoOrNow(row.created_at),
      canceledAt: mirrorTimestampToIso(row.canceled_at),
    })),
    payments: sortedPayments.map(row => ({
      id: row.stripe_invoice_id ?? row.id,
      amount: row.amount ?? 0,
      currency: row.currency ?? 'eur',
      status: row.status ?? 'unknown',
      createdAt: mirrorTimestampToIsoOrNow(row.created_at),
      paidAt: mirrorTimestampToIso(row.paid_at),
    })),
  };
}

export async function executeStripeCreateCheckout(
  data: StripeCheckoutInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(data.userId, deps);
  const { stripe, supabase } = getServiceClients(deps);
  await validateCheckoutConfiguration(stripe, data.plan);
  const customer = await findStripeCustomerForUser(stripe, supabase, user.id);
  const origin = getAppOrigin();
  const settingsUrl = new URL(`/user/${encodeURIComponent(user.id)}/settings`, origin);
  settingsUrl.searchParams.set('tab', 'subscriptions');

  const successUrl = new URL(settingsUrl);
  successUrl.searchParams.set('success', 'true');
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancelUrl = new URL(settingsUrl);
  cancelUrl.searchParams.set('canceled', 'true');

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    success_url: successUrl
      .toString()
      .replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'),
    cancel_url: cancelUrl.toString(),
    line_items: getCheckoutLineItems(data),
    client_reference_id: user.id,
    metadata: { userId: user.id, plan: data.plan },
    subscription_data: {
      metadata: { userId: user.id, plan: data.plan },
    },
    ...(customer ? { customer: customer.id } : user.email ? { customer_email: user.email } : {}),
  };

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) {
    throw new Error('Stripe checkout session did not return a URL');
  }

  return { url: session.url };
}

export async function executeStripeCreatePortal(
  _data: StripeCreatePortalInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(undefined, deps);
  const { stripe, supabase } = getServiceClients(deps);
  const customerId = (await findStripeCustomerForUser(stripe, supabase, user.id))?.id;

  if (!customerId) {
    throw new Error('Stripe customer not found');
  }

  await assertStripeCustomerBelongsToUser(stripe, supabase, customerId, user.id);
  const configuration = await validatePortalConfiguration(stripe);

  const origin = getAppOrigin();
  const returnUrl = new URL(`/user/${encodeURIComponent(user.id)}/settings`, origin);
  returnUrl.searchParams.set('tab', 'subscriptions');
  returnUrl.searchParams.set('billing_return', 'true');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration,
    return_url: returnUrl.toString(),
  });

  return { url: session.url };
}

export async function executeStripeCancelSubscription(
  data: StripeCancelSubscriptionInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(undefined, deps);
  const { stripe, supabase } = getServiceClients(deps);
  const subscription = await stripe.subscriptions.retrieve(data.subscriptionId);
  const customerId = getCustomerIdFromSubscription(subscription);

  await assertStripeCustomerBelongsToUser(stripe, supabase, customerId, user.id);

  const canceledSubscription = await stripe.subscriptions.update(data.subscriptionId, {
    cancel_at_period_end: true,
  });
  const customerEntityId = await getCustomerEntityIdForStripeCustomer(stripe, supabase, customerId);
  await upsertStripeSubscription(supabase, customerEntityId, customerId, canceledSubscription);

  return {
    success: true,
    subscription: {
      id: canceledSubscription.id,
      status: canceledSubscription.status,
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
    },
  };
}

export async function executeStripeSubscriptionStatus(
  data: StripeSubscriptionStatusInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(data.userId, deps);
  const { stripe, supabase } = getServiceClients(deps);
  const mirroredStatus = await loadMirroredSubscriptionStatus(supabase, user.id);

  if (mirroredStatus) {
    return mirroredStatus;
  }

  const customer = await findStripeCustomerForUser(stripe, supabase, user.id);

  if (!customer) {
    return {
      hasCustomer: false,
      hasSubscription: false,
      subscription: null,
      allSubscriptions: [],
      payments: [],
    };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 10,
  });
  const activeSubscription = subscriptions.data.find(sub => sub.status === 'active') as
    SubscriptionWithPeriod | undefined;
  const invoices = await stripe.invoices.list({
    customer: customer.id,
    limit: 10,
  });

  return {
    hasCustomer: true,
    hasSubscription: !!activeSubscription,
    subscription: activeSubscription
      ? {
          id: activeSubscription.id,
          status: activeSubscription.status,
          amount: subscriptionAmount(activeSubscription),
          currency: activeSubscription.currency,
          interval: subscriptionInterval(activeSubscription),
          currentPeriodStart: timestampToIsoOrNow(activeSubscription.current_period_start),
          currentPeriodEnd: timestampToIsoOrNow(activeSubscription.current_period_end),
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        }
      : null,
    allSubscriptions: subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      amount: subscriptionAmount(sub),
      currency: sub.currency,
      interval: subscriptionInterval(sub),
      createdAt: timestampToIsoOrNow(sub.created),
      canceledAt: timestampToIso(sub.canceled_at),
    })),
    payments: invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status === 'paid' ? 'paid' : 'failed',
      createdAt: timestampToIsoOrNow(invoice.created),
      paidAt: timestampToIso(invoice.status_transitions?.paid_at),
    })),
  };
}

export async function executeStripeRepairCheckoutSession(
  data: StripeRepairCheckoutSessionInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(data.userId, deps);
  const { stripe, supabase } = getServiceClients(deps);
  const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
    expand: ['subscription', 'customer'],
  });

  if (session.status && session.status !== 'complete') {
    throw new Error('Checkout session is not complete');
  }

  const subscription =
    typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  const sessionUserId =
    session.metadata?.userId ??
    session.client_reference_id ??
    (subscription && !('deleted' in subscription) ? subscription.metadata?.userId : undefined);

  if (sessionUserId !== user.id) {
    throw new Error('Forbidden');
  }

  await handleCheckoutSessionCompleted(stripe, supabase, session);

  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (stripeCustomerId) {
    await syncRecentInvoicesForCustomer(stripe, supabase, stripeCustomerId);
  }

  return executeStripeSubscriptionStatus({ userId: user.id }, { stripe, supabase, user });
}

export async function executeStripeReconcileCustomer(
  data: StripeReconcileCustomerInput,
  deps: StripeServiceDeps = {}
) {
  const user = await requireAuthenticatedUser(data.userId, deps);
  const { stripe, supabase } = getServiceClients(deps);
  await reconcileStripeCustomer(stripe, supabase, user);
  return executeStripeSubscriptionStatus({ userId: user.id }, { stripe, supabase, user });
}

export async function handleStripeWebhook(data: StripeWebhookInput, deps: StripeServiceDeps = {}) {
  const { stripe, supabase } = getServiceClients(deps);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      data.rawBody,
      data.signature,
      getRequiredEnv('STRIPE_WEBHOOK_SECRET')
    );
  } catch (error) {
    throw new StripeWebhookHttpError(
      error instanceof Error ? error.message : 'Stripe signature verification failed',
      400
    );
  }

  if (event.livemode !== expectedLivemode()) {
    throw new StripeWebhookHttpError(
      `Stripe event mode does not match STRIPE_MODE=${getStripeMode()}`,
      400
    );
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(
        stripe,
        supabase,
        event.data.object as Stripe.Checkout.Session
      );
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChanged(stripe, supabase, event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_succeeded':
      await upsertStripePayment(stripe, supabase, event.data.object as Stripe.Invoice, 'paid');
      break;
    case 'invoice.payment_failed':
      await upsertStripePayment(stripe, supabase, event.data.object as Stripe.Invoice, 'failed');
      break;
  }

  return { received: true, eventId: event.id };
}

export const stripeServiceContracts = {
  assertResourceMode,
  assertSecretKeyMatchesMode,
  assertStripeCustomerBelongsToUser,
  findLocalCustomerId,
  findStripeCustomerForUser,
  getAppOrigin,
  getCheckoutLineItems,
  getCustomerIdFromSubscription,
  getCustomerEntityIdForStripeCustomer,
  getStripeMode,
  getServiceClients,
  handleCheckoutSessionCompleted,
  handleSubscriptionChanged,
  invoiceCustomerId,
  invoiceSubscriptionId,
  loadMirroredSubscriptionStatus,
  mirrorTimestampToIso,
  mirrorTimestampToIsoOrNow,
  readRequestUser,
  reconcileStripeCustomer,
  requireAuthenticatedUser,
  subscriptionAmount,
  subscriptionInterval,
  syncRecentInvoicesForCustomer,
  timestampToIso,
  timestampToIsoOrNow,
  upsertStripeCustomer,
  upsertStripePayment,
  upsertStripeSubscription,
  validateCheckoutConfiguration,
  validatePortalConfiguration,
};
