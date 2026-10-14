import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), preview: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (route: unknown) => route }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.session }));
vi.mock('@/server/datasets/preview', () => ({ previewDataset: mocks.preview }));
import { Route } from '../datasets/preview';
import { DatasetProviderFailure } from '@/server/datasets/providerError';

const post = (
  Route as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const actor = '00000000-0000-4000-8000-000000000001';
const selection = { provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002' };
const request = (body: object, signal?: AbortSignal) =>
  new Request('http://localhost:3000/api/datasets/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: actor } });
});
afterEach(() => vi.restoreAllMocks());

it('requires authentication and rejects invalid preview scopes before calling the provider', async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await post({ request: request(selection) })).status).toBe(401);
  expect(mocks.preview).not.toHaveBeenCalled();
  for (const body of [
    { ...selection, provider: 'unknown' },
    { ...selection, page: { offset: -1, limit: 5 } },
    { ...selection, page: { offset: 0, limit: 201 } },
    { ...selection, datasetId: 'not-a-uuid' },
  ]) {
    const response = await post({ request: request(body) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'validation_failed' } });
  }
  expect(mocks.preview).not.toHaveBeenCalled();
});

it('preserves exact preview filters, pagination and identity and forwards browser cancellation', async () => {
  const controller = new AbortController();
  const body = {
    ...selection,
    language: 'de',
    filters: { area: 'DE' },
    rowFilters: { area: 'Deutschland' },
    rowConditions: [{ column: 'value', operator: 'range', min: '10', numeric: true }],
    sort: { column: 'value', direction: 'desc' },
    page: { offset: 5, limit: 5 },
  };
  const preview = { rows: [{ value: '12' }], totalRows: 1 };
  mocks.preview.mockResolvedValue(preview);
  const response = await post({ request: request(body, controller.signal) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(preview);
  expect(mocks.preview).toHaveBeenCalledOnce();
  const [input, user, signal] = mocks.preview.mock.calls[0];
  expect(input).toEqual(body);
  expect(user).toBe(actor);
  expect(signal.aborted).toBe(false);
  controller.abort();
  expect(signal.aborted).toBe(true);
});

it('configures a twenty-second preview deadline and classifies its cancellation', async () => {
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  mocks.preview.mockImplementation(
    (_input, _actor, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      })
  );
  const pending = post({ request: request(selection) });
  await vi.waitFor(() => expect(mocks.preview).toHaveBeenCalledOnce());
  expect(timeout).toHaveBeenCalledWith(20_000);
  expect(mocks.preview.mock.calls[0][0]).toMatchObject({ ...selection, language: 'en' });
  expect(mocks.preview.mock.calls[0][2].aborted).toBe(false);
  deadline.abort(new DOMException('Preview deadline', 'TimeoutError'));
  expect((await pending).status).toBe(504);
});

it('returns classified provider and access failures without reflecting private error details', async () => {
  for (const [error, status, code] of [
    [
      new DatasetProviderFailure('private upstream credential', 'authentication', 503),
      503,
      'dataset_provider_authentication',
    ],
    [new Error('private access denied'), 403, 'permission_denied'],
    [new Error('private parser details'), 422, 'dataset_operation_failed'],
  ] as const) {
    mocks.preview.mockRejectedValueOnce(error);
    const response = await post({ request: request(selection) });
    expect(response.status).toBe(status);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: { code } });
    expect(JSON.stringify(payload)).not.toContain('private');
  }
});
