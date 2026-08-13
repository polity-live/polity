import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => {
  class DeliveryHttpError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  class SubscriptionConflictError extends Error {}
  class DatabaseUnavailableError extends Error {}
  return {
    DatabaseUnavailableError,
    DeliveryHttpError,
    SubscriptionConflictError,
    authorizeDelivery: vi.fn(),
    cleanupTutorial: vi.fn(),
    executeDelivery: vi.fn(),
    getSession: vi.fn(),
    getSubscription: vi.fn(),
    getTestStatus: vi.fn(),
    handleNewsletter: vi.fn(),
    handleResend: vi.fn(),
    handleStripe: vi.fn(),
    processTest: vi.fn(),
    registerSubscription: vi.fn(),
    scheduleTest: vi.fn(),
    subscriptionParse: vi.fn(),
    unregisterSubscription: vi.fn(),
  };
});

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/push-subscription-service', () => ({
  PushSubscriptionConflictError: mocks.SubscriptionConflictError,
  getPushSubscriptionForDevice: mocks.getSubscription,
  pushSubscriptionInputSchema: { parse: mocks.subscriptionParse },
  registerPushSubscriptionForUser: mocks.registerSubscription,
  unregisterPushSubscriptionForUser: mocks.unregisterSubscription,
}));
vi.mock('@/server/push-delivery-service', () => ({
  PushDeliveryHttpError: mocks.DeliveryHttpError,
  authorizePushDelivery: mocks.authorizeDelivery,
  executePushDelivery: mocks.executeDelivery,
  getPushTestStatus: mocks.getTestStatus,
  processPushTest: mocks.processTest,
  schedulePushTest: mocks.scheduleTest,
}));
vi.mock('@/server/newsletter-routes', () => ({
  handleNewsletterSyncRequest: mocks.handleNewsletter,
  handleResendWebhookRequest: mocks.handleResend,
}));
vi.mock('@/server/stripe-webhook-route', () => ({
  handleStripeWebhookRequest: mocks.handleStripe,
}));
vi.mock('@/server/app-tutorial/db', () => ({
  AppTutorialDatabaseUnavailableError: mocks.DatabaseUnavailableError,
}));
vi.mock('@/server/app-tutorial/service', () => ({
  cleanupExpiredAppTutorialRuns: mocks.cleanupTutorial,
}));

import { Route as NewsletterRoute } from '../newsletter/sync';
import { Route as PushProcessRoute } from '../push/process';
import { Route as PushSubscriptionRoute } from '../push/subscription';
import { Route as PushTestRoute } from '../push/test';
import { Route as PushTestStatusRoute } from '../push/test/$jobId';
import { Route as ResendRoute } from '../resend/webhook';
import { Route as StripeRoute } from '../stripe/webhook';
import { Route as TutorialCleanupRoute } from '../tutorial/cleanup';

type Handler = (input: { request: Request; params?: Record<string, string> }) => Promise<Response>;

function handlers(route: unknown) {
  return (route as { server: { handlers: Record<string, Handler> } }).server.handlers;
}

const newsletter = handlers(NewsletterRoute).POST;
const pushProcess = handlers(PushProcessRoute).POST;
const subscription = handlers(PushSubscriptionRoute);
const pushTest = handlers(PushTestRoute).POST;
const pushTestStatus = handlers(PushTestStatusRoute);
const resend = handlers(ResendRoute).POST;
const stripe = handlers(StripeRoute).POST;
const cleanup = handlers(TutorialCleanupRoute).POST;

function request(method = 'POST', body?: unknown, url = 'http://localhost/api/test') {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function zodFailure() {
  return new z.ZodError([]);
}

let cleanupSecret: string | undefined;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  cleanupSecret = process.env.APP_TUTORIAL_CLEANUP_SECRET;
  delete process.env.APP_TUTORIAL_CLEANUP_SECRET;
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getSubscription.mockResolvedValue({ id: 'subscription-1' });
  mocks.subscriptionParse.mockReturnValue({ deviceId: 'device-1', endpoint: 'https://push' });
  mocks.registerSubscription.mockResolvedValue({ id: 'subscription-1' });
  mocks.unregisterSubscription.mockResolvedValue(undefined);
  mocks.executeDelivery.mockResolvedValue({ delivered: 2 });
  mocks.scheduleTest.mockResolvedValue({ jobId: 'job-1' });
  mocks.getTestStatus.mockResolvedValue({ status: 'sent' });
  mocks.processTest.mockResolvedValue({ status: 'sent' });
  mocks.handleNewsletter.mockResolvedValue(new Response('newsletter'));
  mocks.handleResend.mockResolvedValue(new Response('resend'));
  mocks.handleStripe.mockResolvedValue(new Response('stripe'));
  mocks.cleanupTutorial.mockResolvedValue(3);
});

afterEach(() => {
  errorSpy.mockRestore();
  if (cleanupSecret === undefined) delete process.env.APP_TUTORIAL_CLEANUP_SECRET;
  else process.env.APP_TUTORIAL_CLEANUP_SECRET = cleanupSecret;
});

describe('push subscription route', () => {
  it.each(['GET', 'PUT', 'DELETE'] as const)('rejects anonymous %s requests', async method => {
    mocks.getSession.mockResolvedValue(null);
    const response = await subscription[method]({ request: request(method) });
    expect(response.status).toBe(401);
  });

  it('gets, registers and unregisters device subscriptions', async () => {
    const deviceId = '00000000-0000-4000-8000-000000000001';
    let response = await subscription.GET({
      request: request(
        'GET',
        undefined,
        `http://localhost/api/push/subscription?deviceId=${deviceId}`
      ),
    });
    expect(response.status).toBe(200);
    expect(mocks.getSubscription).toHaveBeenCalledWith('user-1', deviceId);

    response = await subscription.PUT({ request: request('PUT', { endpoint: 'https://push' }) });
    expect(response.status).toBe(200);
    expect(mocks.registerSubscription).toHaveBeenCalledWith('user-1', {
      deviceId: 'device-1',
      endpoint: 'https://push',
    });

    response = await subscription.DELETE({ request: request('DELETE', { deviceId }) });
    expect(response.status).toBe(200);
    expect(mocks.unregisterSubscription).toHaveBeenCalledWith('user-1', deviceId);
  });

  it('maps validation, conflict and unexpected failures', async () => {
    let response = await subscription.GET({
      request: request('GET', undefined, 'http://localhost/api/push/subscription'),
    });
    expect(response.status).toBe(400);

    mocks.subscriptionParse.mockImplementationOnce(() => {
      throw new mocks.SubscriptionConflictError('conflict');
    });
    response = await subscription.PUT({ request: request('PUT', {}) });
    expect(response.status).toBe(409);

    mocks.unregisterSubscription.mockRejectedValueOnce(new Error('database failed'));
    response = await subscription.DELETE({
      request: request('DELETE', {
        deviceId: '00000000-0000-4000-8000-000000000001',
      }),
    });
    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('[PushSubscriptionRoute]', expect.any(Error));
  });
});

describe('push delivery and test routes', () => {
  it('authorizes and executes a delivery batch', async () => {
    const incoming = request();
    const response = await pushProcess({ request: incoming });
    expect(response.status).toBe(200);
    expect(mocks.authorizeDelivery).toHaveBeenCalledWith(incoming);
  });

  it.each([
    [new mocks.DeliveryHttpError('forbidden', 403), 403, false],
    [new Error('failed'), 500, true],
  ] as const)('maps delivery failures to %i', async (failure, status, logs) => {
    mocks.authorizeDelivery.mockImplementationOnce(() => {
      throw failure;
    });
    const response = await pushProcess({ request: request() });
    expect(response.status).toBe(status);
    expect(errorSpy.mock.calls.some((call: unknown[]) => call[0] === '[PushDeliveryRoute]')).toBe(
      logs
    );
  });

  it('guards and schedules a push test', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await pushTest({ request: request('POST', {}) });
    expect(response.status).toBe(401);

    response = await pushTest({
      request: request('POST', {
        deviceId: '00000000-0000-4000-8000-000000000001',
        title: 'Test',
        message: 'Hello',
      }),
    });
    expect(response.status).toBe(202);
    expect(mocks.scheduleTest).toHaveBeenCalledWith(
      'user-1',
      '00000000-0000-4000-8000-000000000001',
      { title: 'Test', message: 'Hello' }
    );
  });

  it.each([
    [zodFailure(), 400, false],
    [new mocks.DeliveryHttpError('missing', 404), 404, false],
    [new Error('failed'), 500, true],
  ] as const)('maps push-test failures to %i', async (failure, status, logs) => {
    mocks.scheduleTest.mockRejectedValueOnce(failure);
    const response = await pushTest({
      request: request('POST', {
        deviceId: '00000000-0000-4000-8000-000000000001',
        title: 'Test',
        message: 'Hello',
      }),
    });
    expect(response.status).toBe(status);
    expect(errorSpy.mock.calls.some((call: unknown[]) => call[0] === '[PushTestRoute]')).toBe(logs);
  });

  it.each(['GET', 'POST'] as const)(
    'guards and executes the push-test %s endpoint',
    async method => {
      mocks.getSession.mockResolvedValueOnce(null);
      let response = await pushTestStatus[method]({
        request: request(method),
        params: { jobId: 'job-1' },
      });
      expect(response.status).toBe(401);
      response = await pushTestStatus[method]({
        request: request(method),
        params: { jobId: 'job-1' },
      });
      expect(response.status).toBe(200);
      const operation = method === 'GET' ? mocks.getTestStatus : mocks.processTest;
      expect(operation).toHaveBeenCalledWith('user-1', 'job-1');
    }
  );

  it.each([
    ['GET', new mocks.DeliveryHttpError('missing', 404), 404, false],
    ['POST', new Error('failed'), 500, true],
  ] as const)('maps push-test status %s failures', async (method, failure, status, logs) => {
    const operation = method === 'GET' ? mocks.getTestStatus : mocks.processTest;
    operation.mockRejectedValueOnce(failure);
    const response = await pushTestStatus[method]({
      request: request(method),
      params: { jobId: 'job-1' },
    });
    expect(response.status).toBe(status);
    expect(errorSpy.mock.calls.some((call: unknown[]) => call[0] === '[PushTestStatusRoute]')).toBe(
      logs
    );
  });
});

describe('thin webhook routes', () => {
  it.each([
    [newsletter, mocks.handleNewsletter, 'newsletter'],
    [resend, mocks.handleResend, 'resend'],
    [stripe, mocks.handleStripe, 'stripe'],
  ] as const)('forwards the original request', async (route, operation, body) => {
    const incoming = request();
    const response = await route({ request: incoming });
    expect(operation).toHaveBeenCalledWith(incoming);
    expect(await response.text()).toBe(body);
  });
});

describe('tutorial cleanup route', () => {
  it('rejects absent and mismatched secrets', async () => {
    let response = await cleanup({ request: request() });
    expect(response.status).toBe(401);

    process.env.APP_TUTORIAL_CLEANUP_SECRET = 'expected';
    response = await cleanup({
      request: new Request('http://localhost/api/tutorial/cleanup', {
        method: 'POST',
        headers: { 'x-cleanup-secret': 'wrong' },
      }),
    });
    expect(response.status).toBe(401);
  });

  it('cleans up expired runs for the configured secret', async () => {
    process.env.APP_TUTORIAL_CLEANUP_SECRET = 'expected';
    const response = await cleanup({
      request: new Request('http://localhost/api/tutorial/cleanup', {
        method: 'POST',
        headers: { 'x-cleanup-secret': 'expected' },
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, deletedRuns: 3 });
  });

  it.each([
    [new mocks.DatabaseUnavailableError('offline'), 503, false],
    [new Error('failed'), 500, true],
  ] as const)('maps cleanup failures to %i', async (failure, status, logs) => {
    process.env.APP_TUTORIAL_CLEANUP_SECRET = 'expected';
    mocks.cleanupTutorial.mockRejectedValueOnce(failure);
    const response = await cleanup({
      request: new Request('http://localhost/api/tutorial/cleanup', {
        method: 'POST',
        headers: { 'x-cleanup-secret': 'expected' },
      }),
    });
    expect(response.status).toBe(status);
    expect(
      errorSpy.mock.calls.some((call: unknown[]) => call[0] === '[app-tutorial-cleanup]')
    ).toBe(logs);
  });
});
