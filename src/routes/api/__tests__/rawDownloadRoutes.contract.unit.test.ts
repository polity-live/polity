import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  prepare: vi.fn(),
  verify: vi.fn(),
  stream: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (route: unknown) => route }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.session }));
vi.mock('@/server/datasets/rawDownload', async original => ({
  ...(await original<typeof import('@/server/datasets/rawDownload')>()),
  prepareRawDownload: mocks.prepare,
  verifyRawDownloadTicket: mocks.verify,
  streamRawDownload: mocks.stream,
}));
vi.mock('@/server/datasets/service', () => ({ loadRawSnapshotRecord: vi.fn() }));
import { Route } from '../datasets/raw-download';
import { DatasetProviderFailure } from '@/server/datasets/providerError';
import { RawDownloadDenied } from '@/server/datasets/rawDownload';
type Handler = (args: { request: Request }) => Promise<Response>;
const handlers = (Route as unknown as { server: { handlers: Record<string, Handler> } }).server
  .handlers;
const actor = '00000000-0000-4000-8000-000000000001';
const selection = { provider: 'GENESIS_DESTATIS', providerDatasetId: '13211-0002', language: 'de' };
const request = (body: object) =>
  new Request('http://localhost:3000/api/datasets/raw-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: actor } });
});
it('requires authentication, rejects filter-bearing requests and prepares only the exact identity', async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await handlers.POST({ request: request(selection) })).status).toBe(401);
  expect(
    (await handlers.POST({ request: request({ ...selection, filters: { area: 'DE' } }) })).status
  ).toBe(400);
  mocks.prepare.mockResolvedValue({
    url: '/api/datasets/raw-download?ticket=fixture',
    kind: 'provider',
    fullDataset: true,
    fileName: '13211-0002.csv',
  });
  const response = await handlers.POST({ request: request(selection) });
  expect(response.status).toBe(200);
  expect(mocks.prepare.mock.calls[0][0]).toEqual(selection);
  expect(mocks.prepare.mock.calls[0][1]).toBe(actor);
});
it('returns classified preparation errors without echoing the request or auth parameters', async () => {
  mocks.prepare.mockRejectedValue(
    new DatasetProviderFailure('secret provider parameters', 'authentication', 503)
  );
  const response = await handlers.POST({ request: request(selection) });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    error: { code: 'dataset_provider_authentication' },
  });
});
it('validates transfer tickets and renders a localized failure page without an attachment header', async () => {
  mocks.verify.mockImplementationOnce(() => {
    throw new RawDownloadDenied('Expired');
  });
  const denied = await handlers.GET({
    request: new Request('http://localhost:3000/api/datasets/raw-download?ticket=invalid'),
  });
  expect(denied.status).toBe(403);
  expect(denied.headers.get('content-disposition')).toBeNull();
  mocks.verify.mockReturnValue({
    selection,
    actor,
    sourceUrl: 'https://genesis.destatis.de/',
    fileName: '13211-0002.csv',
  });
  mocks.stream.mockRejectedValue(new DatasetProviderFailure('reflected-secret', 'too_large', 413));
  const failed = await handlers.GET({
    request: new Request('http://localhost:3000/api/datasets/raw-download?ticket=fixture'),
  });
  expect(failed.status).toBe(413);
  const html = await failed.text();
  expect(html).toContain('Anbieter');
  expect(html).toContain('Quelle');
  expect(html).not.toContain('reflected-secret');
  expect(failed.headers.get('content-disposition')).toBeNull();
});
it('streams successful native downloads and leaves the browser to manage the transfer', async () => {
  mocks.verify.mockReturnValue({ selection, actor });
  mocks.stream.mockResolvedValue(
    new Response(new Uint8Array([0xe4]), {
      headers: { 'Content-Disposition': 'attachment; filename=data.csv' },
    })
  );
  const response = await handlers.GET({
    request: new Request('http://localhost:3000/api/datasets/raw-download?ticket=fixture'),
  });
  expect(response.headers.get('content-disposition')).toContain('attachment');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xe4]));
});
