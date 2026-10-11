import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { updateMutationWeightFiles } from '../mutation-update-weights';
type Handler = (
  request: { method: string; url: string; [Symbol.asyncIterator]: () => AsyncGenerator<Buffer> },
  response: { writeHead: (status: number) => { end: () => undefined } }
) => Promise<void>;
const endpoint = vi.hoisted(() => ({
  handler: undefined as Handler | undefined,
  listen: vi.fn(),
  close: vi.fn(),
}));
vi.mock('node:http', () => ({
  createServer: (handler: Handler) => {
    endpoint.handler = handler;
    return { listen: endpoint.listen, close: endpoint.close };
  },
}));
const originalArg = process.argv[2];
const originalSignals = {
  SIGTERM: process.listeners('SIGTERM'),
  SIGINT: process.listeners('SIGINT'),
};
afterEach(() => {
  process.argv[2] = originalArg;
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    for (const listener of process.listeners(signal))
      if (!originalSignals[signal].includes(listener)) process.removeListener(signal, listener);
  vi.restoreAllMocks();
  vi.resetModules();
});
async function request(method: string, url: string, body: string) {
  let status = 0;
  const response = {
    writeHead: (value: number) => {
      status = value;
      return { end: () => undefined };
    },
  };
  if (!endpoint.handler) throw new Error('Endpoint not initialized');
  await endpoint.handler(
    {
      method,
      url,
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(body);
      },
    },
    response
  );
  return status;
}
describe('inert isolated delivery endpoint boundary', () => {
  it('writes only an explicit scheduling review output and retains source weight files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'mutation-weight-boundary-'));
    const base = path.join(directory, 'base.json'),
      report = path.join(directory, 'report.json'),
      output = path.join(directory, 'review.json');
    try {
      await writeFile(base, '{"query/default":123}');
      await writeFile(report, '{"format":12,"protocol":"zero-performance/v12","mutations":[]}');
      await expect(
        updateMutationWeightFiles(['--weights', base, '--report', report])
      ).rejects.toThrow('Required');
      expect(
        (
          await updateMutationWeightFiles([
            '--weights',
            base,
            '--report',
            report,
            '--output',
            output,
          ])
        ).updatedKeys
      ).toEqual([]);
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({ 'query/default': 123 });
      expect(await readFile(base, 'utf8')).toBe('{"query/default":123}');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('accepts only an inert provider marker and rejects secrets unknown routes and oversized payloads', async () => {
    process.argv[2] = '15628';
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await import('../delivery-endpoint.mjs');
    expect(endpoint.listen).toHaveBeenCalledWith(15628, '0.0.0.0');
    expect(await request('GET', '/ready', '')).toBe(200);
    expect(await request('POST', '/deliver', '{"provider":"web-push"}')).toBe(201);
    expect(await request('POST', '/deliver', '{"provider":"web-push","token":"secret"}')).toBe(400);
    expect(await request('POST', '/deliver', '{"provider":"live-service"}')).toBe(400);
    expect(await request('POST', '/deliver', 'x'.repeat(129))).toBe(413);
    expect(await request('POST', '/other', '')).toBe(404);
  });
  it('refuses development and misaligned ports before starting a listener', async () => {
    endpoint.listen.mockClear();
    process.argv[2] = '54322';
    await expect(import('../delivery-endpoint.mjs')).rejects.toThrow(
      'Invalid isolated delivery port'
    );
    expect(endpoint.listen).not.toHaveBeenCalled();
  });
});
