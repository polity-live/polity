import { afterEach, describe, expect, it, vi } from 'vitest';
import { mutationBenchmarkDelivery } from '../zero-mutation-delivery';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('isolated external mutation delivery', () => {
  it('preserves the real transport outside benchmark mode', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '');
    const real = vi.fn(async () => ({ statusCode: 202 }));
    expect(await mutationBenchmarkDelivery('web-push', real)).toEqual({ statusCode: 202 });
    expect(real).toHaveBeenCalledOnce();
  });
  it('sends only the provider identity to the owned local endpoint', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    vi.stubEnv('ZERO_PERFORMANCE_DELIVERY_URL', 'http://127.0.0.1:15628/deliver');
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _options?: RequestInit) =>
        new Response(null, { status: 201 })
    );
    vi.stubGlobal('fetch', fetch);
    const real = vi.fn();
    expect(await mutationBenchmarkDelivery('web-push', real)).toEqual({ statusCode: 201 });
    expect(real).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: '{"provider":"web-push"}',
    });
  });
  it.each([
    'https://provider.example/deliver',
    'http://provider.example:15628/deliver',
    'http://127.0.0.1:15618/deliver',
    'http://127.0.0.1:54321/deliver',
    'http://127.0.0.1:15629/deliver',
  ])('rejects non-isolated delivery %s', async address => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    vi.stubEnv('ZERO_PERFORMANCE_DELIVERY_URL', address);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(mutationBenchmarkDelivery('web-push', vi.fn())).rejects.toThrow(
      'Invalid isolated'
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires an explicitly configured endpoint in benchmark mode', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    vi.stubEnv('ZERO_PERFORMANCE_DELIVERY_URL', '');
    const real = vi.fn();
    await expect(mutationBenchmarkDelivery('web-push', real)).rejects.toThrow(
      'Missing deterministic'
    );
    expect(real).not.toHaveBeenCalled();
  });
  it('propagates transport rejection without falling back to real delivery', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    vi.stubEnv('ZERO_PERFORMANCE_DELIVERY_URL', 'http://localhost:15818/deliver');
    const error = new Error('transport failed'),
      real = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(mutationBenchmarkDelivery('web-push', real)).rejects.toBe(error);
    expect(real).not.toHaveBeenCalled();
  });
  it('keeps a failed delivery as a failure', async () => {
    vi.stubEnv('ZERO_PERFORMANCE_DIAGNOSTICS', '1');
    vi.stubEnv('ZERO_PERFORMANCE_DELIVERY_URL', 'http://127.0.0.1:15628/deliver');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    );
    await expect(mutationBenchmarkDelivery('web-push', vi.fn())).rejects.toThrow('provider failed');
  });
});
