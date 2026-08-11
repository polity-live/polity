/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callback: undefined as IntersectionObserverCallback | undefined,
  disconnect: vi.fn(),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode } & React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

import { DeferredLandingPreview } from '../DeferredLandingPreview';
import { LandingRevealSection } from '../LandingRevealSection';

class Observer {
  constructor(callback: IntersectionObserverCallback) {
    mocks.callback = callback;
  }
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect = mocks.disconnect;
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});
afterEach(cleanup);

describe('deferred and reveal branches A07', () => {
  it('loads immediately, handles failure, and retries successfully', async () => {
    const ready = vi.fn().mockResolvedValue({ default: () => <div>ready-preview</div> });
    const immediate = render(
      <DeferredLandingPreview load={ready} minHeight={100} label="Preview" />
    );
    expect(await screen.findByText('ready-preview')).toBeTruthy();
    immediate.unmount();
    const fail = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ default: () => <div>retried</div> });
    render(<DeferredLandingPreview load={fail} minHeight={100} label="Failed" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByText('common.loading.appBoot.retry'));
    expect(await screen.findByText('retried')).toBeTruthy();
  });

  it('ignores negative intersections and loads on a positive intersection', async () => {
    globalThis.IntersectionObserver = Observer as never;
    const load = vi.fn().mockResolvedValue({ default: () => <div>observed</div> });
    render(<DeferredLandingPreview load={load} minHeight={100} label="Observed" />);
    mocks.callback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(load).not.toHaveBeenCalled();
    mocks.callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(await screen.findByText('observed')).toBeTruthy();
  });

  it('reveals immediately or only after a positive intersection', async () => {
    const immediate = render(<LandingRevealSection>content</LandingRevealSection>);
    await waitFor(() =>
      expect(immediate.container.querySelector('section')?.className).toContain('opacity-100')
    );
    immediate.unmount();
    globalThis.IntersectionObserver = Observer as never;
    const observed = render(<LandingRevealSection>content</LandingRevealSection>);
    mocks.callback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(observed.container.querySelector('section')?.className).toContain('opacity-0');
    mocks.callback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    await waitFor(() =>
      expect(observed.container.querySelector('section')?.className).toContain('opacity-100')
    );
  });
});
