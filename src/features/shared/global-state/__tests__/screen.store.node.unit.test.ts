import { describe, expect, it, vi } from 'vitest';

describe('screen store server boundary', () => {
  it('uses the passive effect and returns before matchMedia on the server', async () => {
    vi.resetModules();
    const effect = vi.fn((callback: () => void) => callback());
    vi.doMock('react', async importOriginal => ({
      ...(await importOriginal<typeof import('react')>()),
      useEffect: effect,
      useLayoutEffect: vi.fn(),
    }));
    vi.doMock('zustand', () => ({
      create:
        () => () => (selector: (state: { setIsMobile: ReturnType<typeof vi.fn> }) => unknown) =>
          selector({ setIsMobile: vi.fn() }),
    }));
    vi.doMock('zustand/middleware/immer', () => ({ immer: (initializer: unknown) => initializer }));

    const { useScreenResponsiveDetector } = await import('../screen.store');
    useScreenResponsiveDetector();
    expect(effect).toHaveBeenCalledOnce();
  });
});
