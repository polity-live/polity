/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installInternalLinkIntentDelegation, resolveInternalPreloadHref } from '../link-intent';

const CURRENT_HREF = 'https://polity.test/home';
const isRoute = (pathname: string) =>
  ['/home', '/search', '/group/group-1', '/event/event-1'].includes(pathname);

function anchor(href: string, attributes: Record<string, string> = {}) {
  const element = document.createElement('a');
  element.href = href;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
}

describe('internal link intent delegation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('starts hover after 50 ms and cancels when the link is left', () => {
    const beginIntent = vi.fn();
    const cancelIntent = vi.fn();
    const link = anchor('/group/group-1');
    const cleanup = installInternalLinkIntentDelegation(document, CURRENT_HREF, isRoute, {
      beginIntent,
      cancelIntent,
    });

    link.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(49);
    expect(beginIntent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(beginIntent).toHaveBeenCalledOnce();
    expect(beginIntent).toHaveBeenCalledWith('/group/group-1');

    link.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    expect(cancelIntent).toHaveBeenCalledWith('/group/group-1');
    cleanup();
  });

  it('cancels a hover that leaves before the delay', () => {
    const beginIntent = vi.fn();
    const cancelIntent = vi.fn();
    const link = anchor('/event/event-1');
    const cleanup = installInternalLinkIntentDelegation(document, CURRENT_HREF, isRoute, {
      beginIntent,
      cancelIntent,
    });

    link.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    vi.advanceTimersByTime(50);

    expect(beginIntent).not.toHaveBeenCalled();
    expect(cancelIntent).toHaveBeenCalledWith('/event/event-1');
    cleanup();
  });

  it('does not restart while moving between descendants of the same anchor', () => {
    const beginIntent = vi.fn();
    const link = anchor('/search');
    const first = document.createElement('span');
    const second = document.createElement('span');
    link.append(first, second);
    const cleanup = installInternalLinkIntentDelegation(document, CURRENT_HREF, isRoute, {
      beginIntent,
      cancelIntent: vi.fn(),
    });

    first.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(25);
    first.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: second }));
    second.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: first }));
    vi.advanceTimersByTime(25);

    expect(beginIntent).toHaveBeenCalledOnce();
    cleanup();
  });

  it('starts focus and touch intents immediately', () => {
    const beginIntent = vi.fn();
    const focusLink = anchor('/search');
    const touchLink = anchor('/event/event-1');
    const cleanup = installInternalLinkIntentDelegation(document, CURRENT_HREF, isRoute, {
      beginIntent,
      cancelIntent: vi.fn(),
    });

    focusLink.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    touchLink.dispatchEvent(new Event('touchstart', { bubbles: true }));

    expect(beginIntent).toHaveBeenNthCalledWith(1, '/search');
    expect(beginIntent).toHaveBeenNthCalledWith(2, '/event/event-1');
    cleanup();
  });

  it('normalizes same-origin URLs and ignores non-page targets', () => {
    expect(
      resolveInternalPreloadHref(anchor('https://polity.test/search?q=zero'), CURRENT_HREF, isRoute)
    ).toBe('/search?q=zero');
    expect(
      resolveInternalPreloadHref(anchor('https://other.test/search'), CURRENT_HREF, isRoute)
    ).toBeUndefined();
    expect(
      resolveInternalPreloadHref(anchor('mailto:user@example.com'), CURRENT_HREF, isRoute)
    ).toBeUndefined();
    expect(
      resolveInternalPreloadHref(anchor('/search', { download: '' }), CURRENT_HREF, isRoute)
    ).toBeUndefined();
    expect(
      resolveInternalPreloadHref(anchor('/search', { target: '_blank' }), CURRENT_HREF, isRoute)
    ).toBeUndefined();
    expect(
      resolveInternalPreloadHref(
        anchor('/search', { 'data-preload': 'false' }),
        CURRENT_HREF,
        isRoute
      )
    ).toBeUndefined();
    expect(
      resolveInternalPreloadHref(anchor('/home#section'), CURRENT_HREF, isRoute)
    ).toBeUndefined();
    expect(resolveInternalPreloadHref(anchor('/missing'), CURRENT_HREF, isRoute)).toBeUndefined();
  });
});
