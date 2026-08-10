/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferredLandingPreview } from '../DeferredLandingPreview';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DeferredLandingPreview', () => {
  it('loads when the host approaches the viewport', async () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    let observerOptions: IntersectionObserverInit | undefined;
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersectionCallback = callback;
        observerOptions = options;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '400px 0px';
      thresholds = [0.01];
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    const load = vi.fn(async () => ({
      default: () => <div>Interactive preview</div>,
    }));

    render(<DeferredLandingPreview load={load} minHeight={320} label="Preview" />);
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Preview' })).toBeTruthy();
    expect(observerOptions).toMatchObject({
      rootMargin: '400px 0px',
      threshold: 0.01,
    });

    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    expect(await screen.findByText('Interactive preview')).toBeTruthy();
    expect(load).toHaveBeenCalledOnce();
  });

  it('loads immediately when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const load = vi.fn(async () => ({
      default: () => <div>Fallback preview</div>,
    }));

    const { container } = render(
      <DeferredLandingPreview load={load} minHeight={360} label="Preview" />
    );

    expect(await screen.findByText('Fallback preview')).toBeTruthy();
    expect(load).toHaveBeenCalledOnce();
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('360px');
  });

  it('offers retry after a failed import', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const load = vi
      .fn<() => Promise<{ default: ComponentType }>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ default: () => <div>Recovered preview</div> });

    const { container } = render(
      <DeferredLandingPreview load={load} minHeight={320} label="Preview unavailable" />
    );
    expect(await screen.findByRole('alert')).toBeTruthy();

    const retry = container.querySelector<HTMLElement>(
      '[data-action-id="public-landing.deferred-preview.retry"]'
    );
    expect(retry).not.toBeNull();
    retry!.focus();
    expect(document.activeElement).toBe(retry);
    fireEvent.click(retry!);
    await waitFor(() => expect(screen.getByText('Recovered preview')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(2);
  });
});
