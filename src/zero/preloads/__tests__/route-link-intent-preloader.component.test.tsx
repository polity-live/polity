/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentHref: '/current?x=1',
  preloadRoute: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ preloadRoute: mocks.preloadRoute }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: mocks.currentHref } }),
}));

import { RouteLinkIntentPreloader } from '../route-link-intent-preloader';

function anchor(href: string, attributes: Record<string, string> = {}) {
  const element = document.createElement('a');
  element.setAttribute('href', href);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.textContent = href;
  document.body.append(element);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/current?x=1');
  mocks.currentHref = '/current?x=1';
  mocks.preloadRoute.mockReset();
  mocks.preloadRoute.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('RouteLinkIntentPreloader', () => {
  it('ignores targets without an eligible internal href', () => {
    render(<RouteLinkIntentPreloader />);
    const span = document.body.appendChild(document.createElement('span'));
    const targeted = anchor('/targeted', { target: '_blank' });
    const download = anchor('/download', { download: 'file' });
    const disabled = anchor('/disabled', { 'data-preload': 'false' });
    const empty = anchor('');
    const hash = anchor('#section');

    fireEvent.pointerOver(document);
    fireEvent.pointerOut(span);
    for (const element of [span, targeted, download, disabled, empty, hash]) {
      fireEvent.pointerOver(element);
      fireEvent.focusIn(element);
    }
    vi.runAllTimers();

    expect(mocks.preloadRoute).not.toHaveBeenCalled();
  });

  it('delays hover intent, deduplicates it, and cancels on pointer out', () => {
    render(<RouteLinkIntentPreloader />);
    const target = anchor('/groups/group-1?tab=events#next');

    fireEvent.pointerOut(target);
    fireEvent.pointerOver(target);
    fireEvent.pointerOver(target);
    vi.advanceTimersByTime(49);
    expect(mocks.preloadRoute).not.toHaveBeenCalled();
    fireEvent.pointerOut(target);
    vi.advanceTimersByTime(1);
    expect(mocks.preloadRoute).not.toHaveBeenCalled();

    fireEvent.pointerOver(target);
    vi.advanceTimersByTime(50);
    expect(mocks.preloadRoute).toHaveBeenCalledOnce();
    expect(mocks.preloadRoute).toHaveBeenCalledWith({
      to: '/groups/group-1?tab=events#next',
    });
  });

  it('preloads eligible focus intent and ignores external, API, and local hash navigation', () => {
    render(<RouteLinkIntentPreloader />);
    const external = anchor('https://example.org/path');
    const api = anchor('/api/export');
    const localHash = anchor('/current?x=1#section');
    const currentWithoutHash = anchor('/current?x=1');
    const internal = anchor('/events/event-1');

    for (const element of [external, api, localHash, currentWithoutHash, internal]) {
      fireEvent.focusIn(element);
    }

    expect(mocks.preloadRoute.mock.calls).toEqual([
      [{ to: '/current?x=1' }],
      [{ to: '/events/event-1' }],
    ]);
  });

  it('swallows malformed URLs and preload promise failures', async () => {
    render(<RouteLinkIntentPreloader />);
    const malformed = anchor('/malformed');
    Object.defineProperty(malformed, 'href', { value: 'http://[', configurable: true });
    fireEvent.focusIn(malformed);

    mocks.preloadRoute.mockRejectedValueOnce(new Error('preload failed'));
    fireEvent.focusIn(anchor('/valid'));
    await Promise.resolve();

    expect(mocks.preloadRoute).toHaveBeenCalledOnce();
  });

  it('removes listeners and clears pending hover timers on unmount', () => {
    const { unmount } = render(<RouteLinkIntentPreloader />);
    const pending = anchor('/pending');
    fireEvent.pointerOver(pending);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.focusIn(anchor('/after-unmount'));
    expect(mocks.preloadRoute).not.toHaveBeenCalled();
  });
});
