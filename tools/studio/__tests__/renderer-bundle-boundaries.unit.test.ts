import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock('vite', () => ({ build: io.build }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

it('returns a single emitted renderer chunk and shares concurrent build requests', async () => {
  io.build.mockResolvedValue({
    output: [
      { type: 'asset', fileName: 'asset.css' },
      { type: 'chunk', code: 'window.renderer = true;' },
    ],
  });
  const { studioV5RenderBundle } = await import('../studio-v5-render-bundle');
  const first = studioV5RenderBundle();
  expect(studioV5RenderBundle()).toBe(first);
  expect(await first).toBe('window.renderer = true;');
  expect(io.build).toHaveBeenCalledOnce();
  expect(io.build).toHaveBeenCalledWith(
    expect.objectContaining({
      configFile: false,
      build: expect.objectContaining({
        write: false,
        lib: expect.objectContaining({ formats: ['iife'] }),
      }),
    })
  );
});

it.each(['watcher', 'empty', 'multiple'] as const)(
  'rejects %s build output without returning a renderer',
  async kind => {
    io.build.mockResolvedValue(
      kind === 'watcher'
        ? { close: vi.fn() }
        : kind === 'empty'
          ? []
          : [
              { output: [{ type: 'chunk', code: 'first' }] },
              { output: [{ type: 'chunk', code: 'second' }] },
            ]
    );
    const { studioV5RenderBundle } = await import('../studio-v5-render-bundle');
    await expect(studioV5RenderBundle()).rejects.toThrow('Unexpected Studio renderer bundle');
  }
);
